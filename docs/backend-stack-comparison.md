# Backend Stack Comparison: NestJS vs Laravel

Written after building the real API (`api/`, NestJS + Prisma + Postgres, Weeks 1–4) and a small comparison service (`items-service/`, Laravel 13 + Eloquent + SQLite, Week 4 Day 3). This isn't a generic framework comparison — it's what actually differed while building the same kind of thing (a validated REST resource) in both.

## Validation

**NestJS**: a DTO class with `class-validator` decorators, wired up through a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`). The DTO doubles as the TypeScript type for the request body, which is genuinely useful — but the pipe itself needed deliberate setup (Week 1 Day 5), and until it's wired up, the decorators do nothing at all.

**Laravel**: a `FormRequest` class with a `rules()` array. `StoreItemRequest` took about two minutes to write and worked immediately — no global middleware to register, no separate step to "turn validation on." Less ceremony for the common case, at the cost of the rules living as strings/arrays rather than a type the rest of the app can reuse.

## Error shape

**NestJS**: nothing is consistent by default. Getting every endpoint — validation failures, 404s, uncaught exceptions — to return the same `{statusCode, message, path, timestamp}` shape took a hand-written global exception filter (Week 1 Day 5).

**Laravel**: validation failures already return a consistent `{message, errors: {field: [...]}}` JSON shape with zero configuration, as long as the request sends `Accept: application/json`. Different shape convention (errors keyed by field name, values are arrays of messages) than what we built for NestJS, but it's there from the first request, no filter required.

## ORM and migrations

**Prisma**: schema-first (`schema.prisma` is the source of truth, migrations are generated from diffs against it), a fully typed client. Real friction hit this project specifically from being on Prisma 7: the new client requires an explicit driver adapter (no more connecting from a bare `DATABASE_URL`), the WASM query compiler needs `--experimental-vm-modules` to load under Jest at all, the generated client's NodeNext-style `.js`-suffixed imports needed a Jest `moduleNameMapper` to resolve, and by default the generator emits ESM (`import.meta.url`), which crashes under NestJS's CommonJS build unless `moduleFormat = "cjs"` is set explicitly. None of this is hard once you know it, but all four were genuine "why is this broken" moments this project actually hit.

**Eloquent**: migration-first (you write the PHP migration file directly), ActiveRecord-style models, `$fillable` for mass-assignment protection. Zero equivalent friction — `composer create-project`, `make:migration`, `migrate`, done. The tradeoff is Eloquent models aren't statically typed the way a Prisma client is; nothing stops you from typo-ing a column name until it fails at runtime.

## The one correctness technique both share

BR-4 (no double booking) is enforced by a Postgres **partial unique index**, not application code — `appointments(consultant_id, starts_at) WHERE status = 'confirmed'` — with the app catching the resulting constraint violation (Prisma's `P2002`) and returning `409`. This is genuinely a Postgres feature, not a NestJS one. The identical technique — a DB constraint plus catching a driver-specific unique-violation error — would work exactly the same way from Eloquent, catching a `QueryException` on the relevant SQLSTATE instead. Worth remembering this project's hardest correctness guarantee doesn't actually come from the web framework at all.

## Where TypeScript did *not* save us

Both `api/` and `web/` are TypeScript, so in theory the compiler should catch a contract mismatch between them. In practice, several real bugs surfaced only when the existing Angular frontend was finally wired up against the real API (see the frontend note) — `GET /consultants` returning a paginated envelope instead of a bare array, `specialties` being flattened server-side instead of the raw junction-row shape — and were caught by actually loading the page in a browser and reading a runtime `TypeError`, not by `tsc`. TypeScript checks the shape you *declare* an HTTP response has, not the shape it actually has; nothing connects those two without an integration test or a generated client. "Same language on both ends" narrowed the gap but did not close it.

## Time to a working, validated endpoint

Not a fair apples-to-apples comparison — `api/` already had auth, guards, and Prisma wired up before any of this project's business endpoints existed, while `items-service/` started from nothing. But concretely: `composer create-project` to two working, validated Laravel endpoints took well under the day's two-hour budget. Laravel's reputation for fast time-to-first-endpoint held up here.

## Testing

**NestJS**: Jest, but getting e2e tests running against the real Prisma 7 client required the same WASM/module friction noted above, plus bumping Jest's default hook timeout for full app bootstrap.

**Laravel**: PHPUnit worked immediately, no configuration - `php artisan test` passed against the default scaffold tests with nothing touched.
