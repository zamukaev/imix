import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AdminCategoryDto, AdminProductDto } from '@imix/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/** Everything this spec creates is named with one prefix and removed after. */
const PREFIX = 'e2e-cat-';
const slug = (suffix: string): string => `${PREFIX}${suffix}`;
const sku = (suffix: string): string => `E2E-CAT-${suffix.toUpperCase()}`;

const PASSWORD = 'correct-horse-battery';
const ADMIN_EMAIL = `${PREFIX}admin@example.com`;
const SHOPPER_EMAIL = `${PREFIX}shopper@example.com`;

const CHEAP_RUB = 10_000;
const CHEAP_USD = 200;
const DEAR_RUB = 90_000;
const DEAR_USD = 100;

const variant = (suffix: string, overrides: Record<string, unknown> = {}) => ({
  sku: sku(suffix),
  labelRu: `Вариант ${suffix}`,
  labelEn: `Variant ${suffix}`,
  priceRub: DEAR_RUB,
  priceUsd: DEAR_USD,
  stock: 5,
  ...overrides,
});

// Needs the seeded database: `docker compose up -d db && pnpm --filter api db:seed`.
describe('admin catalogue endpoints', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let shopperToken: string;
  let categoryId: string;

  const authed = (method: 'post' | 'patch' | 'delete' | 'get', path: string) =>
    request(app.getHttpServer())[method](path).set(
      'authorization',
      `Bearer ${adminToken}`,
    );

  const product = (overrides: Record<string, unknown> = {}) => ({
    slug: slug('phone'),
    nameRu: 'Тестовый телефон',
    nameEn: 'Test phone',
    descriptionRu: 'Описание на русском.',
    descriptionEn: 'Description in English.',
    brand: 'Apple',
    categoryId,
    images: ['/products/test.jpg'],
    featured: false,
    variants: [variant('a')],
    ...overrides,
  });

  const createProduct = async (
    overrides: Record<string, unknown> = {},
  ): Promise<AdminProductDto> => {
    const response = await authed('post', '/admin/products')
      .send(product(overrides))
      .expect(201);

    return response.body;
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
    const promoted = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    adminToken = promoted.body.accessToken;

    const shopper = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: SHOPPER_EMAIL, password: PASSWORD })
      .expect(201);
    shopperToken = shopper.body.accessToken;
  });

  beforeEach(async () => {
    await cleanUpCatalogue(prisma);

    const category = await prisma.category.create({
      data: { slug: slug('category'), nameRu: 'Тесты', nameEn: 'Tests' },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await cleanUp(prisma);
    await app.close();
  });

  describe('the role gate', () => {
    it.each([
      ['GET', '/admin/products'],
      ['POST', '/admin/products'],
      ['GET', '/admin/categories'],
      ['POST', '/admin/categories'],
    ])('answers 401 for %s %s without a token', async (method, path) => {
      const agent = request(app.getHttpServer());

      await (method === 'GET' ? agent.get(path) : agent.post(path)).expect(401);
    });

    it('answers 403 for a signed-in shopper', async () => {
      await request(app.getHttpServer())
        .get('/admin/products')
        .set('authorization', `Bearer ${shopperToken}`)
        .expect(403);
    });
  });

  describe('both languages and both prices are required', () => {
    it.each([
      ['a missing Russian name', { nameRu: undefined }],
      ['a missing English name', { nameEn: undefined }],
      ['a missing Russian description', { descriptionRu: undefined }],
      ['a missing English description', { descriptionEn: undefined }],
      ['a blank English name', { nameEn: '   ' }],
    ])('rejects %s with 400', async (_label, overrides) => {
      await authed('post', '/admin/products')
        .send({ ...product(), ...overrides })
        .expect(400);
    });

    it.each([
      ['a missing rouble price', { priceRub: undefined }],
      ['a missing dollar price', { priceUsd: undefined }],
      ['a fractional price', { priceRub: 1999.5 }],
      ['a negative price', { priceRub: -1 }],
    ])('rejects a variant with %s with 400', async (_label, overrides) => {
      await authed('post', '/admin/products')
        .send(product({ variants: [variant('a', overrides)] }))
        .expect(400);
    });

    it('rejects a product with no variants at all', async () => {
      // A product's prices are derived from its variants — one with none would
      // sit in the catalogue at zero.
      await authed('post', '/admin/products')
        .send(product({ variants: [] }))
        .expect(400);
    });

    it('refuses to let the request pick its own base price', async () => {
      // `forbidNonWhitelisted` — the derived columns are not part of the DTO, so
      // trying to set them is a 400 rather than a quietly ignored field.
      await authed('post', '/admin/products')
        .send({ ...product(), basePriceRub: 1 })
        .expect(400);
    });
  });

  describe('POST /admin/products', () => {
    it('creates a product with its variants and both price lists', async () => {
      const created = await createProduct();

      expect(created.nameRu).toBe('Тестовый телефон');
      expect(created.nameEn).toBe('Test phone');
      expect(created.variants).toHaveLength(1);
      expect(created.variants[0]?.sold).toBe(false);
      expect(created.stock).toBe(5);
    });

    it('derives the base prices from the cheapest variant in each currency', async () => {
      // The two lists are set by hand and need not agree on which variant is
      // cheapest — so each column takes its own minimum.
      const created = await createProduct({
        variants: [
          variant('a', { priceRub: DEAR_RUB, priceUsd: DEAR_USD }),
          variant('b', { priceRub: CHEAP_RUB, priceUsd: CHEAP_USD }),
        ],
      });

      expect(created.basePriceRub).toBe(CHEAP_RUB);
      expect(created.basePriceUsd).toBe(DEAR_USD);
    });

    it('normalises the slug and the SKU', async () => {
      const created = await createProduct({
        slug: `  ${slug('CASED')}  `,
        variants: [variant('a', { sku: sku('a').toLowerCase() })],
      });

      expect(created.slug).toBe(slug('cased'));
      expect(created.variants[0]?.sku).toBe(sku('a'));
    });

    it('rejects a second product on the same slug with 409', async () => {
      await createProduct();

      await authed('post', '/admin/products')
        .send(product({ variants: [variant('b')] }))
        .expect(409);
    });

    it('names the duplicate when one request lists a SKU twice', async () => {
      const response = await authed('post', '/admin/products')
        .send(product({ variants: [variant('a'), variant('a')] }))
        .expect(400);

      expect(response.body.message).toContain(sku('a'));
    });

    it('rejects an unknown category with 400', async () => {
      await authed('post', '/admin/products')
        .send(product({ categoryId: 'c'.repeat(25) }))
        .expect(400);
    });

    it.each([
      ['a javascript: URL', 'javascript:alert(1)'],
      ['a plain http URL', 'http://example.com/x.jpg'],
    ])('rejects %s as an image', async (_label, image) => {
      await authed('post', '/admin/products')
        .send(product({ images: [image] }))
        .expect(400);
    });
  });

  describe('PATCH /admin/products/:id', () => {
    it('updates both languages at once', async () => {
      const created = await createProduct();
      const { variants: _variants, ...body } = product();

      const response = await authed('patch', `/admin/products/${created.id}`)
        .send({ ...body, nameRu: 'Новое имя', nameEn: 'New name', featured: true })
        .expect(200);

      expect(response.body.nameRu).toBe('Новое имя');
      expect(response.body.nameEn).toBe('New name');
      expect(response.body.featured).toBe(true);
      // Untouched by a product-level edit.
      expect(response.body.variants).toHaveLength(1);
    });

    it('404s on an unknown id', async () => {
      const { variants: _variants, ...body } = product();

      await authed('patch', `/admin/products/${'z'.repeat(25)}`)
        .send(body)
        .expect(404);
    });
  });

  describe('the tagline and the model-rail cutout', () => {
    it('stores both languages and hands them back', async () => {
      const created = await createProduct({
        taglineRu: 'Одна строка.',
        taglineEn: 'One line.',
        navImageUrl: '/products/nav/test.png',
      });

      expect(created.taglineRu).toBe('Одна строка.');
      expect(created.taglineEn).toBe('One line.');
      expect(created.navImageUrl).toBe('/products/nav/test.png');
    });

    it('clears them when the next write leaves them out', async () => {
      const created = await createProduct({
        taglineRu: 'Одна строка.',
        taglineEn: 'One line.',
        navImageUrl: '/products/nav/test.png',
      });
      const { variants: _variants, ...body } = product();

      const response = await authed('patch', `/admin/products/${created.id}`)
        .send(body)
        .expect(200);

      // A field the form omits means "cleared", not "leave it alone" — otherwise
      // emptying a tagline in the admin would silently keep the old one.
      expect(response.body.taglineRu).toBeNull();
      expect(response.body.taglineEn).toBeNull();
      expect(response.body.navImageUrl).toBeNull();
    });

    it('rejects a tagline longer than a tagline', async () => {
      await authed('post', '/admin/products')
        .send(product({ taglineRu: 'я'.repeat(121) }))
        .expect(400);
    });

    it('rejects a cutout URL that is not an asset URL', async () => {
      await authed('post', '/admin/products')
        .send(product({ navImageUrl: 'javascript:alert(1)' }))
        .expect(400);
    });
  });

  describe('the category page tab a product is filed under', () => {
    /** The seeded Mac tabs — the only category that has any. */
    const macGroups = async (): Promise<{ id: string; slug: string }[]> => {
      const response = await authed('get', '/admin/categories').expect(200);
      const mac = response.body.find(
        (category: { slug: string }) => category.slug === 'mac',
      );

      return mac.groups;
    };

    it('lists a category’s tabs alongside it', async () => {
      expect((await macGroups()).map((group) => group.slug)).toEqual([
        'laptops',
        'desktops',
        'displays',
      ]);
    });

    it('refuses a tab that belongs to another category', async () => {
      const [laptops] = await macGroups();

      // The fixture product lives in the test category, not in Mac.
      const response = await authed('post', '/admin/products')
        .send(product({ groupId: laptops!.id }))
        .expect(400);

      expect(response.body.message).toMatch(/different category/i);
    });

    it('stores no tab when none is given', async () => {
      const created = await createProduct();

      expect(created.groupId).toBeNull();
    });
  });

  describe('variants', () => {
    it('re-derives the base prices when a cheaper variant arrives', async () => {
      const created = await createProduct();

      const response = await authed('post', `/admin/products/${created.id}/variants`)
        .send(variant('b', { priceRub: CHEAP_RUB, priceUsd: CHEAP_USD }))
        .expect(201);

      expect(response.body.variants).toHaveLength(2);
      expect(response.body.basePriceRub).toBe(CHEAP_RUB);
      // The new variant is cheaper in roubles but *dearer* in dollars, so only
      // the rouble column moves. This is the point of two independent minimums:
      // one derived from the other would have quietly dropped the dollar price.
      expect(response.body.basePriceUsd).toBe(DEAR_USD);
    });

    it('accepts a stock correction on its own', async () => {
      const created = await createProduct();
      const target = created.variants[0];
      if (!target) throw new Error('the product was created without variants');

      const response = await authed('patch', `/admin/variants/${target.id}`)
        .send({ stock: 0 })
        .expect(200);

      expect(response.body.variants[0].stock).toBe(0);
      // The labels and prices it did not mention are still there.
      expect(response.body.variants[0].labelRu).toBe(target.labelRu);
      expect(response.body.variants[0].priceRub).toBe(target.priceRub);
    });

    it('re-derives the base prices when the last cheap variant goes', async () => {
      const created = await createProduct({
        variants: [
          variant('a', { priceRub: DEAR_RUB, priceUsd: DEAR_USD }),
          variant('b', { priceRub: CHEAP_RUB, priceUsd: CHEAP_USD }),
        ],
      });
      const cheapest = created.variants.find((entry) => entry.priceRub === CHEAP_RUB);
      if (!cheapest) throw new Error('the cheap variant was not created');

      const response = await authed('delete', `/admin/variants/${cheapest.id}`).expect(
        200,
      );

      expect(response.body.variants).toHaveLength(1);
      expect(response.body.basePriceRub).toBe(DEAR_RUB);
    });

    it('refuses to remove the last variant', async () => {
      const created = await createProduct();
      const only = created.variants[0];
      if (!only) throw new Error('the product was created without variants');

      const response = await authed('delete', `/admin/variants/${only.id}`).expect(409);

      expect(response.body.message).toContain('at least one variant');
    });
  });

  describe('deletion protects order history', () => {
    it('refuses to delete a product somebody has bought', async () => {
      const created = await createProduct();
      const bought = created.variants[0];
      if (!bought) throw new Error('the product was created without variants');

      await placeOrderFor(prisma, bought.id);

      const response = await authed('delete', `/admin/products/${created.id}`).expect(
        409,
      );
      expect(response.body.message).toContain('stock to zero');

      // And the variant on its own is just as protected.
      await authed('delete', `/admin/variants/${bought.id}`).expect(409);
    });

    it('marks a sold variant so the form can grey out its delete button', async () => {
      const created = await createProduct();
      const bought = created.variants[0];
      if (!bought) throw new Error('the product was created without variants');

      await placeOrderFor(prisma, bought.id);

      const response = await authed('get', `/admin/products/${created.id}`).expect(200);
      expect(response.body.variants[0].sold).toBe(true);
    });

    it('deletes a product nobody has ordered, variants and all', async () => {
      const created = await createProduct();

      await authed('delete', `/admin/products/${created.id}`).expect(204);
      await authed('get', `/admin/products/${created.id}`).expect(404);
      expect(
        await prisma.productVariant.count({ where: { productId: created.id } }),
      ).toBe(0);
    });
  });

  describe('categories', () => {
    it('creates one with both names and reports it as empty', async () => {
      const response = await authed('post', '/admin/categories')
        .send({ slug: slug('audio'), nameRu: 'Аудио', nameEn: 'Audio' })
        .expect(201);

      const created: AdminCategoryDto = response.body;
      expect(created.nameRu).toBe('Аудио');
      expect(created.nameEn).toBe('Audio');
      expect(created.productCount).toBe(0);
    });

    it.each([
      ['a missing English name', { nameEn: undefined }],
      ['a slug with spaces', { slug: 'two words' }],
      ['a slug with a slash', { slug: 'audio/wired' }],
    ])('rejects %s with 400', async (_label, overrides) => {
      await authed('post', '/admin/categories')
        .send({ slug: slug('x'), nameRu: 'А', nameEn: 'A', ...overrides })
        .expect(400);
    });

    it('lower-cases a slug rather than refusing it', async () => {
      // Same treatment as an email address: case in a URL is a way to end up
      // with two pages for one category, so it is normalised, not policed.
      const response = await authed('post', '/admin/categories')
        .send({ slug: slug('WIRED'), nameRu: 'Провод', nameEn: 'Wired' })
        .expect(201);

      expect(response.body.slug).toBe(slug('wired'));
    });

    it('refuses to delete one that still holds products', async () => {
      await createProduct();

      const response = await authed('delete', `/admin/categories/${categoryId}`).expect(
        409,
      );
      expect(response.body.message).toContain('product');
    });

    it('deletes an empty one', async () => {
      await authed('delete', `/admin/categories/${categoryId}`).expect(204);
    });
  });

  describe('what the storefront sees', () => {
    it('shows a new product in both languages and both currencies', async () => {
      // The acceptance criterion for Phase 3, in one test: created through the
      // admin, readable through the public API in either language.
      const created = await createProduct({ variants: [variant('a')] });

      const [russian, english] = await Promise.all([
        request(app.getHttpServer())
          .get(`/products/${created.slug}?locale=ru&currency=RUB`)
          .expect(200),
        request(app.getHttpServer())
          .get(`/products/${created.slug}?locale=en&currency=USD`)
          .expect(200),
      ]);

      expect(russian.body.name).toBe('Тестовый телефон');
      expect(russian.body.description).toBe('Описание на русском.');
      expect(russian.body.variants[0].price).toBe(DEAR_RUB);
      expect(english.body.name).toBe('Test phone');
      expect(english.body.description).toBe('Description in English.');
      expect(english.body.variants[0].price).toBe(DEAR_USD);
    });
  });
});

async function placeOrderFor(prisma: PrismaService, variantId: string): Promise<void> {
  await prisma.order.create({
    data: {
      email: `${PREFIX}buyer@example.com`,
      total: DEAR_RUB,
      currency: 'RUB',
      shippingName: 'Мила Орлова',
      shippingAddress: 'ул. Тверская, 14',
      shippingCity: 'Москва',
      shippingZip: '125009',
      shippingCountry: 'RU',
      items: { create: [{ variantId, quantity: 1, priceAtPurchase: DEAR_RUB }] },
    },
  });
}

/** Orders reference variants, which reference products, which reference categories. */
async function cleanUpCatalogue(prisma: PrismaService): Promise<void> {
  await prisma.orderItem.deleteMany({
    where: { variant: { sku: { startsWith: 'E2E-CAT-' } } },
  });
  await prisma.order.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.productVariant.deleteMany({ where: { sku: { startsWith: 'E2E-CAT-' } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
}

async function cleanUp(prisma: PrismaService): Promise<void> {
  await cleanUpCatalogue(prisma);
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}
