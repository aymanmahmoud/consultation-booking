import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { cairoWallTimeToUtc } from '../src/availability/availability.util';
import { AppModule } from './../src/app.module';

// Full Nest app bootstrap + Prisma's WASM query-compiler cold start take
// longer than Jest's default 5s hook timeout.
jest.setTimeout(30_000);

// Week 4 Day 2: widen coverage on the business rules that only had manual
// curl verification so far - booking validation and cancel authorization.
// These need a real app + real Postgres (not mocks) because the thing
// under test is how AppointmentsService actually integrates with the
// availability engine and the database, not isolated pure logic.
describe('Appointments business rules (e2e)', () => {
  const TEST_PASSWORD = 'BizRuleTest123!';

  let app: INestApplication<App>;
  let prisma: PrismaService;

  let consultantAProfileId: string;
  let consultantAUserId: string;
  let consultantBUserId: string;
  let inactiveConsultantProfileId: string;
  let inactiveConsultantUserId: string;
  let clientAUserId: string;
  let clientBUserId: string;

  let clientAToken: string;
  let clientBToken: string;
  let consultantAToken: string;
  let consultantBToken: string;

  let dateStr: string;
  let validSlotStartsAt: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    const password_hash = await bcrypt.hash(TEST_PASSWORD, 10);
    const suffix = Date.now();
    const mkUser = (label: string, role: 'client' | 'consultant') =>
      prisma.user.create({ data: { email: `biz-${label}-${suffix}@test.local`, password_hash, role } });

    const [consultantAUser, consultantBUser, inactiveConsultantUser, clientAUser, clientBUser] = await Promise.all([
      mkUser('consultant-a', 'consultant'),
      mkUser('consultant-b', 'consultant'),
      mkUser('consultant-inactive', 'consultant'),
      mkUser('client-a', 'client'),
      mkUser('client-b', 'client'),
    ]);
    consultantAUserId = consultantAUser.id;
    consultantBUserId = consultantBUser.id;
    inactiveConsultantUserId = inactiveConsultantUser.id;
    clientAUserId = clientAUser.id;
    clientBUserId = clientBUser.id;

    const [consultantAProfile, , inactiveProfile] = await Promise.all([
      prisma.consultantProfile.create({ data: { user_id: consultantAUserId, name: 'Consultant A', is_active: true } }),
      prisma.consultantProfile.create({ data: { user_id: consultantBUserId, name: 'Consultant B', is_active: true } }),
      prisma.consultantProfile.create({
        data: { user_id: inactiveConsultantUserId, name: 'Inactive Consultant', is_active: false },
      }),
    ]);
    consultantAProfileId = consultantAProfile.id;
    inactiveConsultantProfileId = inactiveProfile.id;

    // A date comfortably in the future regardless of when this suite runs.
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    dateStr = futureDate.toISOString().slice(0, 10);

    // All 7 days, 9-17: this suite is testing AppointmentsService's
    // integration with the availability engine, not the engine's own
    // day-of-week logic (already covered in Week 2 Day 6) - a fixed daily
    // window keeps the fixture independent of which weekday "30 days out"
    // happens to land on.
    await prisma.workingHours.createMany({
      data: Array.from({ length: 7 }, (_, day_of_week) => ({
        consultant_id: consultantAProfileId,
        day_of_week,
        start_time: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
        end_time: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)),
      })),
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: TEST_PASSWORD })
        .expect(200);
      return res.body.access_token as string;
    };
    [clientAToken, clientBToken, consultantAToken, consultantBToken] = await Promise.all([
      login(clientAUser.email),
      login(clientBUser.email),
      login(consultantAUser.email),
      login(consultantBUser.email),
    ]);

    const availabilityRes = await request(app.getHttpServer())
      .get(`/consultants/${consultantAProfileId}/availability`)
      .query({ from: dateStr, to: dateStr })
      .expect(200);
    expect(availabilityRes.body.slots.length).toBeGreaterThan(0);
    validSlotStartsAt = availabilityRes.body.slots[0].starts_at;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({
      where: { consultant_id: { in: [consultantAProfileId, inactiveConsultantProfileId] } },
    });
    await prisma.workingHours.deleteMany({ where: { consultant_id: consultantAProfileId } });
    await prisma.consultantProfile.deleteMany({
      where: { user_id: { in: [consultantAUserId, consultantBUserId, inactiveConsultantUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [consultantAUserId, consultantBUserId, inactiveConsultantUserId, clientAUserId, clientBUserId] } },
    });
    await app.close();
  });

  describe('POST /appointments validation', () => {
    it('rejects a starts_at that is not on the hour (BR-2)', async () => {
      const offHour = new Date(new Date(validSlotStartsAt).getTime() + 30 * 60_000).toISOString();
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ consultant_id: consultantAProfileId, starts_at: offHour });
      expect(res.status).toBe(400);
    });

    it('rejects a starts_at in the past (BR-6)', async () => {
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ consultant_id: consultantAProfileId, starts_at: '2020-01-01T09:00:00.000Z' });
      expect(res.status).toBe(400);
    });

    it('404s for an unknown consultant_id', async () => {
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ consultant_id: '00000000-0000-4000-8000-000000000000', starts_at: validSlotStartsAt });
      expect(res.status).toBe(404);
    });

    it('rejects booking an inactive consultant (BR-10)', async () => {
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ consultant_id: inactiveConsultantProfileId, starts_at: validSlotStartsAt });
      expect(res.status).toBe(400);
    });

    it('rejects a time outside working hours', async () => {
      const outsideHours = cairoWallTimeToUtc(dateStr, 3).toISOString(); // 3am, well outside 9-17
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ consultant_id: consultantAProfileId, starts_at: outsideHours });
      expect(res.status).toBe(400);
    });

    it('books a valid, available slot', async () => {
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ consultant_id: consultantAProfileId, starts_at: validSlotStartsAt });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
      expect(res.body.meeting_link).toBe(`https://meet.example.com/${res.body.id}`);

      const row = await prisma.appointment.findUnique({ where: { id: res.body.id } });
      expect(row?.status).toBe('confirmed');
    });

    it('rejects booking the same slot again (already booked)', async () => {
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ consultant_id: consultantAProfileId, starts_at: validSlotStartsAt });
      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /appointments/:id/cancel authorization', () => {
    let appointmentId: string;

    it('creates a second booking to test cancellation against', async () => {
      const secondSlot = cairoWallTimeToUtc(dateStr, 11).toISOString();
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ consultant_id: consultantAProfileId, starts_at: secondSlot });
      expect(res.status).toBe(201);
      appointmentId = res.body.id;
    });

    it('rejects cancellation by an unrelated client', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${clientBToken}`);
      expect(res.status).toBe(403);
    });

    it('rejects cancellation by an unrelated consultant', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${consultantBToken}`);
      expect(res.status).toBe(403);
    });

    it('leaves the appointment confirmed after the rejected attempts', async () => {
      const row = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      expect(row?.status).toBe('confirmed');
    });

    it('lets the booking client cancel their own appointment', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${clientAToken}`);
      expect(res.status).toBe(200);

      const row = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      expect(row?.status).toBe('cancelled');
      expect(row?.cancelled_by).toBe(clientAUserId);
    });

    it('rejects cancelling an already-cancelled appointment', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${clientAToken}`);
      expect(res.status).toBe(409);
    });

    it('404s for an unknown appointment id', async () => {
      const res = await request(app.getHttpServer())
        .patch('/appointments/00000000-0000-4000-8000-000000000000/cancel')
        .set('Authorization', `Bearer ${clientAToken}`);
      expect(res.status).toBe(404);
    });

    it('lets the consultant cancel a different booking', async () => {
      const thirdSlot = cairoWallTimeToUtc(dateStr, 13).toISOString();
      const bookRes = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ consultant_id: consultantAProfileId, starts_at: thirdSlot });
      expect(bookRes.status).toBe(201);

      const cancelRes = await request(app.getHttpServer())
        .patch(`/appointments/${bookRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${consultantAToken}`);
      expect(cancelRes.status).toBe(200);

      const row = await prisma.appointment.findUnique({ where: { id: bookRes.body.id } });
      expect(row?.status).toBe('cancelled');
      expect(row?.cancelled_by).toBe(consultantAUserId);
    });
  });
});
