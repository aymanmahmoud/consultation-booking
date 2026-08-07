# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is an early-stage scaffold for a **Consultation Booking Platform** (NestJS + PostgreSQL + Prisma + Angular). `api/` is a fresh `nest new` output and `web/` is a fresh `ng new` output — neither has app-specific modules, a Prisma schema, or routes/components yet beyond the framework defaults. The authoritative design document is **`docs/consultation-booking-spec.md`** — read it before implementing any feature; it defines the actors, business rules, data model direction, full API surface, and a week-by-week delivery plan. Treat it as the spec to build towards, not a description of existing code.

`api/` contains its own nested `.git` (from `nest new`'s default git init, no commits). The root repo currently sees `api/`, `web/`, `docs/`, and `docker-compose.yml` as untracked — be aware that `git add api/` from root will behave like adding a gitlink, not the files inside it, until that nested `.git` is removed or the files are added from within `api/`.

## Commands

### Database
```bash
docker-compose up -d          # Postgres 16 on localhost:5433 (user/pass: postgres, db: consultation)
```

### API (`api/`, NestJS)
```bash
npm install
npm run start:dev             # watch mode
npm run build
npm run lint                  # eslint --fix
npm run format                # prettier --write
npm run test                  # unit tests (Jest, spec files under src/)
npm run test:watch
npm run test:cov
npm run test:e2e              # e2e tests, uses test/jest-e2e.json
```
Run a single unit test file: `npx jest src/path/to/file.spec.ts`. Run by name: `npx jest -t "test name"`.

### Web (`web/`, Angular 21)
```bash
npm install
npm start                     # ng serve
npm run build
npm test                      # ng test — runs via @angular/build:unit-test (vitest under the hood)
```

## Architecture notes from the spec

- **Availability is computed, never stored.** There is no `slots` table. Free slots are derived at request time as `working_hours − time_off − confirmed_appointments − past_slots`.
- **No double booking is enforced at the database level** — a partial unique index on `(consultant_id, starts_at)` for `confirmed` appointments, not application code. Booking logic must handle the resulting Prisma `P2002` conflict and return `409`.
- Sessions are always exactly 60 minutes, and slots only start on the hour (`HH:00`).
- Booking is instant (`status = 'confirmed'` immediately) — no hold/pending/approval state.
- Cancellation has no time restriction and is done by either the booking client or the consultant; a cancelled slot is immediately rebookable (uniqueness only applies to `confirmed` rows).
- Single timezone system-wide: `Africa/Cairo`, stored as `timestamptz`.
- Meeting links are placeholder strings (`https://meet.example.com/{appointment_id}`) — no real video SDK integration.
- Explicitly out of scope (do not build): payments, real video calling, chat, reviews/ratings, notifications, recurring bookings, multi-timezone support, variable session lengths, rescheduling, file uploads, admin analytics.

## AI usage policy (from the spec, author's working rule)

- Availability engine and concurrency/transaction logic: written by hand by the author; AI's role there is limited to reviewing for missed edge cases and race conditions, not writing the logic.
- SQL joins: written by hand first.
- Angular components/forms, DTOs, and boilerplate/config: AI may write these directly.

## Web coding conventions

`web/` has its own `AGENTS.md` (mirrored into `web/.claude/CLAUDE.md` and `web/.gemini/GEMINI.md`) with Angular/TypeScript conventions — standalone components, signals, `input()`/`output()`, `OnPush`, native control flow, no `ngClass`/`ngStyle`, reactive forms, accessibility (AXE/WCAG AA). That file is loaded automatically when working under `web/`; don't duplicate its rules here.
