# iMIX

E-commerce store for phones and laptops — an original brand, not an Apple clone.
See [`CLAUDE.md`](./CLAUDE.md) for conventions and [`ARCHITECTURE.md`](./ARCHITECTURE.md)
for the system design.

## Requirements

- **Node 22+** (`.nvmrc` pins 22)
- **pnpm 11** — the version is pinned in `package.json` via `packageManager`:

  ```bash
  corepack enable pnpm
  ```

  If `corepack enable` cannot write to your Node bin directory, install the shim
  somewhere on your `PATH` instead:

  ```bash
  corepack enable pnpm --install-directory ~/.local/bin
  ```

- **Docker** — runs the local Postgres.

## First run

Five steps from a fresh clone to a browsable shop. Run everything from the
repository root.

**1. Install dependencies**

```bash
pnpm install
```

**2. Create the env files**

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

The API will not start without `apps/api/.env` — that is where `DATABASE_URL`
lives. The web one is optional locally: without it the storefront falls back to
`http://localhost:4000`.

**3. Start Postgres**

Docker Desktop has to be running, then:

```bash
docker compose up -d db
```

Wait until it reports healthy:

```bash
docker compose ps
```

**4. Create the schema and load demo data**

```bash
pnpm --filter api db:migrate   # creates the tables
pnpm --filter api db:seed      # 2 categories, 4 products, 9 variants
```

**5. Start both apps**

```bash
pnpm dev
```

Turbo runs the API and the storefront together, so **keep this terminal open** —
closing it stops both. Then open **<http://localhost:3000>**.

| Service          | URL                                       |
| ---------------- | ----------------------------------------- |
| Storefront       | http://localhost:3000                     |
| API              | http://localhost:4000                     |
| API health probe | http://localhost:4000/health              |
| Postgres         | localhost:5433 (`imix`/`imix`, db `imix`) |

## Starting it again later

Steps 1–4 are one-offs. Day to day you only need:

```bash
docker compose up -d db   # only if Docker was restarted
pnpm dev
```

Run the two apps in separate terminals when you want their logs apart:

```bash
pnpm --filter api dev   # port 4000
pnpm --filter web dev   # port 3000
```

**Stopping:** `Ctrl+C` in the `pnpm dev` terminal stops both apps. Postgres keeps
running in the background until `docker compose down`.

## Checking it works

```bash
curl localhost:4000/health     # {"status":"ok", ... ,"database":"up"}
curl localhost:4000/products   # the seeded catalogue
```

Then click through: home → a category → a product → pick a different
configuration. The price and the stock line should change. Add it to the cart and
open `/checkout` — without Stripe keys the form is there but says payments are
unavailable (see [Payments](#payments)).

## Troubleshooting

| Symptom                                | Cause and fix                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Category page returns **500**          | The API is down. `curl localhost:4000/health` — if it fails, start it with `pnpm dev`.         |
| `/health` says `"database":"down"`     | Postgres is not up: `docker compose up -d db`.                                                 |
| `Cannot connect to the Docker daemon`  | Docker Desktop is not running. Start it, then retry.                                           |
| `DATABASE_URL is not set`              | Step 2 was skipped: `cp apps/api/.env.example apps/api/.env`.                                  |
| `port is already allocated` on 5433    | Another container holds the port: `docker compose down`, then up again.                        |
| `EADDRINUSE` on 3000 or 4000           | An old dev server survived. `pkill -f "next dev"` / `pkill -f "nest start"`, then `pnpm dev`.  |
| Catalogue is empty                     | The seed never ran: `pnpm --filter api db:seed`.                                               |
| Checkout says payments are unavailable | No Stripe keys — see [Payments](#payments). Expected on a fresh clone.                         |
| Order stays **PENDING** after paying   | The webhook is not reaching the API: run `stripe listen`, and check `STRIPE_WEBHOOK_SECRET`.   |
| `Cannot find module dist/main`         | The API build output is missing: `pnpm --filter api build`.                                    |
| Type errors mentioning `@imix/types`   | The shared package needs rebuilding: `pnpm --filter @imix/types build` (or just `pnpm build`). |
| Something is wedged beyond repair      | `pnpm --filter api db:reset` re-creates and re-seeds the database from scratch.                |

## API

Response types live in `packages/types` and are imported by both the controllers
and the storefront.

| Endpoint                 | Notes                                                      |
| ------------------------ | ---------------------------------------------------------- |
| `GET  /health`           | service + database probe                                   |
| `GET  /categories`       | all categories with their product counts                   |
| `GET  /products`         | `?category=<slug>&featured=<bool>&page=<n>&pageSize=<n>`   |
| `GET  /products/:slug`   | full product with variants; 404 when unknown               |
| —                        | every read also takes `?locale=ru\|en` and `?currency=RUB\|USD` |
| `POST /orders`           | variant ids + quantities in, priced PENDING order out      |
| `GET  /orders/:id`       | the confirmation page reads this; 404 when unknown         |
| `POST /payments/intent`  | Stripe client secret for an order; 503 without a key       |
| `POST /payments/webhook` | Stripe's callback — signature-verified, never called by us |

`GET /products` returns a `Paginated<ProductListItemDto>` envelope
(`{ items, page, pageSize, total }`), defaults to page 1 × 12 and caps
`pageSize` at 60. Query parameters are validated: unknown parameters and
out-of-range values are rejected with 400 rather than ignored.

`locale` and `currency` default to Russian and roubles — the shop's own. They do
not change the response *shape*: the API resolves one language and one currency
per request, so a product always has a single `name`, `basePrice` and `currency`.

```bash
curl 'localhost:4000/products?category=phones&featured=true'
curl 'localhost:4000/products/iphone-17-pro?locale=en&currency=USD'
```

`POST /orders` takes variant ids, quantities and a currency — never prices. The
server looks each variant up, checks stock and computes the total itself from
the price column matching that currency, so the order is priced from the
database whatever the client sends. The currency is required: it decides what
the buyer is charged, and it is frozen on the order.

```bash
curl -X POST localhost:4000/orders -H 'Content-Type: application/json' -d '{
  "email": "you@example.com",
  "currency": "RUB",
  "shipping": { "name": "Мила Орлова", "address": "ул. Тверская, 14",
                "city": "Москва", "zip": "125009", "country": "RU" },
  "items": [{ "variantId": "<id from /products/:slug>", "quantity": 1 }]
}'
```

## Payments

Checkout works without Stripe keys up to the point of paying: the order is
created, and `/checkout` says payments are unavailable instead of failing
mysteriously. To take a test payment end to end:

**1. Add the keys** — secret key in `apps/api/.env`, publishable key in
`apps/web/.env.local` (both from the [Stripe test
dashboard](https://dashboard.stripe.com/test/apikeys)).

**2. Forward webhooks** to the local API, in its own terminal:

```bash
stripe listen --forward-to localhost:4000/payments/webhook
```

Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET` in `apps/api/.env` and
restart the API. Without it the webhook rejects every event, and orders stay
PENDING forever.

**3. Pay** with card `4242 4242 4242 4242`, any future expiry, any CVC. The order
page moves from "Almost done" to "Thank you" once the webhook lands.

Stock is decremented by the webhook, not at checkout — an abandoned cart never
holds inventory. The full reasoning is in [`ARCHITECTURE.md`](./ARCHITECTURE.md)
§3.1.

## Database

Postgres runs in Docker and is published on **5433**, not the usual 5432, so it
never collides with a Postgres already installed on the host.

```bash
docker compose up -d db     # start
docker compose down         # stop (keeps data)
docker compose down -v      # stop and wipe the volume
```

Prisma lives in `apps/api`:

```bash
pnpm --filter api db:migrate   # create + apply a migration (prisma migrate dev)
pnpm --filter api db:seed      # run prisma/seed.ts — idempotent, safe to repeat
pnpm --filter api db:reset     # drop, re-migrate, re-seed
pnpm --filter api db:studio    # browse the data
```

The connection URL is **not** in `schema.prisma` — Prisma 7 reads it from
`apps/api/prisma.config.ts` for migrations, and `PrismaService` passes it to the
`pg` driver adapter at runtime. Both take it from `DATABASE_URL` in
`apps/api/.env`.

The seed loads two categories (`phones`, `laptops`) and four products with nine
variants. Brands and devices are invented for iMIX. Product imagery is
self-authored placeholder SVG under `apps/web/public/products/`; real
photography arrives in Phase 4.

## Scripts

```bash
pnpm dev                # web + api together (turbo)
pnpm --filter web dev   # storefront only
pnpm --filter api dev   # API only
pnpm build              # production build of every workspace
pnpm typecheck          # tsc --noEmit across workspaces
pnpm lint               # eslint across workspaces
pnpm format             # prettier write
pnpm --filter api test  # API tests (jest + supertest) — needs the database up
pnpm --filter web test  # storefront unit tests (vitest)
```

## Layout

```
apps/
  web/       Next.js 15 storefront (App Router) — /admin route group lands in Phase 3
  api/       NestJS 11 REST API
    prisma/  schema, migrations and seed data
packages/
  types/     @imix/types — the single source of truth for the API contract
  config/    @imix/config — shared tsconfig / eslint presets and Tailwind tokens
```

`packages/types` is compiled to `dist/` and consumed by both apps, so a change to
a response shape fails compilation on whichever side has not been updated.

## Status

**Phases 1 and 2 complete.** The shop runs end to end: browse a category, open a
product, pick a variant, add it to the cart, check out and pay.

| Route             | What it does                                            |
| ----------------- | ------------------------------------------------------- |
| `/`               | home                                                    |
| `/[category]`     | catalogue grid                                          |
| `/product/[slug]` | detail + variant picker                                 |
| `/cart`           | cart (Zustand, persisted in localStorage)               |
| `/checkout`       | shipping form, then Stripe Elements                     |
| `/order/[id]`     | confirmation; polls while the payment is still settling |

Every route exists in both languages. Russian is the shop's own and sits on the
bare path; English is prefixed — `/phones` and `/en/phones` are the same page.
The header switches language and currency; the currency is remembered in a
cookie so the server knows which price to render, and switching it **re-fetches**
the cart rather than converting it (there is no exchange rate in this shop —
each product carries a rouble price and a dollar price, both set by hand).

Checkout is **guest-only** for now: an order is identified by its email and its
cuid rather than by an account. Auth moves to Phase 3, where a logged-in checkout
just fills `Order.userId` in as well.

Next is Phase 3 — auth, the protected `/admin` route group, product and category
CRUD, order list. See the roadmap in `CLAUDE.md`.
