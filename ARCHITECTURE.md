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
  id       String         @id @default(cuid())
  slug     String         @unique     // "iphone", "mac" — locale-independent
  nameRu   String
  nameEn   String
  position Int            @default(0) // header order; see the notes
  products Product[]
  groups   ProductGroup[]
}

/// A tab on a category page — "Laptops" under Mac. One level, never a tree.
model ProductGroup {
  id         String    @id @default(cuid())
  slug       String
  nameRu     String
  nameEn     String
  position   Int       @default(0)    // tab order
  categoryId String
  category   Category  @relation(fields: [categoryId], references: [id])
  products   Product[]

  @@unique([categoryId, slug])
  @@index([categoryId, position])
}

model Product {
  id            String           @id @default(cuid())
  slug          String           @unique
  nameRu        String
  nameEn        String
  descriptionRu String
  descriptionEn String
  taglineRu     String?                         // one line for the model card (§5.8)
  taglineEn     String?
  brand         String                          // "Apple" — never translated
  categoryId    String
  category      Category         @relation(fields: [categoryId], references: [id])
  groupId       String?                         // which tab of §5.8, if any
  group         ProductGroup?    @relation(fields: [groupId], references: [id])
  basePriceRub  Int                             // minor units (копейки)
  basePriceUsd  Int                             // minor units (cents)
  images        String[]
  navImageUrl   String?                         // cutout for the model rail (§5.8)
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
- `tagline` is **not** derived from `description`. A first sentence cut out of
  running text was never written to stand alone under a product name, and the
  cut would silently change whenever an admin edited the paragraph. Both columns
  are nullable and optional in the admin: a product without one renders a model
  card with one line fewer, which is a smaller problem than a bad line.
- `navImageUrl` exists because `images[0]` cannot do its job. The rail's chip is
  56px; a full-bleed marketing photograph at that size is a coloured square with
  no device visible in it. Null falls back to `images[0]`, so a category whose
  products have no cutouts still gets a rail.
- **Categories are the product lines the shop stocks** — `iphone`, `mac`, `ipad`,
  `watch`, `airpods`, plus `accessories` for what belongs to no line. They were
  brand-neutral once (`phones`, `laptops`), so that a second manufacturer would
  need no migration; that traded a real cost today for a hypothetical saving.
  A shopper looking for an iPhone reads "iPhone", and a section called
  "Smartphones" holding only iPhones was a category in name only. A second
  manufacturer would get its own sections, which is how a reseller's navigation
  works anyway.
- The manufacturer still lives in `Product.brand`. iMIX resells genuine Apple
  hardware, so real product names and photography are correct here — what stays
  iMIX's own is the brand around them (see the hard constraints in `CLAUDE.md`).
  Naming a *section* after a line it stocks is what a retailer does; it is not a
  claim to be that manufacturer.
- The seed is additive — it upserts and never deletes — so renaming the sections
  left the old rows behind empty. They were removed by hand once. A seed entry
  that disappears still has to be cleaned up in dev.
- `ProductGroup` is **one level, not a tree**. It exists to split a line-up too
  broad to scan in one row — Mac spans laptops, desktops and displays — and a
  category needing two levels of splitting is two categories. `Product.groupId`
  is nullable because most lines have nothing to split.
- A group is unique **per category**, not globally, and the admin refuses a
  product whose group belongs to a different category than its own. The foreign
  key alone would accept one, and the model would then sit under a tab its page
  never renders: invisible everywhere except the place nobody looks.
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
- `primaryHref` is a path into this storefront (`/iphone`, `/product/…`), not a
  free URL, and `StorefrontHrefService` resolves it against the real rows on
  every write: a category href must name a category that exists, a product href a
  product that exists. External URLs, paths more than one segment deep, query
  strings and a locale prefix (`/en/iphone` — the storefront's `Link` adds that
  itself) are all refused. A home page that can link anywhere is a home page that
  can link somewhere broken.
- An action is checked **on write** as well as forgiven on read. The reader drops
  a half-filled CTA because a row that already exists should still render; the
  writer refuses one, because somebody editing a tile would otherwise press save
  and watch their button not appear.
- Reordering rewrites every `position` as `(index + 1) * 10` rather than swapping
  two numbers. Positions are deliberately not unique, so a collision is a state
  the list can genuinely be in — and swapping two equal numbers is a no-op that
  looks like a broken button. Eight rows make this cheap, and it repairs any
  collision it finds.

## 3. API surface (REST)

Every read endpoint accepts `?locale=ru|en`, and every endpoint that returns a
price also accepts `?currency=RUB|USD`. Both default to the shop's own — Russian
and roubles — and both are validated against the lists in `@imix/types`, so an
unknown value is a 400 rather than a silent fallback. The response shape does not
change: the API resolves one language and one currency per request and the DTO
carries a single `name`, `price` and `currency`.

Public:

- `GET  /categories?locale=` → each carries its `groups`, the tabs its page
  offers (§5.8); the category page filters on them without a second request
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

- `GET  /admin/stats` → the dashboard's numbers: catalogue counts, orders by
  status, and revenue **once per currency**. Only PAID and SHIPPED count as
  revenue — a PENDING order is a checkout somebody may still abandon, and the
  two currency totals are never added together
- `GET/POST/PATCH/DELETE /admin/categories[/:id]`
- `GET/POST/PATCH/DELETE /admin/products[/:id]`
- `POST /admin/products/:id/variants` · `PATCH|DELETE /admin/variants/:id` → all
  three answer with the **whole product**, because any change to the variants
  moves its derived prices
- `POST /admin/upload` → one file in, its URL out
- `GET  /admin/orders?status=&page=&locale=` · `PATCH /admin/orders/:id`
- `GET/POST/PATCH/DELETE /admin/home-tiles[/:id]` · `POST /admin/home-tiles/:id/move`
  → the write side of the home page; the move answers with the whole list,
  because reordering renumbers all of it

The admin reads are not the storefront's reads: they carry **both languages and
both prices**, where the public DTOs resolve one of each. Two rules hold the
catalogue together on the write side:

- **`basePriceRub/Usd` are derived, never entered** — the cheapest variant in
  each currency, recomputed after every variant change. The grid prints them as
  "from …", so an entered value could disagree with what the variant picker
  charges. Each currency takes its own minimum: the two lists are set by hand and
  need not rank variants identically.
- **A product cannot exist without a variant**, which is why `POST /admin/products`
  takes them in the same request, and why deleting the last one is refused.

Deletion protects order history. `OrderItem` points at a `ProductVariant`, so a
product or variant that has been ordered answers 409 and the advice to set its
stock to zero; a category holding products answers 409 too. `AdminVariantDto.sold`
is what lets the form grey out the button before it is pressed.

The order book reuses `OrdersService` rather than growing a parallel mapper: what
the shopper reads on the confirmation page and what the admin reads in the list
are the same rows, and the one number that must never differ between them is the
total and the currency beside it.

**Who may move an order, and where** lives in `ADMIN_ORDER_TRANSITIONS` in
`@imix/types` — one list, enforced by the API and used by the UI to decide which
buttons exist, so an admin is never shown a button that comes back 409.

```
PENDING ──cancel──► CANCELLED          PAID and FAILED are absent from every
   │                    ▲              list: the payment webhook writes those.
   │  (webhook)         │              An admin who could type PAID could
   ▼                    │              record money that never arrived.
 PAID ────ship────► SHIPPED  (final)
   └──────cancel─────────────► CANCELLED  ← and the stock comes back
```

Cancelling a **paid** order returns its stock in the same transaction, because
`PaymentsService.markPaid` took that stock when the payment landed. Cancelling a
**pending** one does not: stock is reserved on payment, not at checkout, so there
is nothing to give back and inventing it would create inventory from nothing.

The guards sit on `AdminController` rather than on each handler, so a route
added under `/admin` is closed by default and opening one has to be deliberate.
The role travels inside the access token, so a promotion or demotion takes
effect at the next refresh rather than instantly — that is the price of not
reading the user table on every request.

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
│   │   ├── order/[id]/page.tsx     # confirmation; RSC + client island for status
│   │   └── account/page.tsx        # own details + order history; session required
│   ├── (admin)/
│   │   └── admin/                  # own chrome; dashboard now, CRUD in 3.3
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
  Russian is the shop's language and sits on bare paths (`/iphone`); English is
  prefixed (`/en/iphone`). `src/messages/{ru,en}.json` hold the UI copy;
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
- **The two languages are one page, not two.** Every public page declares a
  canonical for the language being served and an `hreflang` for each of the
  others, with `x-default` on Russian. Those URLs are built with `getPathname`
  from `lib/seo.ts` — never by joining `/${locale}${path}`, which would publish
  `/ru/iphone`, a page this shop does not serve. The sitemap follows the same
  rule: one `<url>` per page at its Russian address, with the English one as an
  alternate inside it.
- `NEXT_PUBLIC_SITE_URL` feeds `metadataBase`. Canonicals, `hreflang` and
  OpenGraph images are absolute, because a crawler has no request to resolve a
  path against.
- `robots.ts` disallows every path that belongs to one visitor — cart, checkout,
  order, sign-in, admin, `/api/` — **and the `/en` form of each**, since Russian
  sits on bare paths and `Disallow: /cart` would not cover `/en/cart`. An order
  URL is its own credential (§3), so it has no business in an index.
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

### 4.2.1 The account page

`/account` is the only thing a shopper account buys them today: their own
details, and the orders they placed while signed in.

- **Guest orders are deliberately absent.** `GET /orders/me` matches on
  `userId`, never on email — matching on the address would hand somebody's
  purchase history to whoever registers with it next. The page says so in as
  many words rather than leaving a gap somebody has to guess at.
- Both reads need the bearer token, which lives in an httpOnly cookie, so the
  page is a Server Component end to end. There is no client JavaScript on it at
  all, and nothing to fetch after paint.
- It is gated in the middleware alongside `/admin` (§4.3) and re-checked in the
  page, because a cookie can go stale between the two.
- It wears the storefront's chrome but not its tile language: headline type
  rather than display, a narrower column than the catalogue, and the only colour
  on the page is an order's status — green for money taken, red for a payment
  that failed, ink for the three ordinary states in between.

### 4.3 Who may see `/admin` and `/account`

Three layers, and only the last one decides.

Two gates of one shape, in `guardPrivate`: `/admin` asks for the ADMIN role,
`/account` asks only that somebody is signed in. `session-routes.ts` holds both
paths and the locale arithmetic — it is named for what it gates, not for the
admin alone, because it gates more than the admin.

1. **Middleware** redirects: nobody signed in goes to `/login?next=…` (locale
   and query preserved, the value narrowed by `safeReturnTo` so the login form
   cannot be talked into an off-site redirect); a signed-in shopper who is not
   an admin goes home, because asking them to sign in again would be a loop.
   That second case cannot arise on `/account`, where being signed in *is* the
   requirement.
2. **The page** checks again on the server — the admin layout for `/admin`, the
   page itself for `/account` — so a stale or hand-written cookie does not get a
   shell rendered for it.
3. **The API** guards every `/admin/*` route with `JwtAuthGuard` + `RolesGuard`,
   and `/auth/me` and `/orders/me` with `JwtAuthGuard`. This is the one that
   matters: getting past the first two buys an empty page whose every request
   answers 401 or 403.

The admin deliberately does **not** wear the storefront's chrome or its tile
language (§5). That is the marketing surface; this is a tool.

### 4.4 How the admin talks to the API

Its forms are client components, and a client component cannot read an httpOnly
cookie — that is the point of it being httpOnly. So every admin write goes to
`app/api/admin/[...path]/route.ts` on this origin, which attaches the bearer
token and passes the API's own status and message straight back. One catch-all
rather than a handler per endpoint: the shape of every call is identical, and
thirteen files that each attach a token would be thirteen chances to forget one.
The path is pinned under `/admin/`, and the API's role guard is still what
decides.

Server Components skip the proxy — they hold the token already (`requireAdminApi`)
and call the API directly through `lib/api.ts`. So the lists and the edit form's
initial data are rendered on the server, and only the mutations go round through
the route handler.

Money crosses that boundary twice, in opposite directions: the API speaks integer
minor units, the form speaks roubles and dollars. `lib/money-input.ts` is the only
place that converts, multiplies integers rather than floats, and accepts the
decimal comma a Russian keyboard produces.

### 4.5 Uploads

`POST /admin/upload` writes through an `AssetStorage` interface, chosen once at
boot:

- **`CloudinaryStorage`** when `CLOUDINARY_URL` is set — signed with `crypto` and
  posted with `fetch`, no SDK for what is one request.
- **`LocalDiskStorage`** otherwise — writes into `apps/web/public/uploads` so Next
  serves it at `/uploads/…`. A development default that only works while the two
  apps share a disk, and it warns as much at startup.

The stored filename is a hash of the contents, so the same photograph twice is one
file, and nothing an admin types reaches a path. The extension comes from the
sniffed MIME type, never from the filename — the name is the half of an upload an
attacker writes.

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
| `ModelCard`  | One model on a category page (§5.8). A card in a row, not a tile. |

Two more live in `components/` rather than `ui/`, because they take catalogue
data rather than presentational props: `CategoryModelNav` is the chip rail under
the page title, and `ModelCarousel` is the tab bar and scrolling row those cards
sit in — the one client component on the page.

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

`components/ui/reveal.tsx` is the whole implementation: an `IntersectionObserver`
and two CSS properties, no animation library. Three properties make it safe
rather than decorative, and they are the reason it is not a one-liner:

- **It starts visible.** The hidden state is applied by an effect, which runs
  only in the browser — so the server-rendered HTML, a crawler and a visitor with
  no JavaScript all see the content. The animation is layered on top; it is never
  what makes a tile appear.
- **Reduced motion skips it entirely**, checked in the same effect so the initial
  state is right too. Not a shorter animation — no animation.
- **Anything already on screen is left alone**, so the first tile is never hidden
  and faded back in on load.

GSAP and ScrollTrigger stay in Phase 5, where a scroll-driven 3D hero genuinely
needs a timeline.

### 5.6 Loading, empty and error

Three states, and a rule for each.

- **Loading** is a skeleton with the *shape* of what it replaces —
  `components/ui/skeleton.tsx`, used by a `loading.tsx` per route. The pulse is
  `motion-safe:` only. `LoadingScreen` makes one polite announcement for the
  whole screen, and the blocks themselves are `aria-hidden`: a grid of twelve
  cards must not read out twelve times.
- **Empty** is never a blank page. An unpublished shop window says so and offers
  the catalogue, which does not depend on it.
- **Error** is `error.tsx` with a retry, because the likeliest cause is one
  request that failed. The error itself is never shown — a stack trace tells a
  shopper nothing and describes the system to everyone else. `digest` is what
  ties the screen to a line in the server log.

### 5.7 Accessibility

Non-negotiables, checked against rendered HTML rather than intentions:

- Exactly one `h1` per page and **no skipped levels** — the catalogue grid's
  cards are `h2` under the page's `h1`, not `h3`.
- Every page's content is in `<main id="main-content">`, and the first thing in
  the tab order is a skip link to it. Six categories, two switchers and a cart
  link sit above every page; nobody should have to walk past them twice.
- `outline-none` only ever appears next to a `focus-visible:ring`.
- Live changes are announced politely and as a sentence: the cart badge carries
  "3 items in the cart" for a screen reader and the bare digit for everyone else.
- Decorative images take `alt=""`. A product photograph next to its own name is
  decorative; the gallery's main image is not, and says which view it is.

### 5.5 What this is not

- Not a colour-rich brand. Colour appears in the product photography and in
  exactly one accent; the page itself is neutral.
- Not dense. If a screen can hold more, that is not a reason to put more on it.
- Not a copy of the reference's sections or headlines. iMIX is a *retailer*: its
  tiles sell a range, not a launch.

  This rule is about the **tile stack** — the home page. It used to also forbid
  "products-in-a-row", which turned out to be too broad: a category page *is* a
  row of products, and pretending otherwise only produced a worse version of one.
  §5.8 is where that layout is described and bounded.

### 5.8 The category landing page

A category is not a search result, so `/[category]` is not a grid of everything.
It is a landing page for a line-up, in three bands:

```
┌──────────────────────────────────────────┐  bg-surface
│  Mac                                     │  h1, display type
│                                          │
│   [▯]     [▯]     [▯]     [▯]     [▯]    │  the model rail: cutout + name,
│  Air      Pro    iMac    mini   Studio   │  horizontally scrollable
├──────────────────────────────────────────┤  no border — the surface changes
│  Все модели.                             │  bg-surface-alt, h2
│                                          │
│  (Все)( Ноутбуки )( ПК )( Мониторы )     │  tabs — only where the line splits
│                                          │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌── │  the carousel; the cut-off card
│  │ photo  │  │ photo  │  │ photo  │  │   │  is what says it scrolls
│  └────────┘  └────────┘  └────────┘  └── │
│    name        name        name          │  h3
│    tagline     tagline     tagline       │  dropped when null
│    от 149 990 ₽                          │
│   ( Купить )  ( Купить )  ( Купить )     │  one pill, bottom-aligned
│                                          │
│                  ‹  ›                    │  hidden when the row fits
└──────────────────────────────────────────┘
```

The rules, and why each one is there:

- **Two bands, one page.** White for the name and the rail, `--color-surface-alt`
  for the models. The same alternating-surface trick as the tile stack (§5.1),
  which is what removes the need for a rule between them.
- **`py-section` sets the rhythm**, not ad-hoc padding. The token existed for
  this and had no caller until now.
- **The rail is a Server Component.** These are links to product pages and there
  is no selected state to track — we are on the category page, not on one of
  them. Horizontal scrolling is `overflow-x-auto` plus scroll snap. So the
  landing page, like the tile stack, costs no client JavaScript.
- **The rail disappears below two products.** A single chip is not a list to
  choose from, and three of the six categories hold one product. It owns its own
  top margin for the same reason: nothing rendered should leave a gap behind.
- **One pill per card, not two.** The reference pairs "learn more" with "buy",
  but both land on the same detail page here — the variant picker is on it — and
  a second button to the same place is decoration (§5.3).
- **The pill carries the product name in its `aria-label`.** It repeats the
  card's own link, and a column of identical "Купить" links tells a screen
  reader nothing.
- **Cards stretch to the tallest in the row** (`h-full` down the chain, `mt-auto`
  on the pill's wrapper). A two-line tagline next to a one-line one would
  otherwise leave the pills at different heights, which is the single thing that
  makes a row of cards look unconsidered.
- **Headings run h1 → h2 → h3** — category, "all models", model name. This is
  why `ModelCard` uses `h3` where `ProductCard` uses `h2` (§5.7).
- **The carousel is full-bleed, the heading and controls are not.** The row runs
  to both edges of the screen while its first card stays flush with the heading
  above it — that tail running off the screen is what says it scrolls, where a
  row stopping at a margin looks like it simply ended. `.bleed-row` in
  `globals.css` does both halves: its inset is a percentage of the full-width
  parent rather than `50vw`, because `vw` includes the scrollbar gutter and
  would give the body a horizontal scrollbar of its own. It sets
  `scroll-padding-inline` to the same value — snapping measures from the
  scrollport edge and ignores padding, so without it the first card snaps to
  the screen edge and undoes the alignment the moment the row is touched.
- **The two rows treat their artwork differently, because it is different art.**

  A **model card** fills its square well edge to edge — `object-cover`, no
  padding. Catalogue shots bring their own ground, a gradient or a black stage,
  and insetting one on white frames a photograph inside a photograph. Same rule
  as the tile in §5.1: one surface, not two.

  A **chip in the rail** is a cutout on no ground at all, so it is
  `object-contain object-bottom` in a 56px box. Contain because there is nothing
  to crop, and *bottom* because contain leaves slack: centring that slack floats
  a flat Mac mini in mid-air beside an iMac that fills its box, and the row
  reads as scattered. Bottom-aligning stands every device on one line — measured
  at a single pixel across all seven Macs.
- **The tagline is dark and medium-weight**, not muted. On a model card it is
  the line that distinguishes two models from each other, so it carries weight
  rather than sitting back from the name the way body copy does.
- **The models are a carousel, and the cards inside it are still server-rendered.**
  `ModelCarousel` is the only `'use client'` file on the page — tabs and scroll
  position are state. The cards are rendered on the server and handed to it as
  nodes on `slides`, so the product markup never ships as JavaScript.
- **Arrows are hidden, not disabled, when the row fits.** They step by one
  measured card plus the rail's own gap, and honour `prefers-reduced-motion` by
  jumping instead of animating. The rail itself is focusable, because a
  keyboard user must be able to reach the overflow without tabbing through
  every card to get there.
- **Scrollbars are hidden on both rows** (`.scrollbar-none`, defined in
  `globals.css`) — and only there, because each says it scrolls by other means:
  the rail cuts its last chip off at the viewport edge, the carousel has arrows.
- **Tabs come from `ProductGroup`, and appear only where a line splits.** Mac has
  Laptops / Desktops / Displays; no other category has any, and fewer than two
  renders no tab bar. They filter on the client: a category holds at most a page
  of models and they are already loaded, so a tab is an instant change of what
  is shown rather than a refetch.
- The tab bar is a group of buttons with `aria-pressed`, **not** a `tablist`. A
  tablist promises arrow-key movement between tabs and a `tabpanel` to land in;
  this is a filter over one list that stays where it is.

What is deliberately *not* taken from the reference: its section order, its copy,
its financing lines, its colour-swatch dots, and its blue. The taglines are
written as a retailer who has handled the device — never translated or
paraphrased from the manufacturer's own marketing (see `CLAUDE.md`).

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
