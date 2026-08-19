# items-service

A deliberately tiny, standalone Laravel service — not part of the consultation booking app. It exists purely as a second-stack comparison point against the NestJS API in `api/` (see the program's Week 4 Day 4 write-up), so it's intentionally minimal: one resource, two endpoints, no auth.

## What's here

- `GET /api/items` — list all items
- `POST /api/items` — create an item, validated via `StoreItemRequest`
  - `name`: required, string, max 255
  - `description`: optional, string, max 2000

Uses the default SQLite database Laravel scaffolds (`database/database.sqlite`) — no shared infrastructure with the rest of this repo.

## Running it

```bash
composer install
cp .env.example .env    # composer install copies this automatically too, but just in case
php artisan key:generate
php artisan migrate     # auto-creates database/database.sqlite
php artisan serve
```

Then:

```bash
curl http://127.0.0.1:8000/api/items

curl -X POST http://127.0.0.1:8000/api/items \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"name":"Widget","description":"A sample item"}'
```
