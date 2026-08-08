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
    expect(slugs).toEqual(expect.arrayContaining(['phones', 'laptops']));

    const phones = response.body.find(
      (category: { slug: string }) => category.slug === 'phones',
    );
    expect(phones).toEqual({
      id: expect.any(String),
      slug: 'phones',
      name: 'Phones',
      productCount: expect.any(Number),
    });
    expect(phones.productCount).toBeGreaterThan(0);
  });
});
