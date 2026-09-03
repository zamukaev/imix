import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/** Namespaced so the fixture is unmistakable, and removable, in a seeded database. */
const UNTAGGED_SLUG = 'e2e-products-untagged';

// Needs the seeded database: `docker compose up -d db && pnpm --filter api db:seed`.
describe('products endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    // Mirrors the pipe configured in main.ts so validation is exercised here too.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.get(PrismaService).product.deleteMany({
      where: { slug: UNTAGGED_SLUG },
    });
    await app.close();
  });

  describe('GET /products', () => {
    it('returns a paginated envelope of list items', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(response.body).toEqual({
        items: expect.any(Array),
        page: 1,
        pageSize: 12,
        total: expect.any(Number),
      });

      // `group` is checked apart from the rest because it is the one field whose
      // presence depends on *which* product sorted first — a Mac is filed under
      // a tab, an iPhone is not — and the list is ordered by `featured` then
      // `createdAt`, which is the seed's business rather than this test's.
      // Asserting `null` here only ever passed against a database whose first
      // row happened to be ungrouped, which is why it survived every local run
      // and failed on the first freshly seeded one.
      const { group, ...listItem } = response.body.items[0];

      expect(listItem).toEqual({
        id: expect.any(String),
        slug: expect.any(String),
        name: expect.any(String),
        tagline: expect.any(String),
        brand: expect.any(String),
        basePrice: expect.any(Number),
        currency: 'RUB',
        images: expect.any(Array),
        navImage: expect.any(String),
        featured: expect.any(Boolean),
        category: { slug: expect.any(String), name: expect.any(String) },
      });

      if (group !== null) {
        expect(group).toEqual({
          slug: expect.any(String),
          name: expect.any(String),
        });
      }
    });

    it('answers in Russian roubles when the request says nothing', async () => {
      const [bare, explicit] = await Promise.all([
        request(app.getHttpServer()).get('/products').expect(200),
        request(app.getHttpServer())
          .get('/products?locale=ru&currency=RUB')
          .expect(200),
      ]);

      expect(bare.body).toEqual(explicit.body);
    });

    it('prices the same catalogue differently per currency', async () => {
      const [roubles, dollars] = await Promise.all([
        request(app.getHttpServer()).get('/products?currency=RUB').expect(200),
        request(app.getHttpServer()).get('/products?currency=USD').expect(200),
      ]);

      expect(dollars.body.items[0].currency).toBe('USD');
      expect(dollars.body.items[0].id).toBe(roubles.body.items[0].id);
      expect(dollars.body.items[0].basePrice).not.toBe(
        roubles.body.items[0].basePrice,
      );
    });

    it('resolves the tagline into the requested language', async () => {
      const [russian, english] = await Promise.all([
        request(app.getHttpServer())
          .get('/products?category=iphone&locale=ru')
          .expect(200),
        request(app.getHttpServer())
          .get('/products?category=iphone&locale=en')
          .expect(200),
      ]);

      const [ru] = russian.body.items;
      const [en] = english.body.items;

      expect(ru.id).toBe(en.id);
      expect(ru.tagline).toEqual(expect.any(String));
      expect(en.tagline).toEqual(expect.any(String));
      expect(ru.tagline).not.toBe(en.tagline);
    });

    it('reports a missing tagline as null rather than an empty string', async () => {
      const prisma = app.get(PrismaService);
      const category = await prisma.category.findUniqueOrThrow({
        where: { slug: 'iphone' },
        select: { id: true },
      });

      await prisma.product.create({
        data: {
          slug: UNTAGGED_SLUG,
          nameRu: 'Без подписи',
          nameEn: 'Untagged',
          descriptionRu: 'Тестовый товар.',
          descriptionEn: 'A test product.',
          brand: 'Apple',
          categoryId: category.id,
          basePriceRub: 100,
          basePriceUsd: 100,
          images: [],
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/products/${UNTAGGED_SLUG}`)
        .expect(200);

      expect(response.body.tagline).toBeNull();
      expect(response.body.navImage).toBeNull();
    });

    // `accessories` rather than one of the product lines: "iPhone" and "Mac"
    // read the same in both catalogues, so they cannot show that the locale is
    // doing anything.
    it('translates category names without touching the slug', async () => {
      const [russian, english] = await Promise.all([
        request(app.getHttpServer())
          .get('/products?category=accessories&locale=ru')
          .expect(200),
        request(app.getHttpServer())
          .get('/products?category=accessories&locale=en')
          .expect(200),
      ]);

      expect(russian.body.items[0].category).toEqual({
        slug: 'accessories',
        name: 'Аксессуары',
      });
      expect(english.body.items[0].category).toEqual({
        slug: 'accessories',
        name: 'Accessories',
      });
    });

    it('omits description and variants from list items', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(response.body.items[0]).not.toHaveProperty('description');
      expect(response.body.items[0]).not.toHaveProperty('variants');
    });

    it('filters by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .query({ category: 'mac' })
        .expect(200);

      expect(response.body.total).toBeGreaterThan(0);
      for (const item of response.body.items) {
        expect(item.category.slug).toBe('mac');
      }
    });

    it('filters by featured', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .query({ featured: 'true' })
        .expect(200);

      expect(response.body.total).toBeGreaterThan(0);
      for (const item of response.body.items) {
        expect(item.featured).toBe(true);
      }
    });

    it('paginates', async () => {
      const firstPage = await request(app.getHttpServer())
        .get('/products')
        .query({ page: 1, pageSize: 1 })
        .expect(200);
      const secondPage = await request(app.getHttpServer())
        .get('/products')
        .query({ page: 2, pageSize: 1 })
        .expect(200);

      expect(firstPage.body.items).toHaveLength(1);
      expect(secondPage.body.items).toHaveLength(1);
      expect(firstPage.body.items[0].id).not.toBe(secondPage.body.items[0].id);
      expect(firstPage.body.total).toBe(secondPage.body.total);
    });

    it('returns an empty page past the end rather than an error', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .query({ page: 999 })
        .expect(200);

      expect(response.body.items).toEqual([]);
      expect(response.body.total).toBeGreaterThan(0);
    });

    it.each([
      ['a non-numeric page', { page: 'abc' }],
      ['a zero page', { page: 0 }],
      ['an oversized pageSize', { pageSize: 500 }],
      ['a non-boolean featured', { featured: 'yes' }],
      ['a malformed category slug', { category: 'Not A Slug' }],
      ['an unknown parameter', { sort: 'price' }],
      ['a language the shop does not speak', { locale: 'de' }],
      ['a currency the shop does not quote', { currency: 'EUR' }],
      ['a lowercase currency', { currency: 'usd' }],
    ])('rejects %s with 400', async (_label, query) => {
      await request(app.getHttpServer())
        .get('/products')
        .query(query)
        .expect(400);
    });
  });

  describe('GET /products/:slug', () => {
    it('returns the full product with its variants', async () => {
      const response = await request(app.getHttpServer())
        .get('/products/iphone-17-pro')
        .expect(200);

      expect(response.body).toEqual({
        id: expect.any(String),
        slug: 'iphone-17-pro',
        name: expect.any(String),
        tagline: expect.any(String),
        brand: 'Apple',
        description: expect.any(String),
        basePrice: expect.any(Number),
        currency: 'RUB',
        images: expect.any(Array),
        navImage: expect.any(String),
        featured: true,
        group: null,
        model3dUrl: null,
        category: { slug: 'iphone', name: 'iPhone' },
        variants: expect.any(Array),
      });

      expect(response.body.variants.length).toBeGreaterThan(0);
      expect(response.body.variants[0]).toEqual({
        id: expect.any(String),
        sku: expect.any(String),
        label: expect.any(String),
        color: expect.any(String),
        config: expect.any(String),
        price: expect.any(Number),
        stock: expect.any(Number),
      });
    });

    it.each(['RUB', 'USD'])(
      'orders variants by ascending price in %s',
      async (currency) => {
        const response = await request(app.getHttpServer())
          .get(`/products/iphone-17-pro?currency=${currency}`)
          .expect(200);

        const prices = response.body.variants.map(
          (variant: { price: number }) => variant.price,
        );
        expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));
      },
    );

    it('writes the description and variant labels in the requested language', async () => {
      const [russian, english] = await Promise.all([
        request(app.getHttpServer())
          .get('/products/iphone-17-pro?locale=ru')
          .expect(200),
        request(app.getHttpServer())
          .get('/products/iphone-17-pro?locale=en')
          .expect(200),
      ]);

      expect(russian.body.description).not.toBe(english.body.description);
      expect(russian.body.variants[0].label).not.toBe(
        english.body.variants[0].label,
      );
      // The brand reads the same in both — it is a name, not a translation.
      expect(russian.body.brand).toBe(english.body.brand);
    });

    it('404s on an unknown slug', async () => {
      await request(app.getHttpServer())
        .get('/products/does-not-exist')
        .expect(404);
    });
  });
});
