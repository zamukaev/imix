# CLAUDE.md — iMIX

> This file is read automatically by Claude Code. It defines the project, the
> conventions, and how you should work. Keep it up to date as the project grows.

## Project

**iMIX** is an e-commerce store for phones and MacBooks. The visual language is
inspired by Apple's marketing sites (minimalist, generous whitespace, large
typography, scroll-driven storytelling, product-focused) with 3D product
animations — but it is an **original design under the iMIX brand**, not a clone.

### Hard constraints

- **Never** use real Apple assets, logos, trademarks, official product photos,
  or Apple's exact copy/layout. Build an original visual identity for iMIX.
- Use generic or self-authored 3D models / placeholders for devices. Do not ship
  Apple-owned 3D assets.
- Keep it legally clean: iMIX is a _retailer_ concept, not Apple.

## Stack

| Layer      | Choice                                                       |
| ---------- | ------------------------------------------------------------ |
| Monorepo   | pnpm workspaces + Turborepo                                  |
| Frontend   | Next.js 15 (App Router), TypeScript, Tailwind CSS            |
| 3D         | React Three Fiber + @react-three/drei + GSAP (ScrollTrigger) |
| State      | Zustand (cart) + TanStack Query (server state)               |
| Backend    | NestJS, TypeScript                                           |
| ORM / DB   | Prisma + PostgreSQL                                          |
| Auth       | JWT (access + refresh), role-based (USER / ADMIN)            |
| Payments   | Stripe (PaymentIntents + webhook)                            |
| Storage    | Cloudinary or S3 (images + .glb 3D models)                   |
| Validation | class-validator / class-transformer (API DTOs), Zod (web)    |

## Structure

```
imix/
├── apps/
│   ├── web/          # Next.js — storefront + /admin (protected route group)
│   └── api/          # NestJS — REST API
├── packages/
│   ├── types/        # shared domain types & API DTO contracts (single source of truth)
│   └── config/       # shared tsconfig / eslint / tailwind presets
├── pnpm-workspace.yaml
├── turbo.json
└── CLAUDE.md
```

- Shared request/response types live in `packages/types` and are imported by
  **both** `web` and `api`. The API contract has one source of truth.
- Admin is a protected route group inside `web` (`app/(admin)`), not a separate app.

## Commands

```bash
pnpm install            # install all workspaces
pnpm dev                # run web + api together (turbo)
pnpm --filter web dev   # run only the storefront
pnpm --filter api dev   # run only the API
pnpm --filter api prisma migrate dev   # DB migration
pnpm typecheck          # tsc across workspaces
pnpm lint               # eslint across workspaces
pnpm build              # production build
```

## Conventions

- TypeScript **strict** everywhere. No `any` unless justified with a comment.
- API DTOs validated with class-validator; never trust client input.
- Money is stored in **integer minor units** (cents), never floats.
- File naming: kebab-case files, PascalCase React components, camelCase functions.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).
- Small, reviewable commits — one logical change per commit.

## How you (Claude Code) should work here

1. Before starting a task, restate the plan briefly, then execute.
2. Prefer editing existing files over creating parallel versions.
3. After changes, run `pnpm typecheck` and `pnpm lint`; fix what you broke.
4. Keep the vertical-slice discipline: don't build breadth before the current
   slice works end-to-end.
5. 3D work is **Phase 5** — do not start it until the store works without 3D,
   unless explicitly told otherwise.
6. Ask before adding a new heavy dependency; prefer the stack above.

## Roadmap (current phase marked ►)

- ~~**Phase 1 — Skeleton & vertical slice:** monorepo, DB schema, seed data,
  catalog page + product detail page pulling from the real API. No 3D.~~ ✅
- ► **Phase 2 — Commerce:** cart (Zustand), checkout, Stripe PaymentIntents + webhook, orders.
- **Phase 3 — Admin:** protected `/admin`, product & category CRUD, order list.
- **Phase 4 — Responsive & polish:** mobile layouts, loading/empty/error states, SEO, images.
- **Phase 5 — 3D layer:** R3F product viewer on detail page, scroll-driven hero,
  performance budget (lazy-load models, suspense, low-poly fallbacks).

Update the ► marker as phases complete.
