import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type Tile = {
  id: string;
  width: 'FULL' | 'HALF';
  surface: 'LIGHT' | 'WHITE' | 'DARK';
  headline: string;
  subhead: string | null;
  image: { src: string; alt: string };
  actions: { label: string; href: string }[];
};

/** Fixtures this spec creates itself, cleaned up in `afterAll`. */
const FIXTURE_KEYS = [
  'test-incomplete-action',
  'test-secondary-only',
  'test-unpublished',
];

// Needs the seeded database: `docker compose up -d db && pnpm --filter api db:seed`.
describe('GET /home-tiles', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const base = {
    position: 9000,
    published: true,
    width: 'FULL' as const,
    surface: 'LIGHT' as const,
    headlineRu: 'Тест',
    headlineEn: 'Test',
    imageUrl: '/home/test.jpg',
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

    // A CTA with a label but no destination, and one with only a secondary.
    await prisma.homeTile.upsert({
      where: { key: 'test-incomplete-action' },
      update: {},
      create: {
        ...base,
        key: 'test-incomplete-action',
        primaryLabelRu: 'Купить',
        primaryLabelEn: 'Buy',
        // primaryHref deliberately absent
      },
    });
    await prisma.homeTile.upsert({
      where: { key: 'test-secondary-only' },
      update: {},
      create: {
        ...base,
        position: 9001,
        key: 'test-secondary-only',
        secondaryLabelRu: 'Подробнее',
        secondaryLabelEn: 'Learn more',
        secondaryHref: '/phones',
      },
    });

    // The spec brings its own draft rather than assuming the seed still ships
    // one — whether the shop currently has unpublished tiles is an editorial
    // fact, not something this behaviour should depend on.
    await prisma.homeTile.upsert({
      where: { key: 'test-unpublished' },
      update: { published: false },
      create: { ...base, position: 9002, key: 'test-unpublished', published: false },
    });
  });

  afterAll(async () => {
    await prisma.homeTile.deleteMany({ where: { key: { in: FIXTURE_KEYS } } });
    await app.close();
  });

  const fetchTiles = async (query = ''): Promise<Tile[]> => {
    const response = await request(app.getHttpServer())
      .get(`/home-tiles${query}`)
      .expect(200);

    return response.body;
  };

  it('returns published tiles in position order', async () => {
    const tiles = await fetchTiles();

    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles[0]).toEqual({
      id: expect.any(String),
      width: expect.stringMatching(/^(FULL|HALF)$/),
      surface: expect.stringMatching(/^(LIGHT|WHITE|DARK)$/),
      headline: expect.any(String),
      subhead: expect.anything(),
      image: { src: expect.any(String), alt: expect.any(String) },
      actions: expect.any(Array),
    });
  });

  it('hides unpublished tiles', async () => {
    const [tiles, drafts] = await Promise.all([
      fetchTiles(),
      prisma.homeTile.findMany({
        where: { published: false },
        select: { id: true },
      }),
    ]);

    expect(drafts.length).toBeGreaterThan(0);
    const visible = new Set(tiles.map((tile) => tile.id));
    for (const draft of drafts) {
      expect(visible.has(draft.id)).toBe(false);
    }
  });

  it('writes the copy in the requested language', async () => {
    const [russian, english] = await Promise.all([
      fetchTiles('?locale=ru'),
      fetchTiles('?locale=en'),
    ]);

    const [ruHero] = russian;
    const [enHero] = english;
    if (!ruHero || !enHero) throw new Error('seed has no published tiles');

    expect(ruHero.id).toBe(enHero.id);
    expect(ruHero.subhead).not.toBe(enHero.subhead);
    expect(ruHero.actions[0]?.label).not.toBe(enHero.actions[0]?.label);
    // The destination is a route, not copy — it must not move with the locale.
    expect(ruHero.actions[0]?.href).toBe(enHero.actions[0]?.href);
  });

  it('never sends more than two actions', async () => {
    for (const tile of await fetchTiles()) {
      expect(tile.actions.length).toBeLessThanOrEqual(2);
    }
  });

  it('drops an action that has a label but no destination', async () => {
    const tiles = await fetchTiles();
    const tile = tiles.find((candidate) => candidate.image.src === '/home/test.jpg');

    expect(tile).toBeDefined();
    expect(tile?.actions).toEqual([]);
  });

  it('promotes a lone secondary action rather than dangling it', async () => {
    const tiles = await fetchTiles();
    const withSecondaryOnly = tiles.filter(
      (tile) => tile.actions.length === 1 && tile.actions[0]?.href === '/phones',
    );

    expect(withSecondaryOnly.length).toBeGreaterThan(0);
    expect(withSecondaryOnly[0]?.actions[0]?.label).toBe('Подробнее');
  });

  it('sends an empty alt rather than null for decorative artwork', async () => {
    for (const tile of await fetchTiles()) {
      expect(typeof tile.image.alt).toBe('string');
    }
  });

  it.each([['a language the shop does not speak', '?locale=de']])(
    'rejects %s with 400',
    async (_label, query) => {
      await request(app.getHttpServer()).get(`/home-tiles${query}`).expect(400);
    },
  );
});
