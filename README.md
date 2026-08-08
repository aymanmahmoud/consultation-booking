# MediConsult — Consultation Booking Platform

![NestJS](https://img.shields.io/badge/Backend-NestJS_11-E0234E?logo=nestjs)
![Angular](https://img.shields.io/badge/Frontend-Angular_21-DD0031?logo=angular)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_16-4169E1?logo=postgresql)
![Prisma](https://img.shields.io/badge/ORM-Prisma_7-2D3748?logo=prisma)
![TypeScript](https://img.shields.io/badge/Language-TypeScript_5-3178C6?logo=typescript)

An enterprise full-stack consultation booking platform designed to connect clients with specialists. Clients browse consultants by specialty, view available 60-minute time slots, and instantly book consultations without manual approval steps.

> **One sentence:** *Find a specialist, pick a free hour, book it.*

---

## 🚀 Key Architectural & Engineering Highlights

### 1. Dynamic Availability Engine (No `slots` table)
Time slot availability is **never hardcoded or pre-generated** as static database rows. Instead, free 60-minute slots are derived dynamically on request:
$$\text{Available Slots} = \text{Working Hours} - \text{Time Off} - \text{Confirmed Appointments} - \text{Past Slots}$$

### 2. Database-Level Concurrency Control (Partial Unique Index)
To prevent race conditions and double-booking under concurrent load, uniqueness is strictly enforced at the **PostgreSQL database engine level**:
```sql
CREATE UNIQUE INDEX "appointments_consultant_id_starts_at_confirmed_key"
ON "appointments" ("consultant_id", "starts_at")
WHERE "status" = 'confirmed';
```
If two clients attempt to book the exact same slot simultaneously, PostgreSQL guarantees exactly 1 transaction succeeds and rejects the second with a unique constraint violation (`409 Conflict`). Cancelled slots immediately become bookable again (**BR-8**).

### 3. Role-Based Access Control (RBAC)
- **Client**: Browse consultants, filter by specialty, book 60-min sessions, view own appointments, cancel own bookings.
- **Consultant**: Manage profile (`headline`, `bio`, `price`), assign specialties, define weekly working hours schedule (`09:00 AM` - `05:00 PM`), block out-of-office time-off intervals, cancel bookings.
- **Admin**: Manage specialties catalogue (create, edit, delete categories), activate/deactivate consultants, manage global settings.

---

## 🛠️ Tech Stack

### Backend (`/api`)
- **Framework**: NestJS 11 + TypeScript
- **ORM**: Prisma ORM 7 (`@prisma/adapter-pg`)
- **Security**: Bcrypt password hashing, Passport JWT stateless authentication
- **Validation & Exception Handling**: Global `ValidationPipe` (with DTO whitelist stripping) and unified `AllExceptionsFilter`

### Frontend (`/web`)
- **Framework**: Angular 21 (Single Page Application)
- **Reactive State**: RxJS & Angular Signals
- **Styling**: Glassmorphism CSS design system with custom CSS tokens, modern typography (`Inter` & `Plus Jakarta Sans`), and micro-interactions

### Infrastructure
- **Database**: PostgreSQL 16 containerized with Docker Compose & named volume storage (`pgdata`)

---

## 💻 Quick Start & Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ or v20+)
- [Docker & Docker Compose](https://www.docker.com/)

---

### Step 1: Clone & Start PostgreSQL Database

```bash
# Start PostgreSQL 16 container on port 5433
docker compose up -d
```

### Step 2: Setup & Seed the Backend API (`/api`)

```bash
cd api

# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Seed mock database data (Admin, Consultants, Specialties, Clients)
npx prisma db seed

# Start NestJS development server (Port 3000)
npm run start:dev
```

### Step 3: Setup & Start the Angular Frontend (`/web`)

```bash
cd ../web

# Install dependencies
npm install

# Start Angular development server (Port 4200)
npm start
```

Open your browser and navigate to **`http://localhost:4200`**!

---

## 🔑 Pre-Seeded Test Credentials

All pre-seeded test accounts use the default password: **`Passw0rd!`**

| Role | Email | Details |
|---|---|---|
| **Admin** | `admin@consultbook.test` | Full admin privileges (Manage Specialties Catalogue) |
| **Consultant** | `sara.hassan@consultbook.test` | Sara Hassan — Career Coaching ($45/hr) |
| **Consultant** | `omar.farouk@consultbook.test` | Omar Farouk — Legal & Tax Advisor ($60/hr) |
| **Consultant** | `mona.said@consultbook.test` | Mona Said — Nutrition & Mental Health ($35/hr) |
| **Client** | `layla.ibrahim@example.test` | Client account for booking consultations |
| **Client** | `youssef.adel@example.test` | Client account for booking consultations |

---

## 📁 Repository Structure

```
consultation-booking/
├── api/                     # NestJS backend REST API
│   ├── prisma/              # Prisma schema, migrations, and seed scripts
│   ├── src/
│   │   ├── auth/            # JWT Auth, Bcrypt hashing, RolesGuard
│   │   ├── consultants/     # Consultant profiles, Working Hours, Time Off
│   │   ├── specialties/     # Specialties CRUD
│   │   ├── common/          # Global validation pipes & exception filters
│   │   └── main.ts          # Application bootstrap with CORS enabled
├── web/                     # Angular 21 frontend application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/  # Sticky Navbar & reusable UI components
│   │   │   ├── pages/       # Discovery, Slot Picker, Auth, Schedule, Profile
│   │   │   ├── services/    # AuthService & ApiService (HTTP Integration)
│   │   │   └── interceptors/# Functional JWT AuthInterceptor
│   │   └── styles.scss      # Global design system & theme tokens
├── docs/                    # Specifications & ERD design documentation
└── docker-compose.yml       # Local PostgreSQL database service configuration
```

---

## 📊 Database ERD Overview

- **`users`**: Central identity table storing `email`, `password_hash`, and enum `role` (`client` | `consultant` | `admin`).
- **`consultant_profiles`**: 1-to-1 extension storing `headline`, `bio`, `price`, `is_active`.
- **`specialties`**: Lookup table for consultation categories.
- **`consultant_specialties`**: Many-to-Many join table linking consultants to multiple specialties.
- **`working_hours`**: Weekly availability template (`day_of_week`, `start_time`, `end_time`).
- **`time_off`**: Date/time out-of-office exception blocks.
- **`appointments`**: Booking records storing 60-minute sessions with status (`confirmed` | `cancelled`).

---

## 📝 License

UNLICENSED — Built for learning full-stack development and database engineering.
