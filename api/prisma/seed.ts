import { PrismaClient, Role } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

// Prisma 7 no longer connects from a bare datasource URL — it needs an
// explicit driver adapter. The real app's PrismaService will do the same.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Dev-only: every seeded account shares this password so you can log in
// as any of them once auth exists. Never do this for real user data.
const SEED_PASSWORD = 'Passw0rd!';

function timeOfDay(hour: number): Date {
  // Prisma's @db.Time columns still need a full Date — Postgres discards
  // the date part and keeps only the time-of-day.
  return new Date(Date.UTC(1970, 0, 1, hour, 0, 0));
}

async function main() {
  const password_hash = await bcrypt.hash(SEED_PASSWORD, 10);

  const specialtyNames = [
    'Career Coaching',
    'Legal Advice',
    'Tax Consulting',
    'Nutrition Counseling',
    'Mental Health Counseling',
  ];
  const specialties = await Promise.all(
    specialtyNames.map((name) =>
      prisma.specialty.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );
  const specialtyByName = Object.fromEntries(specialties.map((s) => [s.name, s]));

  await prisma.user.upsert({
    where: { email: 'admin@consultbook.test' },
    update: {},
    create: {
      email: 'admin@consultbook.test',
      password_hash,
      role: Role.admin,
    },
  });

  const consultantSeeds = [
    {
      email: 'sara.hassan@consultbook.test',
      name: 'Sara Hassan',
      headline: 'Career coach for early-career engineers',
      bio: 'Ten years in tech recruiting, now helping engineers plan their next move.',
      price: 45.0,
      specialties: ['Career Coaching'],
    },
    {
      email: 'omar.farouk@consultbook.test',
      name: 'Omar Farouk',
      headline: 'Corporate & contract law consultant',
      bio: 'Advises freelancers and small businesses on contracts and compliance.',
      price: 60.0,
      specialties: ['Legal Advice', 'Tax Consulting'],
    },
    {
      email: 'mona.said@consultbook.test',
      name: 'Mona Said',
      headline: 'Registered dietitian & wellness counselor',
      bio: 'Evidence-based nutrition plans and one-on-one wellness coaching.',
      price: 35.0,
      specialties: ['Nutrition Counseling', 'Mental Health Counseling'],
    },
  ];

  for (const c of consultantSeeds) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { email: c.email, password_hash, role: Role.consultant },
    });

    const profile = await prisma.consultantProfile.upsert({
      where: { user_id: user.id },
      // Backfills `name` onto profiles created by an earlier seed run,
      // before this field existed - other fields are left alone in case
      // they've since been edited via PATCH /consultants/me.
      update: { name: c.name },
      create: {
        user_id: user.id,
        name: c.name,
        headline: c.headline,
        bio: c.bio,
        price: c.price,
        is_active: true,
      },
    });

    for (const specialtyName of c.specialties) {
      const specialty = specialtyByName[specialtyName];
      await prisma.consultantSpecialty.upsert({
        where: {
          consultant_id_specialty_id: {
            consultant_id: profile.id,
            specialty_id: specialty.id,
          },
        },
        update: {},
        create: { consultant_id: profile.id, specialty_id: specialty.id },
      });
    }

    // No unique constraint on (consultant_id, day_of_week), so we make this
    // idempotent by replacing the set each run instead of upserting rows.
    await prisma.workingHours.deleteMany({ where: { consultant_id: profile.id } });
    await prisma.workingHours.createMany({
      data: [1, 2, 3, 4, 5].map((day_of_week) => ({
        consultant_id: profile.id,
        day_of_week,
        start_time: timeOfDay(9),
        end_time: timeOfDay(17),
      })),
    });
  }

  const clientEmails = [
    'layla.ibrahim@example.test',
    'youssef.adel@example.test',
    'nourhan.tarek@example.test',
    'karim.mostafa@example.test',
    'rana.khaled@example.test',
  ];
  for (const email of clientEmails) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, password_hash, role: Role.client },
    });
  }

  console.log('Seed complete: 1 admin, 3 consultants (with specialties + working hours), 5 clients.');
  console.log(`All seeded accounts use password: ${SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
