# CLAUDE.md — iMIX

> This file is read automatically by Claude Code. It defines the project, the
> conventions, and how you should work. Keep it up to date as the project grows.

## Project

**iMIX** is an e-commerce store for phones and MacBooks, **built for the Russian
market**. It is a retailer of genuine Apple hardware with its own brand and its
own storefront.

### Design reference

`apple.com` is the visual reference. Take the **principles**, not the page:

| Take                                              | Don't take                        |
| ------------------------------------------------- | --------------------------------- |
| Stacked full-bleed tiles, one idea each            | Their section order or page layout |
| Tight negative-tracked display type over a subhead | Their headlines or copy            |
| Pill buttons, one primary + one ghost              | Their logo, wordmark, blue, icons  |
| Generous whitespace, neutral surfaces              | Their imagery treatment            |
| Reveal-on-scroll motion                            | Anything that reads as "official"  |

The test: a visitor should recognise the *kind* of design and never mistake the
*site*. Full spec — type scale, tile anatomy, control rules — in
`ARCHITECTURE.md` §5 "Design language". **Read it before writing any UI.**

### Language and money

- **Russian is the primary language**, English is the secondary one. Russian
  sits on bare paths (`/iphone`), English is prefixed (`/en/iphone`).
- **Prices are quoted in RUB and USD.** Both are *stored*, never converted:
  there is no exchange rate in this codebase. Adding a currency means adding a
  price column, on purpose.
- Shopper-facing product text is stored per language in the database
  (`nameRu`/`nameEn`, …). UI copy lives in `apps/web/src/messages/{ru,en}.json`.
- **No shopper-facing English string is ever hardcoded** — that includes error
  messages, `aria-label`s and page metadata.

### Hard constraints

- iMIX is a **reseller of genuine Apple devices**. Real Apple product photos in
  the catalogue are therefore **intentional and allowed** — they identify the
  goods actually being sold. `assets/` holds these product images.
- The **brand identity stays iMIX**: own logo, own wordmark, own copy, own
  layout. Never present the site as Apple or an official Apple property, and
  don't use the Apple logo / Apple Store branding as site chrome.
- **Never lift marketing copy from the reference**, in any language — not
  translated, not paraphrased close to the original. iMIX writes as a retailer
  who has handled the device, not as the manufacturer announcing it.
- Use generic or self-authored 3D models / placeholders for devices. Do not ship
  Apple-owned 3D assets.
- Keep it legally clean: iMIX is a _retailer_, not Apple.

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
| Payments   | Stripe (PaymentIntents + webhook) — see the note below       |
| Storage    | Cloudinary or S3 (images + .glb 3D models)                   |
| Validation | class-validator / class-transformer (API DTOs), Zod (web)    |
| i18n       | next-intl (ru default, en secondary)                         |

> **Payments, open question.** Stripe does not onboard Russian merchants — it
> withdrew from the market in 2022. The integration in `apps/api/src/payments`
> works and is what the tests cover, but a shop actually selling into Russia
> will need YooKassa, CloudPayments or T-Bank acquiring instead. The service
> already takes the currency from the stored order rather than a constant, so
> swapping the provider is a matter of replacing `StripeService` and the webhook
> verification — don't build anything new against Stripe-specific shapes.

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
- Money is stored in **integer minor units** (копейки / cents), never floats, and
  always **per currency**. An amount is meaningless without the `Currency` next
  to it — every DTO that carries money carries one.
- New shopper-facing text goes into **both** message catalogues in the same
  commit. `t()` is typed against `ru.json`, so a missing English key is a
  compile error and a missing Russian one is unrepresentable.
- Every size, colour, radius and spacing step comes from
  `packages/config/tailwind/tokens.css`. No ad-hoc `text-[52px]` or `#f5f5f7` in
  a component — if a value is missing, add a token.
- Buttons are pills with exactly two roles (primary, ghost). Marketing sections
  are tiles, not `<section>`s with margins. See `ARCHITECTURE.md` §5.
- File naming: kebab-case files, PascalCase React components, camelCase functions.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).
- Small, reviewable commits — one logical change per commit.

## How you (Claude Code) should work here

1. Before starting a task, restate the plan briefly, then execute.
2. Prefer editing existing files over creating parallel versions.
3. After changes, run `pnpm typecheck` and `pnpm lint`; fix what you broke.
4. Keep the vertical-slice discipline: don't build breadth before the current
   slice works end-to-end.
5. Before writing or changing any UI, read `ARCHITECTURE.md` §5 "Design
   language". Reach for a token and an existing primitive before inventing one.
6. 3D work is **Phase 5** — do not start it until the store works without 3D,
   unless explicitly told otherwise.
7. Ask before adding a new heavy dependency; prefer the stack above.

## Roadmap (current phase marked ►)

- ~~**Phase 1 — Skeleton & vertical slice:** monorepo, DB schema, seed data,
  catalog page + product detail page pulling from the real API. No 3D.~~ ✅
- ~~**Phase 2 — Commerce:** cart (Zustand), checkout, Stripe PaymentIntents + webhook, orders.~~ ✅
- ~~**Slice — Language & money:** ru/en via next-intl, RUB/USD stored per
  product, bilingual catalogue. Landed out of phase order because it changes the
  schema.~~ ✅
- ~~**Phase 3 — Admin:** auth (JWT, USER/ADMIN), protected `/admin`, product &
  category CRUD, order list, and the editable home page (`HomeTile`) that
  Phase 4.2 renders from.~~ ✅
- ~~**Phase 4 — Design, responsive & polish:** the design language in §5 of
  `ARCHITECTURE.md` made real — tokens, tile primitives, the home page rebuilt as
  a tile stack — then mobile layouts, loading/empty/error states, SEO, images.~~ ✅
- ► **Phase 5 — 3D layer:** R3F product viewer on detail page, scroll-driven hero,
  performance budget (lazy-load models, suspense, low-poly fallbacks).

Update the ► marker as phases complete.
