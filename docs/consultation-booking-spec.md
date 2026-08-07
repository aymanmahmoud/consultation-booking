# Consultation Booking Platform — Business Spec & Delivery Plan

**Author:** Ayman
**Program:** AZM SQUAD — Enterprise Full-Stack Development Program
**Duration:** 4 weeks
**Stack:** NestJS · PostgreSQL · Prisma · Angular · Jest

---

## 1. Product Summary

An online consultation booking platform. Clients browse consultants by specialty, view their available time slots, and book a fixed 60-minute session. Consultants define their weekly working hours and block time off. Bookings are instant — no payment, no approval step.

**One sentence:** *Find a specialist, pick a free hour, book it.*

---

## 2. Actors

| Actor | Can do |
|---|---|
| **Client** | Browse & search consultants, view availability, book a session, cancel own bookings, see own bookings |
| **Consultant** | Manage own profile & specialties, define weekly working hours, block time off, view own bookings, cancel a booking |
| **Admin** | Manage the specialties catalogue, activate/deactivate consultants, view all bookings |

---

## 3. Business Rules

These are the rules the system enforces. Every one of them should have a test.

### BR-1 — Session duration
Every session is exactly **60 minutes**. `ends_at` is always `starts_at + 60 min`.

### BR-2 — Slots start on the hour
A slot can only start at `HH:00`. No 10:30 bookings. This keeps slot generation deterministic.

### BR-3 — Availability is computed, never stored
Free slots are derived at request time from:

```
available = working_hours − time_off − confirmed_appointments − past_slots
```

No `slots` table exists. If a slot is not blocked by any of the four, it is bookable.

### BR-4 — No double booking
A consultant can never have two `confirmed` appointments at the same `starts_at`. Enforced at the **database level** by a partial unique index, not by application code.

### BR-5 — Instant confirmation
Booking creates an appointment with status `confirmed` immediately. There is no hold, no pending state, no consultant approval.

### BR-6 — No past bookings
`starts_at` must be in the future at the moment of booking.

### BR-7 — Cancellation
Either party (the client who booked, or the consultant) can cancel at **any time**, with no time restriction. Cancelling sets `status = 'cancelled'`, records `cancelled_at` and `cancelled_by`. The slot immediately becomes bookable again.

### BR-8 — Cancelled slots are reusable
The uniqueness rule in BR-4 applies only to `confirmed` appointments, so a cancelled slot can be rebooked by anyone.

### BR-9 — Multiple specialties
A consultant has one or more specialties. Search by specialty must return every consultant who holds it.

### BR-10 — Inactive consultants
A consultant with `is_active = false` does not appear in search and cannot receive new bookings. Existing bookings are unaffected.

### BR-11 — Meeting link
Generated as a placeholder string on booking (e.g. `https://meet.example.com/{appointment_id}`). No video SDK integration.

### BR-12 — Single timezone
The entire system operates in `Africa/Cairo`. All timestamps stored as `timestamptz`.

---

## 4. Feature List (MVP)

### Auth
- `F-01` Register as client
- `F-02` Register as consultant (creates user + consultant profile)
- `F-03` Login → JWT
- `F-04` Get current user (`/me`)
- `F-05` Role-based route guards (client / consultant / admin)

### Specialties
- `F-06` List all specialties
- `F-07` Admin: create / update / delete specialty

### Consultant profile
- `F-08` Consultant: view & update own profile (headline, bio, price)
- `F-09` Consultant: assign / remove own specialties
- `F-10` Public: view a consultant's public profile

### Discovery
- `F-11` List consultants (paginated)
- `F-12` Filter by specialty
- `F-13` Search by name or headline

### Availability
- `F-14` Consultant: set weekly working hours (day, start, end)
- `F-15` Consultant: add / remove time off
- `F-16` Public: get available slots for a consultant over a date range

### Booking
- `F-17` Client: book a slot
- `F-18` Client: list own bookings (upcoming / past)
- `F-19` Consultant: list own bookings
- `F-20` Cancel a booking (client or consultant)
- `F-21` Admin: list all bookings

---

## 5. Explicitly Out of Scope

Do not build these. They are listed so the boundary is written down, not to be added later "if there's time."

- Payments, invoices, refunds
- Real video/audio calling (Zoom, Agora, WebRTC)
- Chat or messaging between users
- Reviews, ratings, favourites
- Email / SMS / push notifications
- Recurring or multi-session bookings
- Multiple timezones
- Variable session lengths or pricing tiers
- Rescheduling (cancel + rebook covers it)
- File uploads / avatars
- Admin analytics dashboard

---

## 6. API Surface

| Method | Endpoint | Role |
|---|---|---|
| POST | `/auth/register` | public |
| POST | `/auth/login` | public |
| GET | `/auth/me` | any |
| GET | `/specialties` | public |
| POST | `/specialties` | admin |
| GET | `/consultants` | public |
| GET | `/consultants/:id` | public |
| PATCH | `/consultants/me` | consultant |
| PUT | `/consultants/me/specialties` | consultant |
| GET | `/consultants/me/working-hours` | consultant |
| PUT | `/consultants/me/working-hours` | consultant |
| GET | `/consultants/me/time-off` | consultant |
| POST | `/consultants/me/time-off` | consultant |
| DELETE | `/consultants/me/time-off/:id` | consultant |
| GET | `/consultants/:id/availability?from=&to=` | public |
| POST | `/appointments` | client |
| GET | `/appointments/me` | client / consultant |
| PATCH | `/appointments/:id/cancel` | client / consultant |

---

## 7. Four-Week Delivery Plan

Assume roughly 2 focused hours per weekday. Every week ends with something that **runs**.

---

### Week 1 — Data model, auth, and the foundation

**Goal:** A running API with a real database and working authentication.

| Day | Work |
|---|---|
| 1 | Finalise ERD. `nest new`. Docker Compose with Postgres. Prisma init. |
| 2 | Write full `schema.prisma`. First migration. Add the partial unique index via raw SQL migration. |
| 3 | Seed script: specialties, 3 consultants, 5 clients, working hours. |
| 4 | Auth module: register, login, bcrypt, JWT strategy, `/me`. |
| 5 | Roles guard + decorator. Global validation pipe. Global exception filter. |
| 6 | Write raw SQL by hand in psql: join consultants + specialties, count bookings per consultant. |
| 7 | Buffer / catch-up. |

**Deliverable:** `POST /auth/register` and `POST /auth/login` work against a real database. Seeded data queryable.

**Learning focus:** Prisma migrations, NestJS module structure, DI, guards. Write the joins in raw SQL before letting Prisma do them.

---

### Week 2 — CRUD, discovery, and the availability engine

**Goal:** The hardest logic in the project is done and tested.

| Day | Work |
|---|---|
| 1 | Specialties module (CRUD, admin-guarded). Consultant profile module. |
| 2 | Consultant ↔ specialties many-to-many assignment. |
| 3 | `GET /consultants` with pagination, specialty filter, and name search. |
| 4 | Working hours + time off modules. |
| 5 | **Availability engine** — `GET /consultants/:id/availability`. Generate hourly slots from working hours across a date range, subtract time off, subtract confirmed appointments, subtract past slots. |
| 6 | Jest unit tests for the availability engine: no working hours, full day off, partially booked day, range crossing a week boundary. |
| 7 | Buffer. |

**Deliverable:** Hitting the availability endpoint returns a correct list of free hours. Tested.

**Learning focus:** This is the core week. Date/time interval logic, many-to-many joins, unit testing pure logic.

---

### Week 3 — Booking, concurrency, and the frontend

**Goal:** Bookings work correctly under concurrent load, and there is a UI.

| Day | Work |
|---|---|
| 1 | `POST /appointments`. Validate: slot is in the future, consultant is active, slot is actually available. |
| 2 | **Concurrency:** wrap in a transaction, let the partial unique index reject the duplicate, catch Prisma `P2002`, return `409 Conflict`. |
| 3 | Integration test: fire N simultaneous bookings for the same slot, assert exactly one succeeds. |
| 4 | Cancel endpoint + authorisation (only the booking client or the consultant may cancel). List-own-bookings endpoints. |
| 5 | Angular app scaffold. Auth (login, token interceptor, route guards). Consultant list + filter page. |
| 6 | Consultant detail page with a slot picker calendar. |
| 7 | Booking flow: pick slot → confirm → handle `409` gracefully. My-bookings page with cancel. |

**Deliverable:** End-to-end booking works in the browser. The concurrency test passes.

**Learning focus:** Transactions, database constraints as a correctness tool, HTTP status semantics, frontend/backend integration.

---

### Week 4 — Hardening, second stack, documentation, delivery

**Goal:** Ship it.

| Day | Work |
|---|---|
| 1 | Error handling pass: consistent error shape, loading and error states on every Angular screen. |
| 2 | Widen test coverage: auth guards, cancel authorisation, booking validation. Target the business rules, not line coverage. |
| 3 | **Program requirement:** a separate tiny Laravel service with `GET /items` and `POST /items` + validation. Two hours, not two days. |
| 4 | Write the backend stack comparison note (NestJS vs Laravel) and the frontend note. |
| 5 | README: setup, migrations, seed, run, API table. AI usage log. |
| 6 | Self-review checklist. Record the demo walkthrough. |
| 7 | Week 4 self-assessment form. Submit. |

**Deliverable:** Everything on the program's deliverables dashboard.

---

## 8. AI Usage Policy

The rule for this project:

> **In areas of weakness, AI explains and reviews — it does not write.**
> **In areas of strength, AI writes — I review.**

| Area | Mode |
|---|---|
| Availability engine | Write by hand. Then ask AI to find missed edge cases. |
| Concurrency / transactions | Write by hand. Then ask AI to find race conditions. |
| SQL joins | Write by hand in psql first. |
| Jest test cases | AI suggests cases, I write the assertions. |
| Angular components & forms | AI writes, I review. |
| DTOs, boilerplate, config | AI writes. |

Every AI-assisted session gets one line in `AI_USAGE_LOG.md`: what was asked, what was accepted, what was rejected and why.

---

## 9. Definition of Done

- [ ] A client can register, log in, find a consultant by specialty, see free hours, and book one
- [ ] Two simultaneous bookings for the same slot: exactly one succeeds, the other gets `409`
- [ ] A cancelled slot becomes bookable again
- [ ] The availability engine has unit tests covering at least 5 edge cases
- [ ] Every endpoint returns a consistent error shape
- [ ] README lets a stranger run the project in under 5 minutes
- [ ] AI usage log is complete
