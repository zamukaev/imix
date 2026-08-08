import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

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

      expect(response.body.items[0]).toEqual({
        id: expect.any(String),
        slug: expect.any(String),
        name: expect.any(String),
        brand: expect.any(String),
        basePrice: expect.any(Number),
        images: expect.any(Array),
        featured: expect.any(Boolean),
        category: { slug: expect.any(String), name: expect.any(String) },
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
        .query({ category: 'laptops' })
        .expect(200);

      expect(response.body.total).toBeGreaterThan(0);
      for (const item of response.body.items) {
        expect(item.category.slug).toBe('laptops');
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
        .get('/products/nuvo-aster-7-pro')
        .expect(200);

      expect(response.body).toEqual({
        id: expect.any(String),
        slug: 'nuvo-aster-7-pro',
        name: expect.any(String),
        brand: 'Nuvo',
        description: expect.any(String),
        basePrice: expect.any(Number),
        images: expect.any(Array),
        featured: true,
        model3dUrl: null,
        category: { slug: 'phones', name: 'Phones' },
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

    it('orders variants by ascending price', async () => {
      const response = await request(app.getHttpServer())
        .get('/products/nuvo-aster-7-pro')
        .expect(200);

      const prices = response.body.variants.map(
        (variant: { price: number }) => variant.price,
      );
      expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));
    });

    it('404s on an unknown slug', async () => {
      await request(app.getHttpServer())
        .get('/products/does-not-exist')
        .expect(404);
    });
  });
});
