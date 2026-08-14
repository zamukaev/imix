import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AdminOrderDto, OrderStatus, Paginated } from '@imix/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PREFIX = 'e2e-orders-admin-';
const SKU_PREFIX = 'E2E-OA-';
const PASSWORD = 'correct-horse-battery';
const ADMIN_EMAIL = `${PREFIX}admin@example.com`;
const SHOPPER_EMAIL = `${PREFIX}shopper@example.com`;

const STARTING_STOCK = 10;
const ORDERED_QUANTITY = 3;
const RUB_TOTAL = 14_999_000;
const USD_TOTAL = 109_900;

const shipping = {
  shippingName: 'Мила Орлова',
  shippingAddress: 'ул. Тверская, 14',
  shippingCity: 'Москва',
  shippingZip: '125009',
  shippingCountry: 'RU',
};

// Needs the seeded database: `docker compose up -d db && pnpm --filter api db:seed`.
describe('admin order book', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let shopperToken: string;
  let variantId: string;

  const authed = (method: 'get' | 'patch', path: string) =>
    request(app.getHttpServer())[method](path).set(
      'authorization',
      `Bearer ${adminToken}`,
    );

  /** One order, with a line against the fixture variant. */
  const placeOrder = async (
    status: OrderStatus,
    currency: 'RUB' | 'USD' = 'RUB',
  ): Promise<string> => {
    const order = await prisma.order.create({
      data: {
        email: `${PREFIX}buyer@example.com`,
        status,
        total: currency === 'RUB' ? RUB_TOTAL : USD_TOTAL,
        currency,
        ...shipping,
        items: {
          create: [
            {
              variantId,
              quantity: ORDERED_QUANTITY,
              priceAtPurchase: currency === 'RUB' ? RUB_TOTAL : USD_TOTAL,
            },
          ],
        },
      },
      select: { id: true },
    });

    return order.id;
  };

  const stockNow = async (): Promise<number> => {
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stock: true },
    });

    return variant.stock;
  };

  const setStatus = (id: string, status: OrderStatus) =>
    authed('patch', `/admin/orders/${id}`).send({ status });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    await cleanUp(prisma);

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(201);
    await prisma.user.update({
      where: { id: registered.body.user.id },
      data: { role: 'ADMIN' },
    });
    adminToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: PASSWORD })
        .expect(200)
    ).body.accessToken;

    shopperToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: SHOPPER_EMAIL, password: PASSWORD })
        .expect(201)
    ).body.accessToken;
  });

  beforeEach(async () => {
    await cleanUpOrders(prisma);

    const category = await prisma.category.upsert({
      where: { slug: `${PREFIX}category` },
      update: {},
      create: { slug: `${PREFIX}category`, nameRu: 'Тесты', nameEn: 'Tests' },
    });
    const product = await prisma.product.upsert({
      where: { slug: `${PREFIX}product` },
      update: {},
      create: {
        slug: `${PREFIX}product`,
        nameRu: 'Тестовый товар',
        nameEn: 'Test product',
        descriptionRu: 'Описание.',
        descriptionEn: 'Description.',
        brand: 'Apple',
        categoryId: category.id,
        basePriceRub: RUB_TOTAL,
        basePriceUsd: USD_TOTAL,
        images: [],
      },
    });
    const variant = await prisma.productVariant.upsert({
      where: { sku: `${SKU_PREFIX}1` },
      update: { stock: STARTING_STOCK },
      create: {
        sku: `${SKU_PREFIX}1`,
        labelRu: 'Вариант',
        labelEn: 'Variant',
        priceRub: RUB_TOTAL,
        priceUsd: USD_TOTAL,
        stock: STARTING_STOCK,
        productId: product.id,
      },
    });
    variantId = variant.id;
  });

  afterAll(async () => {
    await cleanUp(prisma);
    await app.close();
  });

  describe('the role gate', () => {
    it('answers 401 without a token', async () => {
      await request(app.getHttpServer()).get('/admin/orders').expect(401);
    });

    it('answers 403 for a signed-in shopper', async () => {
      await request(app.getHttpServer())
        .get('/admin/orders')
        .set('authorization', `Bearer ${shopperToken}`)
        .expect(403);
    });
  });

  describe('GET /admin/orders', () => {
    it('lists orders newest first, with a page envelope', async () => {
      await placeOrder('PENDING');
      const newest = await placeOrder('PAID');

      const response = await authed('get', '/admin/orders?pageSize=5').expect(200);
      const page: Paginated<AdminOrderDto> = response.body;

      expect(page.items[0]?.id).toBe(newest);
      expect(page.pageSize).toBe(5);
      expect(page.total).toBeGreaterThanOrEqual(2);
    });

    it('keeps every amount next to the currency it was charged in', async () => {
      // The list mixes the two, adjacent rows at a time — an amount without its
      // currency beside it is a number that means two different things.
      const roubles = await placeOrder('PAID', 'RUB');
      const dollars = await placeOrder('PAID', 'USD');

      const { body } = await authed('get', '/admin/orders?status=PAID').expect(200);
      const byId = new Map(
        (body as Paginated<AdminOrderDto>).items.map((order) => [order.id, order]),
      );

      expect(byId.get(roubles)).toMatchObject({ total: RUB_TOTAL, currency: 'RUB' });
      expect(byId.get(dollars)).toMatchObject({ total: USD_TOTAL, currency: 'USD' });
    });

    it('narrows to one status', async () => {
      await placeOrder('PENDING');
      await placeOrder('SHIPPED');

      const { body } = await authed('get', '/admin/orders?status=SHIPPED').expect(200);

      expect((body as Paginated<AdminOrderDto>).items.length).toBeGreaterThan(0);
      for (const order of (body as Paginated<AdminOrderDto>).items) {
        expect(order.status).toBe('SHIPPED');
      }
    });

    it('writes the lines in the language it was asked for', async () => {
      await placeOrder('PAID');

      const [russian, english] = await Promise.all([
        authed('get', '/admin/orders?locale=ru&status=PAID').expect(200),
        authed('get', '/admin/orders?locale=en&status=PAID').expect(200),
      ]);

      expect(russian.body.items[0].items[0].variantLabel).toBe('Вариант');
      expect(english.body.items[0].items[0].variantLabel).toBe('Variant');
    });

    it('says whether an order has an account behind it', async () => {
      await placeOrder('PENDING');

      const { body } = await authed('get', '/admin/orders?status=PENDING').expect(200);

      // Guest checkout stays a first-class flow, so this is null far more often
      // than not — and the list should say so rather than imply an account.
      expect(body.items[0].userId).toBeNull();
    });

    it('rejects a status the shop does not have', async () => {
      await authed('get', '/admin/orders?status=REFUNDED').expect(400);
    });
  });

  describe('PATCH /admin/orders/:id', () => {
    it('moves a paid order to shipped', async () => {
      const id = await placeOrder('PAID');

      const response = await setStatus(id, 'SHIPPED').expect(200);

      expect(response.body.status).toBe('SHIPPED');
      expect(response.body.currency).toBe('RUB');
    });

    it.each([
      ['a pending order to paid', 'PENDING', 'PAID'],
      ['a pending order to shipped', 'PENDING', 'SHIPPED'],
      ['a pending order to failed', 'PENDING', 'FAILED'],
      ['a shipped order to anything', 'SHIPPED', 'CANCELLED'],
      ['a cancelled order back to paid', 'CANCELLED', 'PAID'],
    ] as const)('refuses to move %s', async (_label, from, to) => {
      // PAID and FAILED are the payment provider's to write. An admin who could
      // type PAID could record money that never arrived.
      const id = await placeOrder(from);

      await setStatus(id, to).expect(409);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id } })).status,
      ).toBe(from);
    });

    it('is quiet when the status is already what was asked for', async () => {
      const id = await placeOrder('SHIPPED');

      // Pressing the same button twice is not an error, even though SHIPPED is
      // terminal — the answer is simply the order as it stands.
      const response = await setStatus(id, 'SHIPPED').expect(200);

      expect(response.body.status).toBe('SHIPPED');
    });

    it('gives the stock back when a paid order is cancelled', async () => {
      // The payment webhook took this stock when the money landed. Cancelling
      // without returning it loses inventory that was never sold.
      const id = await placeOrder('PAID');
      await prisma.productVariant.update({
        where: { id: variantId },
        data: { stock: STARTING_STOCK - ORDERED_QUANTITY },
      });

      await setStatus(id, 'CANCELLED').expect(200);

      expect(await stockNow()).toBe(STARTING_STOCK);
    });

    it('does not invent stock when a pending order is cancelled', async () => {
      // A pending order never held any: stock is reserved on payment, not on
      // checkout. Returning it here would create inventory out of nothing.
      const id = await placeOrder('PENDING');

      await setStatus(id, 'CANCELLED').expect(200);

      expect(await stockNow()).toBe(STARTING_STOCK);
    });

    it('404s on an unknown id', async () => {
      await setStatus('z'.repeat(25), 'CANCELLED').expect(404);
    });

    it('rejects a status outside the enum', async () => {
      const id = await placeOrder('PAID');

      await setStatus(id, 'REFUNDED' as OrderStatus).expect(400);
    });
  });
});

async function cleanUpOrders(prisma: PrismaService): Promise<void> {
  await prisma.orderItem.deleteMany({
    where: { order: { email: { startsWith: PREFIX } } },
  });
  await prisma.order.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

async function cleanUp(prisma: PrismaService): Promise<void> {
  await cleanUpOrders(prisma);
  await prisma.productVariant.deleteMany({
    where: { sku: { startsWith: SKU_PREFIX } },
  });
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}
