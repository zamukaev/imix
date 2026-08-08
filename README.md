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

## Getting started

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

docker compose up -d db              # Postgres on localhost:5433
pnpm --filter api db:migrate         # apply migrations
pnpm --filter api db:seed            # load demo catalogue

pnpm dev
```

| Service          | URL                                       |
| ---------------- | ----------------------------------------- |
| Storefront       | http://localhost:3000                     |
| API              | http://localhost:4000                     |
| API health probe | http://localhost:4000/health              |
| Postgres         | localhost:5433 (`imix`/`imix`, db `imix`) |

The home page shows the API's live health status and whether it can reach the
database — a quick way to tell which piece is down.

## API

Public, read-only for now. Response types live in `packages/types` and are
imported by both the controllers and the storefront.

| Endpoint              | Notes                                                    |
| --------------------- | -------------------------------------------------------- |
| `GET /health`         | service + database probe                                 |
| `GET /categories`     | all categories with their product counts                 |
| `GET /products`       | `?category=<slug>&featured=<bool>&page=<n>&pageSize=<n>` |
| `GET /products/:slug` | full product with variants; 404 when unknown             |

`GET /products` returns a `Paginated<ProductListItemDto>` envelope
(`{ items, page, pageSize, total }`), defaults to page 1 × 12 and caps
`pageSize` at 60. Query parameters are validated: unknown parameters and
out-of-range values are rejected with 400 rather than ignored.

```bash
curl 'localhost:4000/products?category=phones&featured=true'
curl localhost:4000/products/nuvo-aster-7-pro
```

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
variants. Brands and devices are invented for iMIX; product imagery is referenced
under `apps/web/public/products/` and arrives in Phase 4.

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

Phase 1.3 complete: monorepo skeleton, Postgres with the schema from
`ARCHITECTURE.md`, seeded catalogue, and the public read-only categories and
products API. The storefront pages that consume it are Phase 1.4 — see the
roadmap in `CLAUDE.md`.
