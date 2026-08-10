import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MAX_ORDER_ITEM_QUANTITY } from '@imix/types';
import { AppModule } from '../src/app.module';

type Variant = { id: string; label: string; price: number; stock: number };

const PRODUCT_SLUG = 'iphone-17-pro';

const shipping = {
  name: 'Мила Орлова',
  address: 'ул. Тверская, 14',
  city: 'Москва',
  zip: '125009',
  country: 'RU',
};

const validBody = (items: { variantId: string; quantity: number }[]) => ({
  email: 'mila@example.com',
  currency: 'RUB',
  shipping,
  items,
});

// Needs the seeded database: `docker compose up -d db && pnpm --filter api db:seed`.
describe('orders endpoints', () => {
  let app: INestApplication;
  let variants: Variant[];
  /** The same variants priced in dollars, to prove the currency is honoured. */
  let usdVariants: Variant[];

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

    const inRoubles = await request(app.getHttpServer())
      .get(`/products/${PRODUCT_SLUG}?currency=RUB`)
      .expect(200);
    variants = inRoubles.body.variants;

    const inDollars = await request(app.getHttpServer())
      .get(`/products/${PRODUCT_SLUG}?currency=USD`)
      .expect(200);
    usdVariants = inDollars.body.variants;
  });

  afterAll(async () => {
    await app.close();
  });

  /** The cheapest in-stock variant — enough for the happy paths. */
  const firstVariant = (): Variant => {
    const [variant] = variants;
    if (!variant) throw new Error('seed has no variants to order');
    return variant;
  };

  describe('POST /orders', () => {
    it('creates a pending order and prices it from the database', async () => {
      const variant = firstVariant();

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send(validBody([{ variantId: variant.id, quantity: 2 }]))
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        status: 'PENDING',
        email: 'mila@example.com',
        total: variant.price * 2,
        currency: 'RUB',
        shipping,
        items: [
          {
            id: expect.any(String),
            variantId: variant.id,
            sku: expect.any(String),
            productSlug: PRODUCT_SLUG,
            productName: expect.any(String),
            variantLabel: variant.label,
            image: expect.any(String),
            quantity: 2,
            priceAtPurchase: variant.price,
          },
        ],
        createdAt: expect.any(String),
      });
    });

    it('charges the dollar price list when the order is placed in USD', async () => {
      const [rouble] = variants;
      const [dollar] = usdVariants;
      if (!rouble || !dollar) throw new Error('seed has no variants to order');

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send({
          ...validBody([{ variantId: dollar.id, quantity: 1 }]),
          currency: 'USD',
        })
        .expect(201);

      expect(response.body.currency).toBe('USD');
      expect(response.body.total).toBe(dollar.price);
      // Guards the point of storing both: the two lists are set by hand, so a
      // USD order must never fall back to the rouble column.
      expect(response.body.total).not.toBe(rouble.price);
    });

    it('freezes the currency on the order', async () => {
      const [dollar] = usdVariants;
      if (!dollar) throw new Error('seed has no variants to order');

      const created = await request(app.getHttpServer())
        .post('/orders')
        .send({
          ...validBody([{ variantId: dollar.id, quantity: 1 }]),
          currency: 'USD',
        })
        .expect(201);

      // Reading it back while browsing in roubles must not restate the charge.
      const response = await request(app.getHttpServer())
        .get(`/orders/${created.body.id}?locale=ru`)
        .expect(200);

      expect(response.body.currency).toBe('USD');
      expect(response.body.total).toBe(dollar.price);
    });

    it('ignores a client-supplied price and charges the catalogue price', async () => {
      const variant = firstVariant();

      // `forbidNonWhitelisted` means smuggling a price in is a 400, not a discount.
      await request(app.getHttpServer())
        .post('/orders')
        .send({
          ...validBody([{ variantId: variant.id, quantity: 1 }]),
          total: 1,
        })
        .expect(400);
    });

    it('collapses a repeated variant into one line', async () => {
      const variant = firstVariant();

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send(
          validBody([
            { variantId: variant.id, quantity: 1 },
            { variantId: variant.id, quantity: 2 },
          ]),
        )
        .expect(201);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].quantity).toBe(3);
      expect(response.body.total).toBe(variant.price * 3);
    });

    it('sums a multi-line order', async () => {
      const [first, second] = variants;
      if (!first || !second) throw new Error('seed needs two variants');

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send(
          validBody([
            { variantId: first.id, quantity: 1 },
            { variantId: second.id, quantity: 1 },
          ]),
        )
        .expect(201);

      expect(response.body.items).toHaveLength(2);
      expect(response.body.total).toBe(first.price + second.price);
    });

    it('normalises the email and country before storing them', async () => {
      const variant = firstVariant();

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send({
          email: '  Mila@Example.COM ',
          currency: 'RUB',
          shipping: { ...shipping, country: 'ru', name: '  Мила Орлова  ' },
          items: [{ variantId: variant.id, quantity: 1 }],
        })
        .expect(201);

      expect(response.body.email).toBe('mila@example.com');
      expect(response.body.shipping.country).toBe('RU');
      expect(response.body.shipping.name).toBe('Мила Орлова');
    });

    it('refuses more than the variant has in stock', async () => {
      const scarce = variants.find(
        (variant) => variant.stock < MAX_ORDER_ITEM_QUANTITY,
      );
      if (!scarce) throw new Error('seed has no variant below the line cap');

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send(validBody([{ variantId: scarce.id, quantity: scarce.stock + 1 }]))
        .expect(409);

      expect(response.body.message).toContain(scarce.label);
    });

    it('rejects an unknown variant', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send(validBody([{ variantId: 'c'.repeat(25), quantity: 1 }]))
        .expect(400);
    });

    it.each([
      ['no items', { items: [] }],
      ['a malformed email', { email: 'not-an-email' }],
      ['a missing shipping block', { shipping: undefined }],
      ['an empty city', { shipping: { ...shipping, city: '  ' } }],
      ['a non-ISO country', { shipping: { ...shipping, country: 'Россия' } }],
      ['an unknown property', { referrer: 'somewhere' }],
      ['a missing currency', { currency: undefined }],
      ['a currency the shop does not quote', { currency: 'EUR' }],
      ['a lowercase currency', { currency: 'rub' }],
    ])('rejects %s with 400', async (_label, patch) => {
      const variant = firstVariant();

      await request(app.getHttpServer())
        .post('/orders')
        .send({
          ...validBody([{ variantId: variant.id, quantity: 1 }]),
          ...patch,
        })
        .expect(400);
    });

    it.each([
      ['zero', 0],
      ['negative', -1],
      ['fractional', 1.5],
      ['above the per-line cap', MAX_ORDER_ITEM_QUANTITY + 1],
    ])('rejects a %s quantity with 400', async (_label, quantity) => {
      const variant = firstVariant();

      await request(app.getHttpServer())
        .post('/orders')
        .send(validBody([{ variantId: variant.id, quantity }]))
        .expect(400);
    });
  });

  describe('GET /orders/:id', () => {
    it('returns an order that was just placed', async () => {
      const variant = firstVariant();

      const created = await request(app.getHttpServer())
        .post('/orders')
        .send(validBody([{ variantId: variant.id, quantity: 1 }]))
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/orders/${created.body.id}`)
        .expect(200);

      expect(response.body).toEqual(created.body);
    });

    it('reads product text back in the requested language', async () => {
      const variant = firstVariant();

      const created = await request(app.getHttpServer())
        .post('/orders')
        .send(validBody([{ variantId: variant.id, quantity: 1 }]))
        .expect(201);

      const [russian, english] = await Promise.all([
        request(app.getHttpServer())
          .get(`/orders/${created.body.id}?locale=ru`)
          .expect(200),
        request(app.getHttpServer())
          .get(`/orders/${created.body.id}?locale=en`)
          .expect(200),
      ]);

      expect(russian.body.items[0].variantLabel).not.toBe(
        english.body.items[0].variantLabel,
      );
      // Only the wording moves — the frozen price does not.
      expect(russian.body.items[0].priceAtPurchase).toBe(
        english.body.items[0].priceAtPurchase,
      );
    });

    it('404s on an unknown id', async () => {
      await request(app.getHttpServer())
        .get(`/orders/${'z'.repeat(25)}`)
        .expect(404);
    });
  });
});
