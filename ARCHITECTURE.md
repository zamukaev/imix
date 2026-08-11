# iMIX — Architecture

A reference for the system design. `CLAUDE.md` is the short operational memory;
this file is the deeper "why and how".

## 1. High-level shape

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                           │
│  Next.js (App Router)  ─ storefront + /admin route group │
│  Zustand (cart)  ·  TanStack Query  ·  R3F 3D viewer     │
└───────────────┬─────────────────────────────────────────┘
                │  HTTPS (REST, JSON)
┌───────────────▼─────────────────────────────────────────┐
│                     NestJS API                           │
│  Auth · Products · Categories · Orders · Payments · Upload│
│  JWT guards · role guards · class-validator DTOs         │
└───────────────┬───────────────────────┬─────────────────┘
                │ Prisma                 │  webhooks / SDK
┌───────────────▼──────────┐   ┌─────────▼──────────┐  ┌──────────────┐
│   PostgreSQL             │   │      Stripe        │  │  Cloudinary/S3│
│   (products, orders...)  │   │  (payments)        │  │ (images/.glb) │
└──────────────────────────┘   └────────────────────┘  └──────────────┘
```

Frontend and backend are separate deployables but share TypeScript types via
`packages/types`, so the API contract is enforced at compile time on both sides.

## 2. Data model (Prisma)

```prisma
enum Role { USER ADMIN }
enum OrderStatus { PENDING PAID FAILED SHIPPED CANCELLED }

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  role         Role     @default(USER)
  orders       Order[]
  createdAt    DateTime @default(now())
}

model Category {
  id       String    @id @default(cuid())
  slug     String    @unique          // "phones", "laptops" — locale-independent
  nameRu   String
  nameEn   String
  products Product[]
}

model Product {
  id            String           @id @default(cuid())
  slug          String           @unique
  nameRu        String
  nameEn        String
  descriptionRu String
  descriptionEn String
  brand         String                          // "Apple" — never translated
  categoryId    String
  category      Category         @relation(fields: [categoryId], references: [id])
  basePriceRub  Int                             // minor units (копейки)
  basePriceUsd  Int                             // minor units (cents)
  images        String[]
  model3dUrl    String?                         // .glb for R3F viewer (Phase 5)
  featured      Boolean          @default(false)
  variants      ProductVariant[]
  createdAt     DateTime         @default(now())
}

model ProductVariant {
  id         String      @id @default(cuid())
  productId  String
  product    Product     @relation(fields: [productId], references: [id])
  sku        String      @unique
  labelRu    String                             // "256 ГБ · Чёрный титан"
  labelEn    String                             // "256GB · Black Titanium"
  color      String?
  config     String?                            // storage / RAM etc.
  priceRub   Int                                // minor units (копейки)
  priceUsd   Int                                // minor units (cents)
  stock      Int         @default(0)
  orderItems OrderItem[]
}

model Order {
  id                    String      @id @default(cuid())
  userId                String?                           // null for a guest checkout
  user                  User?       @relation(fields: [userId], references: [id])
  email                 String                            // owner reference until auth lands
  status                OrderStatus @default(PENDING)
  total                 Int
  currency              Currency    @default(RUB)      // frozen with the order
  stripePaymentIntentId String?     @unique
  shippingName          String
  shippingAddress       String
  shippingCity          String
  shippingZip           String
  shippingCountry       String
  items                 OrderItem[]
  createdAt             DateTime    @default(now())
}

model OrderItem {
  id              String         @id @default(cuid())
  orderId         String
  order           Order          @relation(fields: [orderId], references: [id])
  variantId       String
  variant         ProductVariant @relation(fields: [variantId], references: [id])
  quantity        Int
  priceAtPurchase Int                             // snapshot; never trust current price
}

// --- Phase 3: the editable home page ---

enum TileSurface { LIGHT WHITE DARK }
enum TileWidth   { FULL HALF }

/// One tile on the home page. The storefront renders this list in order; the
/// admin owns it, so changing the shop window does not need a deploy.
model HomeTile {
  id         String      @id @default(cuid())
  key        String      @unique       // stable handle: "hero-iphone"
  position   Int                       // render order; not unique, see notes
  published  Boolean     @default(false)
  width      TileWidth   @default(FULL)
  surface    TileSurface @default(LIGHT)
  headlineRu String
  headlineEn String
  subheadRu  String?
  subheadEn  String?
  imageUrl   String
  imageAltRu String?                   // null = decorative
  imageAltEn String?
  // Two CTAs at most, as columns rather than a child table: "one primary and
  // one ghost, no third" is a design rule (§5.3), and a child table would let
  // an admin add a fifth.
  primaryLabelRu   String?
  primaryLabelEn   String?
  primaryHref      String?
  secondaryLabelRu String?
  secondaryLabelEn String?
  secondaryHref    String?
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  @@index([published, position])
}
```

Notes:

- Cart is **not** persisted server-side in the MVP. It lives in Zustand on the
  client; the server only creates an `Order` at checkout and re-computes totals
  from the DB (never from client-sent prices).
- `priceAtPurchase` snapshots the price so history stays correct if prices change.
- **Checkout is guest-only for now.** Auth belongs to Phase 3, so Phase 2 shipped
  `Order.userId` as optional and made `email` the owner reference. When accounts
  arrive, a logged-in checkout simply fills `userId` in as well — no rewrite, and
  guest checkout stays as a first-class flow rather than being backed out.
- Category slugs are brand-neutral (`phones`, `laptops`) and the manufacturer
  lives in `Product.brand`. iMIX resells genuine Apple hardware, so real product
  names and photography are correct here — what stays iMIX's own is the brand
  around them (see the hard constraints in `CLAUDE.md`). The neutral slugs also
  keep the door open for a second manufacturer without a migration.
- Prisma 7 keeps the connection URL out of `schema.prisma`: migrations read it
  from `apps/api/prisma.config.ts`, the runtime client from the `pg` driver
  adapter in `PrismaService`.
- `HomeTile` is a **flat ordered list, not a tree**. Pairs are derived at render
  time: two consecutive `HALF` tiles become one `TilePair`. That keeps reordering
  in the admin a matter of changing one number, instead of moving rows between
  parents. The renderer needs one rule for a `HALF` with no partner — render it
  full width rather than dropping it, so a half-finished edit degrades instead of
  vanishing.
- `position` is **not** unique. A unique constraint turns "swap two tiles" into a
  three-step dance around a temporary value; instead the query orders by
  `(position, id)`, which is total and stable even when two tiles collide. Seeds
  leave gaps (10, 20, 30…) so a tile can be inserted between two others without
  renumbering.
- `key` is the stable handle the seed and any future migration name a tile by.
  It exists because `position` deliberately is not unique and `id` is generated —
  neither can be written down in advance.
- An action is **all or nothing**: a label without an href, or an href whose
  label was never translated, is dropped when the DTO is built rather than
  rendered as a dead button. A lone secondary is promoted to primary — the tile
  keeps its one thing to do.
- `primaryHref` is a path into this storefront (`/phones`, `/product/…`), not a
  free URL. Validate it against the known routes on write: a home page that can
  link anywhere is a home page that can link somewhere broken. **Not yet
  enforced** — the write side arrives with the admin.

## 3. API surface (REST)

Every read endpoint accepts `?locale=ru|en`, and every endpoint that returns a
price also accepts `?currency=RUB|USD`. Both default to the shop's own — Russian
and roubles — and both are validated against the lists in `@imix/types`, so an
unknown value is a 400 rather than a silent fallback. The response shape does not
change: the API resolves one language and one currency per request and the DTO
carries a single `name`, `price` and `currency`.

Public:

- `GET  /categories?locale=`
- `GET  /products?category=&featured=&page=&locale=&currency=`
- `GET  /products/:slug?locale=&currency=`
- `POST /orders?locale=` → validates stock, prices the lines in the body's
  `currency`, creates a PENDING order
- `GET  /home-tiles?locale=` → the published tiles of the home page, in order.
  Flat: pairing two `HALF` tiles is a layout decision, not an API one
- `GET  /orders/:id?locale=` → the confirmation page; the cuid is the only
  credential
- `POST /payments/intent` → returns the client secret for an order, charged in
  the order's own frozen currency
- `POST /auth/register` → always a USER; there is no way to ask for a role
- `POST /auth/login` · `POST /auth/refresh`

`POST /orders` additionally reads an optional bearer token: a signed-in buyer
gets `userId` on the order, a guest gets exactly what they got before. A token
it cannot verify is ignored rather than refused — the endpoint is public, so
there is nothing there to refuse.

Authenticated (USER):

- `GET  /auth/me` → the current account, read from the database rather than
  restated from the token
- `GET  /orders/me` → orders placed while signed in, newest first. Guest orders
  made with the same address are deliberately not included: matching on email
  would hand somebody's history to whoever registers with it later

Admin (ADMIN role guard):

- `POST/PATCH/DELETE /products` and `/products/:id/variants`
- `POST/PATCH/DELETE /categories`
- `POST/PATCH/DELETE /home-tiles` → the write side of the home page
- `GET  /admin/orders`
- `POST /upload` → returns hosted URL for image or .glb

Webhook:

- `POST /payments/webhook` → Stripe signs it; on `payment_intent.succeeded`
  the order moves PENDING → PAID and stock is decremented in a transaction.

### 3.1 Checkout and payment flow

```
/checkout  ──POST /orders───────►  price from DB, PENDING order
           ──POST /payments/intent►  Stripe PaymentIntent, client secret
           ──Stripe Elements─────►  card details go browser → Stripe, never via us
                                     │
/order/:id ◄──redirect / push───────┘
           ◄──POST /payments/webhook──  PENDING → PAID, stock decremented
```

Why it is ordered this way:

- The client sends variant ids, quantities and a currency. Prices, line totals
  and the order total are read from `ProductVariant` — a tampered cart changes
  nothing. The currency picks *which* stored price column is charged; it is
  required rather than defaulted, so nobody is billed in a currency they never
  saw, and it is frozen on the order together with the total.
- There is no exchange rate anywhere in the system. Each product carries a RUB
  price and a USD price set by hand, so no rounding can turn a listed price into
  a different charge. The cost is that switching currency has to *re-fetch* the
  cart rather than convert it (`lib/refresh-cart.ts`).
- The order exists before Stripe does, so the amount charged is always one the
  server decided on, and every payment has a record to attach itself to.
- Stock is *checked* at order time but only *decremented* when the webhook
  confirms payment, so abandoned checkouts never hold inventory. The tradeoff is
  that a variant can sell out in between; the webhook decrements with a
  `stock >= quantity` guard and logs an error rather than driving stock negative.
- The webhook is idempotent: it claims the order with a conditional
  `PENDING → PAID` update, and a redelivered event finds nothing to claim.
- Stripe can confirm in the browser before its webhook lands, so `/order/:id`
  re-fetches a few times while the order is still PENDING.
- Without `STRIPE_SECRET_KEY` the payment endpoints answer 503 and the storefront
  says so — the catalogue still runs for anyone who only wants to browse.

## 4. Frontend routes (Next.js App Router)

```
app/
├── [locale]/
│   ├── (storefront)/
│   │   ├── page.tsx                # home: hero (3D in Phase 5) + featured
│   │   ├── [category]/page.tsx     # catalog grid
│   │   ├── product/[slug]/page.tsx # detail + variant picker + 3D viewer
│   │   ├── cart/page.tsx
│   │   ├── checkout/page.tsx       # shipping form → Stripe Elements
│   │   └── order/[id]/page.tsx     # confirmation; RSC + client island for status
│   ├── (admin)/
│   │   └── admin/                  # dashboard, product CRUD, orders (Phase 3)
│   ├── layout.tsx                  # <html lang>, intl + currency providers
│   └── not-found.tsx
└── not-found.tsx                   # unrouted paths → default locale
```

- Catalog and product pages use Server Components + `fetch` to the API for SEO.
- Cart/checkout/admin are client-interactive.
- Admin protected by middleware checking the JWT role; API also enforces it
  (never trust the client alone).

### 4.1 Language and currency

- **Language** lives in the URL, via next-intl with `localePrefix: 'as-needed'`.
  Russian is the shop's language and sits on bare paths (`/phones`); English is
  prefixed (`/en/phones`). `src/messages/{ru,en}.json` hold the UI copy;
  `src/global.d.ts` types `t()` against the Russian catalogue, so a key added to
  one file and forgotten in the other fails to compile.
- **Currency** lives in a cookie (`imix-currency`), because a Server Component
  has to know which price to print before any JavaScript runs. `getRequestContext()`
  reads the pair on the server; `CurrencyProvider` carries it into client islands
  so a price rendered on either side cannot disagree.
- Reading that cookie makes every page dynamic. That is the deliberate trade —
  a price should not come from a cache that does not know the currency. Phase 4
  can win the static shell back with PPR.
- Product text is *not* in the message catalogues: names, descriptions and
  variant labels come from the database in both languages and are resolved by
  the API (§3).
- The cart holds denormalised copies of catalogue text and prices, so each line
  records the locale and currency it was captured in. Switching either re-fetches
  the affected products and restates the lines (`useCartRefresh`); the switch is
  only committed once that succeeds, so the cart can never disagree with the
  page around it.

### 4.2 The session

Two tokens, two cookies, and a clear split over who is allowed to believe them.

- **The API sets no cookies.** It answers `/auth/*` with tokens in the body. The
  web app's own route handlers under `app/api/auth/` call it and put the pair
  into httpOnly cookies (`imix-access`, `imix-refresh`). The two run on different
  origins, so an API-set cookie would need `SameSite=None; Secure` and would not
  survive local development.
- **The storefront does not verify signatures** (`lib/jwt-claims.ts`). Only the
  API holds the signing secret, and it checks every request against it. Decoding
  the cookie here decides which link the header shows and which page redirects —
  never what data anyone gets. Forging the cookie buys a signed-in looking page
  whose every request comes back 401.
- **The middleware renews the session** when the access token has aged out and a
  refresh token is still good. Not a preference: a Server Component cannot set a
  cookie, so there is nowhere else to do it, and without it a fifteen-minute
  access token would show a shopper as signed out while their session was fine.
  The new token is written onto the request as well as the response, so the page
  being rendered already sees it.
- **Refresh tokens are stateless JWTs**, with no table behind them. A single
  session therefore cannot be revoked before it expires; rotating
  `JWT_REFRESH_SECRET` invalidates all of them at once, which is the escape
  hatch until a session table earns its keep.
- **The checkout posts through `app/api/orders/`** rather than straight to the
  API. A client component cannot read an httpOnly cookie — that is the point of
  it — so the route handler is what turns the session into a bearer token.

## 5. Design language

The reference is Apple's own marketing site (`apple.com`). What we take from it
are **principles** — the layout system, the typographic ratios, the section
rhythm. What we do not take is its layout as such, its copy, its imagery
treatment or anything that would make iMIX read as an Apple property. The line:
a visitor should recognise the *category* of design and never mistake the *site*.

The numbers in the tile diagram are the reference's own, measured off the live
page so the ratios are real rather than eyeballed. The table in §5.2 is *our*
scale — deliberately not identical. Use `text-display` for the first tile on a
page and `text-headline` for the rest.

### 5.1 The tile

The marketing surface is not a page with sections — it is a **stack of
full-bleed tiles**, each one an independent unit:

```
┌──────────────────────────────────┐  ← the artwork fills the whole tile
│           Headline               │     ref: 56px / 600 / −0.005em / lh 1.07
│           Subhead                │     ref: 28px / 400 / +0.007em / lh 1.14
│        [ Primary ] [ Ghost ]     │     pill CTAs, side by side, 17px
│                                  │
│            device                │  ← sits low in the frame, clear of the copy
│                                  │
└──────────────────────────────────┘
   hairline gutter (--spacing-gutter)
┌───────────────┬──────────────────┐  ← a row may split into two half tiles
│   half tile   │    half tile     │
└───────────────┴──────────────────┘
```

The rules that make it work, and that we adopt:

- **One surface, not two.** The artwork covers the entire tile and the copy is
  set *on* it. A separate text band above a separate image band leaves a seam
  wherever the tile's own colour and the artwork's background differ — and they
  always differ, because the artwork brings its own gradient.
- **Text over the empty frame, never over the device.** Marketing artwork
  reserves its upper third for exactly this: in our banner shots the device
  starts around 39 % of the height. The copy lives above that line. This is the
  precise rule — "never over the photo" is too blunt and produces the seam above.
- That 39 % is a **proportion**, while a headline plus a subhead plus a row of
  pills is an **absolute** height. On a short, wide viewport the proportion
  shrinks below what the copy needs and the buttons land on the device. Two
  things hold the line: the tile heights carry an absolute floor
  (`max(88svh, 48rem)`), and display type only steps up at `lg`. Both numbers
  came from measuring, not taste — see the note in `PROMTS.md` 4.3.
- **One idea per tile.** A headline, one supporting line, at most two actions.
  A tile that needs a third sentence is two tiles.
- **Tiles alternate surface.** Light (`--color-surface-alt`), white and near-black
  in sequence, so the boundary between tiles needs no border — only a hairline
  gutter of page background.
- **Half tiles come in pairs** and each half keeps the full tile's internal
  proportions at a smaller scale. They stack to full width on mobile.
- The image is **absolutely positioned over the whole tile** with `object-cover`.
  Because the banner artwork is far wider than any tile, cover always fits the
  height exactly and trims the sides — which both enlarges the device and
  preserves the vertical placement the photographer framed. The tile's own
  `surface` then only decides the text colour, and shows as the ground on a tile
  that has no image yet.

### 5.1.1 Primitives

`apps/web/src/components/ui/` holds the implementation. They are Server
Components — the marketing surface costs no client JavaScript.

| Component    | What it is                                                        |
| ------------ | ----------------------------------------------------------------- |
| `Tile`       | One full-bleed unit. Props are the design rule: no third action.   |
| `TilePair`   | Two halves in a row. Takes its tiles as props, so it owns "half".  |
| `TileStack`  | The stack, with the hairline gutter between tiles.                 |
| `Button`     | Pill control, `primary` \| `ghost`. `ButtonLink` is the same as a link. |

Controls never take a "on dark?" prop. Each surface re-points a small set of
`--surface-*` custom properties (defined in `tokens.css`), so the same primary
button renders as a dark pill on a light tile and a light pill on a dark one
with no branching at the call site.

### 5.2 Type

Display type is set **tight and slightly negative**: line-height barely exceeds
the font size (1.05–1.1) and tracking goes negative as size goes up. The subhead
inverts both — roughly half the headline size, normal weight, *positive*
tracking. That contrast is what reads as "considered" and it is the single most
transferable thing about the reference.

| Role     | Token            | Size    | Weight | Tracking | Line-height |
| -------- | ---------------- | ------- | ------ | -------- | ----------- |
| Display  | `text-display`   | 4.5rem  | 600    | −0.03em  | 1.05        |
| Headline | `text-headline`  | 2.5rem  | 600    | −0.02em  | 1.1         |
| Subhead  | `text-subhead`   | 1.75rem | 400    | +0.007em | 1.15        |
| Body     | Tailwind default | 1rem    | 400    | 0        | —           |
| Caption  | `text-caption`   | 0.75rem | 400    | +0.06em  | 1.35        |

Tokens live in `packages/config/tailwind/tokens.css` and are the only place a
size is defined — no ad-hoc `text-[52px]` in components.

### 5.3 Controls

- **Buttons are full pills** (`border-radius: 980px`, i.e. "larger than it can
  ever need"), never rounded rectangles. Padding is generous horizontally and
  tight vertically.
- Exactly **two button roles**: a filled primary and a ghost/outline secondary.
  There is no third. A tile shows one or both, in that order.
- The nav is a **thin translucent bar** (~44px) with a blurred backdrop, small
  type, and no wordmark competing with the tile headline underneath.

### 5.4 Motion

- Entry animation is **reveal on scroll**, not decoration: opacity and a short
  upward translate, staggered by a few tens of milliseconds within a tile.
- Nothing bounces, nothing spins for its own sake. Duration under ~500 ms.
- Everything is gated behind `prefers-reduced-motion` — the tile must be
  complete and legible with all motion removed.

### 5.5 What this is not

- Not a colour-rich brand. Colour appears in the product photography and in
  exactly one accent; the page itself is neutral.
- Not dense. If a screen can hold more, that is not a reason to put more on it.
- Not a copy of the reference's sections, headlines or products-in-a-row layout.
  iMIX is a *retailer*: its tiles sell a range, not a launch.

## 6. The 3D layer (Phase 5)

- **Library:** React Three Fiber + `@react-three/drei` (`useGLTF`, `Stage`,
  `Environment`, `OrbitControls`) + GSAP `ScrollTrigger` for scroll storytelling.
- **Product viewer:** lazy-loaded `.glb`, wrapped in `<Suspense>` with a 2D image
  fallback; `OrbitControls` for interactive rotation on the detail page.
- **Hero:** a scroll-pinned section where a device model rotates / assembles as
  the user scrolls, driven by GSAP timelines.
- **Performance budget:** models under ~2–3 MB, Draco-compressed, lazy-loaded
  below the fold, `dpr` clamped, disabled on `prefers-reduced-motion`. 3D must
  never block first paint or hurt Core Web Vitals.
- Build the store fully without 3D first; 3D is an enhancement layer, never a
  dependency of core commerce flows.

## 7. Environments

- `.env` (api): `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
  `ADMIN_EMAIL` / `ADMIN_PASSWORD` (the seed's first admin),
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CLOUDINARY_*` / `S3_*`.
  The two JWT secrets are required in production and fall back to a development
  value with a warning elsewhere — auth cannot degrade into a 503 the way
  payments can.
- `.env.local` (web): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Local Postgres via Docker (`docker compose up db`) — add a compose file in Phase 1.

## 8. Build order (vertical slices)

1. Monorepo + tooling → Prisma schema + migration + seed → **one** category page
   and **one** product page rendering real seeded data. This proves the whole
   pipeline (DB → API → shared types → Next.js) before adding breadth.
2. Then commerce, then admin, then polish, then 3D (see roadmap in CLAUDE.md).
