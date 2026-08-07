# Week 1 Day 1 — Working Agreement & Data Model Design

**Date:** 2026-08-07
**Status:** Approved by user (chat), proceeding to implementation

## Context

This supplements `docs/consultation-booking-spec.md`, which defines the product, business rules, and delivery plan but does not pin down a concrete data model. This doc closes that gap for Week 1 Day 1 ("Finalise ERD") and records the collaboration working agreement for the rest of the 4-week build.

## Working agreement

- Learning goal: the user is a backend/DB beginner building this project specifically to learn backend and database management.
- Claude writes all code for every part of the app, including the availability engine and concurrency logic — the spec's original AI policy (§8, hand-write the hard parts) is explicitly overridden by the user for this project.
- Before writing any piece of code, Claude explains the backend/DB concept behind it — the why, not just the what.
- Nothing is `git commit`ed until the user has reviewed it and explicitly says to proceed.
- Work follows `docs/consultation-booking-spec.md` §7's day-by-day plan in order, starting at Week 1 Day 1, rather than reorganizing into concept modules or vertical slices.

## Data model (ERD)

Derived from the actors, business rules (BR-1 through BR-12), and API surface in `docs/consultation-booking-spec.md`.

| Table | Key columns | Why it exists |
|---|---|---|
| `users` | `id`, `email` (unique), `password_hash`, `role` (`client`\|`consultant`\|`admin`), `created_at` | One table for all actors — role decides permissions (Actors table in spec) |
| `consultant_profiles` | `id`, `user_id` (unique FK → users), `headline`, `bio`, `price`, `is_active` | 1-to-1 extension of a `consultant`-role user; kept separate so `users` stays generic (F-08, BR-10) |
| `specialties` | `id`, `name` (unique) | Admin-managed catalogue (F-06/F-07) |
| `consultant_specialties` | `consultant_id`, `specialty_id` (composite PK) | Many-to-many join — a consultant can hold several specialties (BR-9, F-09) |
| `working_hours` | `id`, `consultant_id`, `day_of_week`, `start_time`, `end_time` | Weekly recurring availability template (F-14) |
| `time_off` | `id`, `consultant_id`, `starts_at`, `ends_at` | Explicit exceptions to working hours (F-15) |
| `appointments` | `id`, `client_id`, `consultant_id`, `starts_at`, `ends_at`, `status` (`confirmed`\|`cancelled`), `meeting_link`, `cancelled_at`, `cancelled_by`, `created_at` | The booking record. `starts_at`/`ends_at` as `timestamptz` (BR-12). No `slots` table — availability is computed (BR-3) |

Key constraint: a **partial unique index** on `appointments (consultant_id, starts_at) WHERE status = 'confirmed'` enforces BR-4 (no double booking) while allowing BR-8 (a cancelled slot is immediately rebookable) — enforced by Postgres, not application code. Prisma's schema DSL cannot express a `WHERE`-qualified unique index directly, so this constraint is added by hand-editing the generated SQL migration (Week 1 Day 2), not in `schema.prisma` itself.

## Self-review notes

- No placeholders remain; every table maps to a specific business rule or feature ID from the spec.
- Consistent with the spec: no `slots` table (BR-3), `timestamptz` throughout (BR-12), status enum matches BR-5/BR-7/BR-8.
- Scope: this covers Week 1 Day 1 only (the ERD). Full `schema.prisma`, migration, and the partial index are Week 1 Day 2 work, started immediately below at the user's request.
