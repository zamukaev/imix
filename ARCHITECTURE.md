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
  slug     String    @unique          // "iphone", "macbook"
  name     String
  products Product[]
}

model Product {
  id          String           @id @default(cuid())
  slug        String           @unique
  name        String
  description String
  brand       String
  categoryId  String
  category    Category         @relation(fields: [categoryId], references: [id])
  basePrice   Int                               // minor units (cents)
  images      String[]
  model3dUrl  String?                           // .glb for R3F viewer (Phase 5)
  featured    Boolean          @default(false)
  variants    ProductVariant[]
  createdAt   DateTime         @default(now())
}

model ProductVariant {
  id         String      @id @default(cuid())
  productId  String
  product    Product     @relation(fields: [productId], references: [id])
  sku        String      @unique
  label      String                             // "256GB · Space Black"
  color      String?
  config     String?                            // storage / RAM etc.
  price      Int                                // minor units
  stock      Int         @default(0)
  orderItems OrderItem[]
}

model Order {
  id                    String      @id @default(cuid())
  userId                String
  user                  User        @relation(fields: [userId], references: [id])
  status                OrderStatus @default(PENDING)
  total                 Int
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
```

Notes:

- Cart is **not** persisted server-side in the MVP. It lives in Zustand on the
  client; the server only creates an `Order` at checkout and re-computes totals
  from the DB (never from client-sent prices).
- `priceAtPurchase` snapshots the price so history stays correct if prices change.

## 3. API surface (REST)

Public:

- `GET  /categories`
- `GET  /products?category=&featured=&page=`
- `GET  /products/:slug`
- `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh`

Authenticated (USER):

- `GET  /orders/me`
- `POST /orders` → validates stock, computes total, creates PENDING order
- `POST /payments/intent` → returns Stripe client secret for an order

Admin (ADMIN role guard):

- `POST/PATCH/DELETE /products` and `/products/:id/variants`
- `POST/PATCH/DELETE /categories`
- `GET  /admin/orders`
- `POST /upload` → returns hosted URL for image or .glb

Webhook:

- `POST /payments/webhook` → Stripe signs it; on `payment_intent.succeeded`
  the order moves PENDING → PAID and stock is decremented in a transaction.

## 4. Frontend routes (Next.js App Router)

```
app/
├── (storefront)/
│   ├── page.tsx                # home: hero (3D in Phase 5) + featured
│   ├── [category]/page.tsx     # catalog grid
│   ├── product/[slug]/page.tsx # detail + variant picker + 3D viewer
│   ├── cart/page.tsx
│   └── checkout/page.tsx       # Stripe Elements
├── (admin)/
│   └── admin/
│       ├── page.tsx            # dashboard
│       ├── products/…          # CRUD
│       └── orders/page.tsx
└── layout.tsx
```

- Catalog and product pages use Server Components + `fetch` to the API for SEO.
- Cart/checkout/admin are client-interactive.
- Admin protected by middleware checking the JWT role; API also enforces it
  (never trust the client alone).

## 5. The 3D layer (Phase 5)

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

## 6. Environments

- `.env` (api): `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CLOUDINARY_*` / `S3_*`.
- `.env.local` (web): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Local Postgres via Docker (`docker compose up db`) — add a compose file in Phase 1.

## 7. Build order (vertical slices)

1. Monorepo + tooling → Prisma schema + migration + seed → **one** category page
   and **one** product page rendering real seeded data. This proves the whole
   pipeline (DB → API → shared types → Next.js) before adding breadth.
2. Then commerce, then admin, then polish, then 3D (see roadmap in CLAUDE.md).
