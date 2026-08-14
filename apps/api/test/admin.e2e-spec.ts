import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CURRENCIES, ORDER_STATUSES, type AdminStatsDto } from '@imix/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/** Accounts and orders this spec creates, all findable by one prefix. */
const FIXTURE_PREFIX = 'e2e-admin-';
const email = (suffix: string): string => `${FIXTURE_PREFIX}${suffix}@example.com`;

const PASSWORD = 'correct-horse-battery';

/** Distinctive amounts, so an assertion points at the order that broke it. */
const PAID_RUB = 700_100;
const SHIPPED_RUB = 300_200;
const PAID_USD = 50_300;
/** Money that never moved — must not reach the revenue figures. */
const PENDING_RUB = 999_900;
const CANCELLED_USD = 888_800;

const shipping = {
  shippingName: 'Мила Орлова',
  shippingAddress: 'ул. Тверская, 14',
  shippingCity: 'Москва',
  shippingZip: '125009',
  shippingCountry: 'RU',
};

// Needs the seeded database: `docker compose up -d db && pnpm --filter api db:seed`.
describe('admin endpoints', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let shopperToken: string;

  const tokenFor = async (address: string, role: 'USER' | 'ADMIN') => {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: address, password: PASSWORD })
      .expect(201);

    if (role === 'ADMIN') {
      await prisma.user.update({
        where: { email: address },
        data: { role: 'ADMIN' },
      });

      // The role rides inside the access token, so the one issued a moment ago
      // still says USER. Signing in again is what picks the promotion up —
      // which is the documented cost of not hitting the database per request.
      const promoted = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: address, password: PASSWORD })
        .expect(200);

      return promoted.body.accessToken as string;
    }

    return registered.body.accessToken as string;
  };

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

    adminToken = await tokenFor(email('admin'), 'ADMIN');
    shopperToken = await tokenFor(email('shopper'), 'USER');

    // Five orders spanning both currencies and both sides of "was it paid".
    await prisma.order.createMany({
      data: [
        { email: email('orders'), status: 'PAID', total: PAID_RUB, currency: 'RUB', ...shipping },
        { email: email('orders'), status: 'SHIPPED', total: SHIPPED_RUB, currency: 'RUB', ...shipping },
        { email: email('orders'), status: 'PAID', total: PAID_USD, currency: 'USD', ...shipping },
        { email: email('orders'), status: 'PENDING', total: PENDING_RUB, currency: 'RUB', ...shipping },
        { email: email('orders'), status: 'CANCELLED', total: CANCELLED_USD, currency: 'USD', ...shipping },
      ],
    });
  });

  afterAll(async () => {
    await cleanUp(prisma);
    await app.close();
  });

  const fetchStats = async (token: string): Promise<AdminStatsDto> => {
    const response = await request(app.getHttpServer())
      .get('/admin/stats')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    return response.body;
  };

  describe('the role gate', () => {
    it('answers 401 without a token', async () => {
      await request(app.getHttpServer()).get('/admin/stats').expect(401);
    });

    it('answers 401 for a token it cannot verify', async () => {
      await request(app.getHttpServer())
        .get('/admin/stats')
        .set('authorization', 'Bearer not.a.token')
        .expect(401);
    });

    it('answers 403 for a signed-in shopper', async () => {
      // The distinction that matters: they are who they say they are, and still
      // may not. A 401 here would invite them to sign in again, forever.
      await request(app.getHttpServer())
        .get('/admin/stats')
        .set('authorization', `Bearer ${shopperToken}`)
        .expect(403);
    });

    it('lets an admin through', async () => {
      await request(app.getHttpServer())
        .get('/admin/stats')
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('GET /admin/stats', () => {
    it('counts the catalogue', async () => {
      const stats = await fetchStats(adminToken);

      expect(stats.catalogue.categories).toBeGreaterThan(0);
      expect(stats.catalogue.products).toBeGreaterThan(0);
      expect(stats.catalogue.variants).toBeGreaterThanOrEqual(
        stats.catalogue.products,
      );
      expect(stats.catalogue.outOfStockVariants).toBeLessThanOrEqual(
        stats.catalogue.variants,
      );
    });

    it('reports every order status, including the empty ones', async () => {
      const stats = await fetchStats(adminToken);

      expect(Object.keys(stats.orders.byStatus).sort()).toEqual(
        [...ORDER_STATUSES].sort(),
      );

      for (const status of ORDER_STATUSES) {
        expect(stats.orders.byStatus[status]).toBeGreaterThanOrEqual(0);
      }

      const summed = ORDER_STATUSES.reduce(
        (total, status) => total + stats.orders.byStatus[status],
        0,
      );
      expect(summed).toBe(stats.orders.total);
    });

    it('reports every currency the shop quotes, whether or not it has orders', async () => {
      const stats = await fetchStats(adminToken);

      expect(stats.revenue.map((entry) => entry.currency).sort()).toEqual(
        [...CURRENCIES].sort(),
      );
    });

    it('keeps the currencies apart and counts only money that moved', async () => {
      // The whole point of the split: there is no rate in this system, so the
      // dashboard reports two figures rather than one made-up one. PENDING and
      // CANCELLED belong to neither.
      //
      // Asserted against the database rather than against a remembered "before"
      // figure. `/admin/stats` is deliberately shop-wide, so a delta only holds
      // if nothing else writes an order in between — which was a promise this
      // spec could not keep once other suites started placing paid orders in the
      // same database. Comparing the endpoint to the rows is the claim that was
      // actually being made.
      await prisma.order.createMany({
        data: [
          { email: email('delta'), status: 'PAID', total: PAID_RUB, currency: 'RUB', ...shipping },
          { email: email('delta'), status: 'PENDING', total: PENDING_RUB, currency: 'USD', ...shipping },
        ],
      });

      const stats = await fetchStats(adminToken);

      for (const currency of CURRENCIES) {
        const settled = await prisma.order.aggregate({
          where: { currency, status: { in: ['PAID', 'SHIPPED'] } },
          _sum: { total: true },
          _count: { _all: true },
        });
        const reported = stats.revenue.find((entry) => entry.currency === currency);

        expect(reported?.total).toBe(settled._sum.total ?? 0);
        expect(reported?.orders).toBe(settled._count._all);
      }

      // And the pending dollar order this test just placed is in neither figure.
      const pending = await prisma.order.aggregate({
        where: { email: email('delta'), status: 'PENDING' },
        _sum: { total: true },
      });
      expect(pending._sum.total).toBe(PENDING_RUB);
    });
  });
});

async function cleanUp(prisma: PrismaService): Promise<void> {
  await prisma.order.deleteMany({ where: { email: { startsWith: FIXTURE_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: FIXTURE_PREFIX } } });
}
