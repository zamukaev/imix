import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// Needs the seeded database: `docker compose up -d db && pnpm --filter api db:seed`.
describe('GET /categories', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the seeded categories with their product counts', async () => {
    const response = await request(app.getHttpServer())
      .get('/categories')
      .expect(200);

    const slugs = response.body.map(
      (category: { slug: string }) => category.slug,
    );
    expect(slugs).toEqual(expect.arrayContaining(['iphone', 'mac']));

    const iphone = response.body.find(
      (category: { slug: string }) => category.slug === 'iphone',
    );
    expect(iphone).toEqual({
      id: expect.any(String),
      slug: 'iphone',
      name: 'iPhone',
      productCount: expect.any(Number),
      // No tabs on this line — the category page shows none.
      groups: [],
    });
    expect(iphone.productCount).toBeGreaterThan(0);
  });

  it('carries a category’s tabs, in order and in the requested language', async () => {
    const [russian, english] = await Promise.all([
      request(app.getHttpServer()).get('/categories').expect(200),
      request(app.getHttpServer()).get('/categories?locale=en').expect(200),
    ]);

    const find = (body: { slug: string; groups: { slug: string; name: string }[] }[]) =>
      body.find((category) => category.slug === 'mac')?.groups ?? [];

    expect(find(english.body)).toEqual([
      { slug: 'laptops', name: 'Laptops' },
      { slug: 'desktops', name: 'Desktops' },
      { slug: 'displays', name: 'Displays' },
    ]);
    // Same order, other language — position drives it, not the alphabet.
    expect(find(russian.body).map((group) => group.slug)).toEqual([
      'laptops',
      'desktops',
      'displays',
    ]);
    expect(find(russian.body)[0]?.name).toBe('Ноутбуки');
  });

  it('files every Mac model under one of those tabs', async () => {
    const response = await request(app.getHttpServer())
      .get('/products?category=mac&locale=en')
      .expect(200);

    for (const item of response.body.items) {
      expect(item.group).toEqual({
        slug: expect.any(String),
        name: expect.any(String),
      });
    }
  });

  // `accessories`, because a product line's name is the same in both
  // catalogues — "iPhone" would pass this test with the locale ignored.
  it('names the categories in English when asked to', async () => {
    const [russian, english] = await Promise.all([
      request(app.getHttpServer()).get('/categories').expect(200),
      request(app.getHttpServer()).get('/categories?locale=en').expect(200),
    ]);

    const find = (body: { slug: string; name: string }[]) =>
      body.find((category) => category.slug === 'accessories');

    expect(find(russian.body)?.name).toBe('Аксессуары');
    expect(find(english.body)?.name).toBe('Accessories');
  });
});
