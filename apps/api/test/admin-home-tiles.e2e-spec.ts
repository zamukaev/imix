import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AdminHomeTileDto } from '@imix/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PREFIX = 'e2e-tile-';
const PASSWORD = 'correct-horse-battery';
const ADMIN_EMAIL = `${PREFIX}admin@example.com`;
const SHOPPER_EMAIL = `${PREFIX}shopper@example.com`;

/** A category and a product the seed is guaranteed to have. */
const REAL_CATEGORY_HREF = '/iphone';
const REAL_PRODUCT_HREF = '/product/iphone-17-pro';

// Needs the seeded database: `docker compose up -d db && pnpm --filter api db:seed`.
describe('admin home tiles', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let shopperToken: string;

  const authed = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
    request(app.getHttpServer())[method](path).set(
      'authorization',
      `Bearer ${adminToken}`,
    );

  const tile = (overrides: Record<string, unknown> = {}) => ({
    key: `${PREFIX}hero`,
    published: true,
    width: 'FULL',
    surface: 'LIGHT',
    headlineRu: 'Заголовок',
    headlineEn: 'Headline',
    imageUrl: '/home/hero.jpg',
    ...overrides,
  });

  const createTile = async (
    overrides: Record<string, unknown> = {},
  ): Promise<AdminHomeTileDto> => {
    const response = await authed('post', '/admin/home-tiles')
      .send(tile(overrides))
      .expect(201);

    return response.body;
  };

  const ownTiles = async (): Promise<AdminHomeTileDto[]> => {
    const response = await authed('get', '/admin/home-tiles').expect(200);

    return response.body.filter((entry: AdminHomeTileDto) =>
      entry.key.startsWith(PREFIX),
    );
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
    await cleanUpTiles(prisma);
  });

  afterAll(async () => {
    await cleanUp(prisma);
    await app.close();
  });

  describe('the role gate', () => {
    it('answers 401 without a token', async () => {
      await request(app.getHttpServer()).get('/admin/home-tiles').expect(401);
    });

    it('answers 403 for a signed-in shopper', async () => {
      await request(app.getHttpServer())
        .get('/admin/home-tiles')
        .set('authorization', `Bearer ${shopperToken}`)
        .expect(403);
    });

    it('leaves the public read wide open', async () => {
      await request(app.getHttpServer()).get('/home-tiles').expect(200);
    });
  });

  describe('links are checked against the real storefront', () => {
    it.each([
      ['the home page', '/'],
      ['a category that exists', REAL_CATEGORY_HREF],
      ['a product that exists', REAL_PRODUCT_HREF],
      ['the cart', '/cart'],
    ])('accepts %s', async (_label, href) => {
      const created = await createTile({
        primaryLabelRu: 'Купить',
        primaryLabelEn: 'Buy',
        primaryHref: href,
      });

      expect(created.primaryHref).toBe(href);
    });

    it.each([
      ['a category nobody has', '/telephones'],
      ['a product nobody has', '/product/nothing-here'],
      ['a path two segments deep', '/phones/black'],
      ['an external site', 'https://example.com'],
      ['a locale prefix, which the storefront adds itself', '/en/phones'],
      ['a query string', '/phones?sort=price'],
    ])('refuses %s', async (_label, href) => {
      // A shop window that can link anywhere eventually links somewhere broken.
      const response = await authed('post', '/admin/home-tiles')
        .send(
          tile({ primaryLabelRu: 'Купить', primaryLabelEn: 'Buy', primaryHref: href }),
        )
        .expect(400);

      expect(response.body.message).toContain('goes nowhere');
    });

    it('checks the secondary link too', async () => {
      await authed('post', '/admin/home-tiles')
        .send(
          tile({
            secondaryLabelRu: 'Подробнее',
            secondaryLabelEn: 'Learn more',
            secondaryHref: '/nowhere-at-all',
          }),
        )
        .expect(400);
    });

    it('follows the catalogue: a link is valid once its category exists', async () => {
      const slug = `${PREFIX}fresh`;
      const href = `/${slug}`;

      await authed('post', '/admin/home-tiles')
        .send(tile({ primaryLabelRu: 'К', primaryLabelEn: 'K', primaryHref: href }))
        .expect(400);

      await prisma.category.create({
        data: { slug, nameRu: 'Новая', nameEn: 'Fresh' },
      });

      // Nothing was deployed in between — the check reads the same rows the
      // storefront routes from.
      await authed('post', '/admin/home-tiles')
        .send(tile({ primaryLabelRu: 'К', primaryLabelEn: 'K', primaryHref: href }))
        .expect(201);
    });
  });

  describe('an action is all or nothing', () => {
    it.each([
      ['a label with no link', { primaryLabelRu: 'Купить', primaryLabelEn: 'Buy' }],
      ['a link with no label', { primaryHref: REAL_CATEGORY_HREF }],
      [
        'a label in one language only',
        { primaryLabelRu: 'Купить', primaryHref: REAL_CATEGORY_HREF },
      ],
    ])('refuses %s', async (_label, overrides) => {
      // The storefront drops these silently, which is right for a row that
      // already exists and wrong for an edit somebody is making right now: they
      // would press save and watch nothing appear.
      const response = await authed('post', '/admin/home-tiles')
        .send(tile(overrides))
        .expect(400);

      expect(response.body.message).toContain('half-filled');
    });

    it('accepts a tile with no actions at all', async () => {
      const created = await createTile();

      expect(created.primaryHref).toBeNull();
      expect(created.secondaryHref).toBeNull();
    });
  });

  describe('both languages are required', () => {
    it.each([
      ['a missing Russian headline', { headlineRu: undefined }],
      ['a missing English headline', { headlineEn: undefined }],
      ['a blank English headline', { headlineEn: '  ' }],
    ])('refuses %s', async (_label, overrides) => {
      await authed('post', '/admin/home-tiles')
        .send(tile(overrides))
        .expect(400);
    });

    it.each([
      ['a width the design has no room for', { width: 'THIRD' }],
      ['a surface that does not exist', { surface: 'NEON' }],
      ['an image on another site', { imageUrl: 'http://example.com/a.jpg' }],
      ['a key with spaces', { key: 'two words' }],
    ])('refuses %s', async (_label, overrides) => {
      await authed('post', '/admin/home-tiles')
        .send(tile(overrides))
        .expect(400);
    });

    it('keeps a subhead in one language as null in the other', async () => {
      const created = await createTile({ subheadRu: 'Подзаголовок', subheadEn: '' });

      expect(created.subheadRu).toBe('Подзаголовок');
      // An empty field means "not set", not "set to nothing".
      expect(created.subheadEn).toBeNull();
    });
  });

  describe('drafts and publishing', () => {
    it('hides an unpublished tile from the storefront but not from the admin', async () => {
      const draft = await createTile({ published: false });

      const [publicTiles, adminTiles] = await Promise.all([
        request(app.getHttpServer()).get('/home-tiles').expect(200),
        ownTiles(),
      ]);

      expect(publicTiles.body.map((entry: { id: string }) => entry.id)).not.toContain(
        draft.id,
      );
      expect(adminTiles.map((entry) => entry.id)).toContain(draft.id);
    });

    it('publishes it with one field', async () => {
      const draft = await createTile({ published: false });

      await authed('patch', `/admin/home-tiles/${draft.id}`)
        .send(tile({ published: true }))
        .expect(200);

      const published = await request(app.getHttpServer())
        .get('/home-tiles')
        .expect(200);
      expect(
        published.body.map((entry: { id: string }) => entry.id),
      ).toContain(draft.id);
    });

    it('refuses a second tile on the same key', async () => {
      await createTile();

      await authed('post', '/admin/home-tiles').send(tile()).expect(409);
    });
  });

  describe('ordering', () => {
    it('puts a new tile at the end', async () => {
      const first = await createTile({ key: `${PREFIX}a` });
      const second = await createTile({ key: `${PREFIX}b` });

      expect(second.position).toBeGreaterThan(first.position);
    });

    it('moves a tile up past its neighbour', async () => {
      await createTile({ key: `${PREFIX}a` });
      const second = await createTile({ key: `${PREFIX}b` });

      const response = await authed(
        'post',
        `/admin/home-tiles/${second.id}/move`,
      )
        .send({ direction: 'UP' })
        .expect(200);

      const keys = (response.body as AdminHomeTileDto[])
        .filter((entry) => entry.key.startsWith(PREFIX))
        .map((entry) => entry.key);
      expect(keys).toEqual([`${PREFIX}b`, `${PREFIX}a`]);
    });

    it('separates tiles that shared a position', async () => {
      // `position` is not unique on purpose, so a collision is a state the list
      // can genuinely be in. Moving anything must resolve it rather than no-op.
      const first = await createTile({ key: `${PREFIX}a` });
      const second = await createTile({ key: `${PREFIX}b` });
      await prisma.homeTile.updateMany({
        where: { id: { in: [first.id, second.id] } },
        data: { position: 500 },
      });

      await authed('post', `/admin/home-tiles/${second.id}/move`)
        .send({ direction: 'UP' })
        .expect(200);

      const positions = (await ownTiles()).map((entry) => entry.position);
      expect(new Set(positions).size).toBe(positions.length);
    });

    it('is quiet when the top tile is asked to move up', async () => {
      const only = await createTile();

      const response = await authed('post', `/admin/home-tiles/${only.id}/move`)
        .send({ direction: 'UP' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('404s when moving a tile that is not there', async () => {
      await authed('post', `/admin/home-tiles/${'z'.repeat(25)}/move`)
        .send({ direction: 'DOWN' })
        .expect(404);
    });

    it('rejects a direction that is not one', async () => {
      const only = await createTile();

      await authed('post', `/admin/home-tiles/${only.id}/move`)
        .send({ direction: 'SIDEWAYS' })
        .expect(400);
    });
  });

  describe('DELETE /admin/home-tiles/:id', () => {
    it('removes it from both sides', async () => {
      const created = await createTile();

      await authed('delete', `/admin/home-tiles/${created.id}`).expect(204);

      expect((await ownTiles()).map((entry) => entry.id)).not.toContain(created.id);
    });

    it('404s on an unknown id', async () => {
      await authed('delete', `/admin/home-tiles/${'z'.repeat(25)}`).expect(404);
    });
  });
});

async function cleanUpTiles(prisma: PrismaService): Promise<void> {
  await prisma.homeTile.deleteMany({ where: { key: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
}

async function cleanUp(prisma: PrismaService): Promise<void> {
  await cleanUpTiles(prisma);
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}
