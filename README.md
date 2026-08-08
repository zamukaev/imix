# iMIX

E-commerce store for phones and MacBooks — an original brand, not an Apple clone.
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

- **Docker** — for local Postgres, from Phase 1.2 onwards.

## Getting started

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

| Service          | URL                          |
| ---------------- | ---------------------------- |
| Storefront       | http://localhost:3000        |
| API              | http://localhost:4000        |
| API health probe | http://localhost:4000/health |

The home page shows the API's live health status — if it reads `unreachable`,
the API is not running or `NEXT_PUBLIC_API_URL` points somewhere else.

## Scripts

```bash
pnpm dev                # web + api together (turbo)
pnpm --filter web dev   # storefront only
pnpm --filter api dev   # API only
pnpm build              # production build of every workspace
pnpm typecheck          # tsc --noEmit across workspaces
pnpm lint               # eslint across workspaces
pnpm format             # prettier write
pnpm --filter api test  # API tests (jest + supertest)
```

## Layout

```
apps/
  web/       Next.js 15 storefront (App Router) — /admin route group lands in Phase 3
  api/       NestJS 11 REST API
packages/
  types/     @imix/types — the single source of truth for the API contract
  config/    @imix/config — shared tsconfig / eslint presets and Tailwind tokens
```

`packages/types` is compiled to `dist/` and consumed by both apps, so a change to
a response shape fails compilation on whichever side has not been updated.

## Status

Phase 1.1 complete: the monorepo skeleton runs end to end (`/health` → shared
types → storefront). Database, seed data and the product API arrive in
Phase 1.2–1.3 — see the roadmap in `CLAUDE.md`.
