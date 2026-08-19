import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from './../src/app.module';

// Full Nest app bootstrap + Prisma's WASM query-compiler cold start take
// longer than Jest's default 5s hook timeout.
jest.setTimeout(30_000);

// Week 3 Day 3: fire N simultaneous bookings for the same slot, assert
// exactly one succeeds. This is the one guarantee in the whole project
// that can't be checked by calling a pure function - it only means
// something against a real Postgres instance under real concurrent load,
// which is why this lives in test/ (e2e, real DB) and not src/ (unit,
// mocked).
describe('POST /appointments concurrency (e2e)', () => {
  const CONCURRENT_REQUESTS = 15;
  const TEST_PASSWORD = 'RaceTest123!';

  let app: INestApplication<App>;
  let prisma: PrismaService;

  let consultantProfileId: string;
  let consultantUserId: string;
  let clientUserId: string;
  let clientToken: string;
  let slotStartsAt: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirrors main.ts exactly: e2e tests build the app via
    // createNestApplication(), bypassing main.ts's bootstrap() entirely,
    // so without this the DTOs' @Type(() => Date) transform never runs
    // and the controller receives raw strings instead of Date objects.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    const password_hash = await bcrypt.hash(TEST_PASSWORD, 10);

    const consultantUser = await prisma.user.create({
      data: { email: `race-consultant-${Date.now()}@test.local`, password_hash, role: 'consultant' },
    });
    consultantUserId = consultantUser.id;

    const consultantProfile = await prisma.consultantProfile.create({
      data: { user_id: consultantUserId, name: 'Race Test Consultant', is_active: true },
    });
    consultantProfileId = consultantProfile.id;

    const clientUser = await prisma.user.create({
      data: { email: `race-client-${Date.now()}@test.local`, password_hash, role: 'client' },
    });
    clientUserId = clientUser.id;

    // A date comfortably in the future regardless of when this suite
    // actually runs - not hardcoded, since "the future" drifts.
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const dateStr = futureDate.toISOString().slice(0, 10);
    const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();

    await prisma.workingHours.create({
      data: {
        consultant_id: consultantProfileId,
        day_of_week: dayOfWeek,
        start_time: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
        end_time: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)),
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: clientUser.email, password: TEST_PASSWORD })
      .expect(200);
    clientToken = loginRes.body.access_token;

    // Read the target slot from the real availability endpoint, the same
    // way an actual client would pick one, rather than computing the
    // Cairo->UTC instant independently here.
    const availabilityRes = await request(app.getHttpServer())
      .get(`/consultants/${consultantProfileId}/availability`)
      .query({ from: dateStr, to: dateStr })
      .expect(200);
    expect(availabilityRes.body.slots.length).toBeGreaterThan(0);
    slotStartsAt = availabilityRes.body.slots[0].starts_at;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { consultant_id: consultantProfileId } });
    await prisma.workingHours.deleteMany({ where: { consultant_id: consultantProfileId } });
    await prisma.consultantProfile.delete({ where: { id: consultantProfileId } });
    await prisma.user.deleteMany({ where: { id: { in: [consultantUserId, clientUserId] } } });
    await app.close();
  });

  it('lets exactly one of N simultaneous bookings for the same slot succeed', async () => {
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_REQUESTS }, () =>
        request(app.getHttpServer())
          .post('/appointments')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({ consultant_id: consultantProfileId, starts_at: slotStartsAt }),
      ),
    );

    const statusCounts = responses.reduce<Record<number, number>>((acc, res) => {
      acc[res.status] = (acc[res.status] ?? 0) + 1;
      return acc;
    }, {});

    expect(statusCounts[201]).toBe(1);
    expect(statusCounts[409]).toBe(CONCURRENT_REQUESTS - 1);

    // The HTTP responses are only ever as trustworthy as the database
    // they describe - check Postgres directly, not just what the API said.
    const confirmedCount = await prisma.appointment.count({
      where: { consultant_id: consultantProfileId, starts_at: new Date(slotStartsAt), status: 'confirmed' },
    });
    expect(confirmedCount).toBe(1);
  });
});
