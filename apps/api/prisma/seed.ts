import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Seed data for local development.
 *
 * Brands and devices here are invented for iMIX — no real manufacturer's
 * trademarks, copy or imagery (see the hard constraints in CLAUDE.md).
 * Image paths point at apps/web/public/products/; real artwork lands in Phase 4.
 *
 * Idempotent: every record is upserted on its natural key, so running the seed
 * repeatedly is safe.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set — copy apps/api/.env.example to apps/api/.env',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const MINOR_UNITS_PER_EURO = 100;

/** Prices are stored as integer minor units, never floats. `eur(1099)` → 109900. */
function eur(major: number, cents = 0): number {
  return major * MINOR_UNITS_PER_EURO + cents;
}

type VariantSeed = {
  sku: string;
  label: string;
  color: string;
  config: string;
  price: number;
  stock: number;
};

type ProductSeed = {
  slug: string;
  name: string;
  description: string;
  brand: string;
  basePrice: number;
  images: string[];
  featured: boolean;
  variants: VariantSeed[];
};

const categories = [
  { slug: 'phones', name: 'Phones' },
  { slug: 'laptops', name: 'Laptops' },
] as const;

const productsByCategory: Record<string, ProductSeed[]> = {
  phones: [
    {
      slug: 'nuvo-aster-7-pro',
      name: 'Nuvo Aster 7 Pro',
      description:
        'A 6.7" titanium-framed flagship with a variable-refresh display, three-lens camera system and two-day battery. Built for people who keep a phone for five years.',
      brand: 'Nuvo',
      basePrice: eur(1199),
      images: [
        '/products/nuvo-aster-7-pro-1.jpg',
        '/products/nuvo-aster-7-pro-2.jpg',
      ],
      featured: true,
      variants: [
        {
          sku: 'NUV-A7P-256-GRA',
          label: '256 GB · Graphite',
          color: 'Graphite',
          config: '256 GB',
          price: eur(1199),
          stock: 12,
        },
        {
          sku: 'NUV-A7P-512-GRA',
          label: '512 GB · Graphite',
          color: 'Graphite',
          config: '512 GB',
          price: eur(1349),
          stock: 7,
        },
        {
          sku: 'NUV-A7P-512-SND',
          label: '512 GB · Sandstone',
          color: 'Sandstone',
          config: '512 GB',
          price: eur(1349),
          stock: 3,
        },
      ],
    },
    {
      slug: 'nuvo-aster-7',
      name: 'Nuvo Aster 7',
      description:
        'The same silicon as the Pro in a lighter 6.1" aluminium body. Dual camera, all-day battery, and the cleanest software update record in the range.',
      brand: 'Nuvo',
      basePrice: eur(899),
      images: ['/products/nuvo-aster-7-1.jpg'],
      featured: false,
      variants: [
        {
          sku: 'NUV-A7-128-MID',
          label: '128 GB · Midnight',
          color: 'Midnight',
          config: '128 GB',
          price: eur(899),
          stock: 20,
        },
        {
          sku: 'NUV-A7-256-MID',
          label: '256 GB · Midnight',
          color: 'Midnight',
          config: '256 GB',
          price: eur(989),
          stock: 15,
        },
      ],
    },
  ],
  laptops: [
    {
      slug: 'lumen-slate-14',
      name: 'Lumen Slate 14',
      description:
        'A 1.2 kg fanless 14" laptop that runs cool and silent. Eighteen hours of real work per charge, and a keyboard worth typing a book on.',
      brand: 'Lumen',
      basePrice: eur(1449),
      images: [
        '/products/lumen-slate-14-1.jpg',
        '/products/lumen-slate-14-2.jpg',
      ],
      featured: true,
      variants: [
        {
          sku: 'LUM-S14-16-512-SLV',
          label: '16 GB · 512 GB · Silver',
          color: 'Silver',
          config: '16 GB RAM · 512 GB SSD',
          price: eur(1449),
          stock: 9,
        },
        {
          sku: 'LUM-S14-24-1TB-SLV',
          label: '24 GB · 1 TB · Silver',
          color: 'Silver',
          config: '24 GB RAM · 1 TB SSD',
          price: eur(1749),
          stock: 5,
        },
      ],
    },
    {
      slug: 'lumen-slate-16-pro',
      name: 'Lumen Slate 16 Pro',
      description:
        'Sixteen inches of colour-accurate display with the thermal headroom to sustain it. For compiling, colour grading and anything else that pins every core.',
      brand: 'Lumen',
      basePrice: eur(2399),
      images: ['/products/lumen-slate-16-pro-1.jpg'],
      featured: false,
      variants: [
        {
          sku: 'LUM-S16P-32-1TB-GRA',
          label: '32 GB · 1 TB · Graphite',
          color: 'Graphite',
          config: '32 GB RAM · 1 TB SSD',
          price: eur(2399),
          stock: 4,
        },
        {
          sku: 'LUM-S16P-48-2TB-GRA',
          label: '48 GB · 2 TB · Graphite',
          color: 'Graphite',
          config: '48 GB RAM · 2 TB SSD',
          price: eur(2999),
          stock: 2,
        },
      ],
    },
  ],
};

async function main(): Promise<void> {
  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: { slug: category.slug, name: category.name },
    });

    for (const product of productsByCategory[category.slug] ?? []) {
      const { variants, ...productData } = product;

      const savedProduct = await prisma.product.upsert({
        where: { slug: product.slug },
        update: { ...productData, categoryId: saved.id },
        create: { ...productData, categoryId: saved.id },
      });

      for (const variant of variants) {
        await prisma.productVariant.upsert({
          where: { sku: variant.sku },
          update: { ...variant, productId: savedProduct.id },
          create: { ...variant, productId: savedProduct.id },
        });
      }
    }
  }

  const [categoryCount, productCount, variantCount] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
  ]);

  process.stdout.write(
    `Seeded ${categoryCount} categories, ${productCount} products, ${variantCount} variants.\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.exitCode = 1;
    throw error;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
