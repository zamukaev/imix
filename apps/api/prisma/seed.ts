import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

/**
 * Seed data for local development.
 *
 * iMIX resells genuine Apple hardware, so the catalogue carries the real
 * line-up and real product imagery (see the hard constraints in CLAUDE.md) —
 * what stays iMIX's own is the brand around it. Image paths point at
 * apps/web/public/products/.
 *
 * Every shopper-facing string is written twice, Russian first: `ru` is the
 * shop's primary language. Every price is written twice as well, once per
 * currency — the RUB price is not the USD price times a rate, it is what the
 * shop charges in roubles.
 *
 * Idempotent: every record is upserted on its natural key, so running the seed
 * repeatedly is safe. It never *removes* anything, though — deleting an entry
 * here leaves the row in place. That is the right trade once the admin owns the
 * data, but it means a removed seed entry has to be deleted by hand in dev.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set — copy apps/api/.env.example to apps/api/.env',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const MINOR_UNITS_PER_MAJOR = 100;

/** Roubles → копейки. `rub(149990)` → 14999000. */
function rub(major: number, kopecks = 0): number {
  return major * MINOR_UNITS_PER_MAJOR + kopecks;
}

/** Dollars → cents. `usd(1099)` → 109900. */
function usd(major: number, cents = 0): number {
  return major * MINOR_UNITS_PER_MAJOR + cents;
}

type VariantSeed = {
  sku: string;
  labelRu: string;
  labelEn: string;
  /** Null where the product comes in one finish — an AirTag has no colour. */
  color: string | null;
  config: string;
  priceRub: number;
  priceUsd: number;
  stock: number;
};

type ProductSeed = {
  slug: string;
  nameRu: string;
  nameEn: string;
  descriptionRu: string;
  descriptionEn: string;
  brand: string;
  basePriceRub: number;
  basePriceUsd: number;
  images: string[];
  featured: boolean;
  variants: VariantSeed[];
};

type CategorySeed = {
  slug: string;
  nameRu: string;
  nameEn: string;
};

/**
 * Slugs stay brand-neutral (`tablets`, not `ipad`) so a second manufacturer
 * needs no migration — see the note in ARCHITECTURE.md §2.
 */
const categories: readonly CategorySeed[] = [
  { slug: 'phones', nameRu: 'Смартфоны', nameEn: 'Smartphones' },
  { slug: 'laptops', nameRu: 'Ноутбуки', nameEn: 'Laptops' },
  { slug: 'tablets', nameRu: 'Планшеты', nameEn: 'Tablets' },
  { slug: 'watches', nameRu: 'Часы', nameEn: 'Watches' },
  { slug: 'audio', nameRu: 'Аудио', nameEn: 'Audio' },
  { slug: 'accessories', nameRu: 'Аксессуары', nameEn: 'Accessories' },
] as const;

const productsByCategory: Record<string, ProductSeed[]> = {
  phones: [
    {
      slug: 'iphone-17-pro',
      nameRu: 'iPhone 17 Pro',
      nameEn: 'iPhone 17 Pro',
      descriptionRu:
        'Корпус из титана, дисплей ProMotion с частотой до 120 Гц и система из трёх камер с оптическим зумом. Чип последнего поколения держит нагрузку без перегрева, а батареи хватает на полный день съёмки.',
      descriptionEn:
        'A titanium body, a ProMotion display running up to 120 Hz, and a three-lens camera system with optical zoom. The latest-generation chip sustains load without throttling, and the battery lasts a full day of shooting.',
      brand: 'Apple',
      basePriceRub: rub(149990),
      basePriceUsd: usd(1099),
      images: ['/products/iphone-17-pro-1.jpg'],
      featured: true,
      variants: [
        {
          sku: 'APL-I17P-256-BLK',
          labelRu: '256 ГБ · Чёрный титан',
          labelEn: '256GB · Black Titanium',
          color: 'Black Titanium',
          config: '256 GB',
          priceRub: rub(149990),
          priceUsd: usd(1099),
          stock: 12,
        },
        {
          sku: 'APL-I17P-512-BLK',
          labelRu: '512 ГБ · Чёрный титан',
          labelEn: '512GB · Black Titanium',
          color: 'Black Titanium',
          config: '512 GB',
          priceRub: rub(174990),
          priceUsd: usd(1299),
          stock: 7,
        },
        {
          sku: 'APL-I17P-512-NAT',
          labelRu: '512 ГБ · Натуральный титан',
          labelEn: '512GB · Natural Titanium',
          color: 'Natural Titanium',
          config: '512 GB',
          priceRub: rub(174990),
          priceUsd: usd(1299),
          stock: 3,
        },
      ],
    },
    {
      slug: 'iphone-17',
      nameRu: 'iPhone 17',
      nameEn: 'iPhone 17',
      descriptionRu:
        'Тот же процессор, что и в Pro, в более лёгком алюминиевом корпусе. Две камеры, автономность на весь день и обновления системы на годы вперёд.',
      descriptionEn:
        'The same silicon as the Pro in a lighter aluminium body. Dual camera, all-day battery life, and years of system updates ahead of it.',
      brand: 'Apple',
      basePriceRub: rub(99990),
      basePriceUsd: usd(799),
      images: ['/products/iphone-17-1.jpg'],
      featured: false,
      variants: [
        {
          sku: 'APL-I17-256-MID',
          labelRu: '256 ГБ · Тёмная ночь',
          labelEn: '256GB · Midnight',
          color: 'Midnight',
          config: '256 GB',
          priceRub: rub(99990),
          priceUsd: usd(799),
          stock: 20,
        },
        {
          sku: 'APL-I17-512-MID',
          labelRu: '512 ГБ · Тёмная ночь',
          labelEn: '512GB · Midnight',
          color: 'Midnight',
          config: '512 GB',
          priceRub: rub(119990),
          priceUsd: usd(999),
          stock: 15,
        },
      ],
    },
  ],
  laptops: [
    {
      slug: 'macbook-air-15-m5',
      nameRu: 'MacBook Air 15" M5',
      nameEn: 'MacBook Air 15" M5',
      descriptionRu:
        'Полтора килограмма, полностью бесшумная работа без вентилятора и до восемнадцати часов автономности. Клавиатура, за которой можно писать книгу.',
      descriptionEn:
        'Under 1.6 kg, completely silent with no fan, and up to eighteen hours on a charge. A keyboard worth writing a book on.',
      brand: 'Apple',
      basePriceRub: rub(159990),
      basePriceUsd: usd(1199),
      images: ['/products/macbook-air-15-m5-1.jpg'],
      featured: true,
      variants: [
        {
          sku: 'APL-MBA15-16-512-SLV',
          labelRu: '16 ГБ · 512 ГБ · Серебристый',
          labelEn: '16GB · 512GB · Silver',
          color: 'Silver',
          config: '16 GB RAM · 512 GB SSD',
          priceRub: rub(159990),
          priceUsd: usd(1199),
          stock: 9,
        },
        {
          sku: 'APL-MBA15-24-1TB-MID',
          labelRu: '24 ГБ · 1 ТБ · Тёмная ночь',
          labelEn: '24GB · 1TB · Midnight',
          color: 'Midnight',
          config: '24 GB RAM · 1 TB SSD',
          priceRub: rub(189990),
          priceUsd: usd(1399),
          stock: 5,
        },
      ],
    },
    {
      slug: 'macbook-pro-16-m5-pro',
      nameRu: 'MacBook Pro 16" M5 Pro',
      nameEn: 'MacBook Pro 16" M5 Pro',
      descriptionRu:
        'Шестнадцать дюймов дисплея Liquid Retina XDR с точной цветопередачей и запасом по теплу, чтобы держать нагрузку долго. Для сборки проектов, цветокоррекции и всего, что нагружает все ядра сразу.',
      descriptionEn:
        'Sixteen inches of colour-accurate Liquid Retina XDR with the thermal headroom to sustain it. For compiling, colour grading and anything else that pins every core.',
      brand: 'Apple',
      basePriceRub: rub(279990),
      basePriceUsd: usd(2499),
      images: ['/products/macbook-pro-16-m5-1.jpg'],
      featured: false,
      variants: [
        {
          sku: 'APL-MBP16-24-512-SPB',
          labelRu: '24 ГБ · 512 ГБ · Космический чёрный',
          labelEn: '24GB · 512GB · Space Black',
          color: 'Space Black',
          config: '24 GB RAM · 512 GB SSD',
          priceRub: rub(279990),
          priceUsd: usd(2499),
          stock: 4,
        },
        {
          sku: 'APL-MBP16-48-1TB-SPB',
          labelRu: '48 ГБ · 1 ТБ · Космический чёрный',
          labelEn: '48GB · 1TB · Space Black',
          color: 'Space Black',
          config: '48 GB RAM · 1 TB SSD',
          priceRub: rub(349990),
          priceUsd: usd(3099),
          stock: 2,
        },
      ],
    },
  ],
  tablets: [
    {
      slug: 'ipad-air-13-m4',
      nameRu: 'iPad Air 13" M4',
      nameEn: 'iPad Air 13" M4',
      descriptionRu:
        'Планшет, который чаще заменяет ноутбук, чем ожидаешь: тонкий корпус, тихая работа без вентилятора и полный день автономности. С клавиатурой превращается в рабочее место.',
      descriptionEn:
        'The tablet that replaces a laptop more often than you expect: thin, fanless, silent, and good for a full day away from a socket. Add a keyboard and it becomes a desk.',
      brand: 'Apple',
      basePriceRub: rub(99990),
      basePriceUsd: usd(799),
      images: ['/products/ipad-air-13-m4-1.jpg'],
      featured: false,
      variants: [
        {
          sku: 'APL-IPA13-128-BLU',
          labelRu: '128 ГБ · Синий · Wi-Fi',
          labelEn: '128GB · Blue · Wi-Fi',
          color: 'Blue',
          config: '128 GB · Wi-Fi',
          priceRub: rub(99990),
          priceUsd: usd(799),
          stock: 14,
        },
        {
          sku: 'APL-IPA13-256-BLU',
          labelRu: '256 ГБ · Синий · Wi-Fi',
          labelEn: '256GB · Blue · Wi-Fi',
          color: 'Blue',
          config: '256 GB · Wi-Fi',
          priceRub: rub(114990),
          priceUsd: usd(899),
          stock: 9,
        },
        {
          sku: 'APL-IPA13-256-STL',
          labelRu: '256 ГБ · Серый · Wi-Fi + 5G',
          labelEn: '256GB · Starlight · Wi-Fi + 5G',
          color: 'Starlight',
          config: '256 GB · Wi-Fi + 5G',
          priceRub: rub(134990),
          priceUsd: usd(1049),
          stock: 5,
        },
      ],
    },
    {
      slug: 'ipad-pro-13-m5',
      nameRu: 'iPad Pro 13" M5',
      nameEn: 'iPad Pro 13" M5',
      descriptionRu:
        'Дисплей, ради которого стоит посмотреть на планшет вблизи, и запас производительности для монтажа и графики. Самый тонкий корпус, который Apple делала.',
      descriptionEn:
        'A display worth looking at from close up, and enough headroom for editing and graphics work. The thinnest body Apple has built.',
      brand: 'Apple',
      basePriceRub: rub(179990),
      basePriceUsd: usd(1299),
      images: ['/products/ipad-pro-13-m5-1.jpg'],
      featured: true,
      variants: [
        {
          sku: 'APL-IPP13-256-SPB',
          labelRu: '256 ГБ · Космический чёрный',
          labelEn: '256GB · Space Black',
          color: 'Space Black',
          config: '256 GB · Wi-Fi',
          priceRub: rub(179990),
          priceUsd: usd(1299),
          stock: 6,
        },
        {
          sku: 'APL-IPP13-512-SPB',
          labelRu: '512 ГБ · Космический чёрный',
          labelEn: '512GB · Space Black',
          color: 'Space Black',
          config: '512 GB · Wi-Fi',
          priceRub: rub(209990),
          priceUsd: usd(1499),
          stock: 3,
        },
      ],
    },
  ],
  watches: [
    {
      slug: 'apple-watch-series-11',
      nameRu: 'Apple Watch Series 11',
      nameEn: 'Apple Watch Series 11',
      descriptionRu:
        'Сон, пульс и тренировки в одном месте — и заряда хватает так, что зарядка перестаёт быть ежевечерним ритуалом. Экран читается на солнце не хуже бумаги.',
      descriptionEn:
        'Sleep, heart rate and training in one place — and enough battery that charging stops being a nightly ritual. The screen reads in sunlight like paper.',
      brand: 'Apple',
      basePriceRub: rub(44990),
      basePriceUsd: usd(429),
      images: ['/products/apple-watch-series-11-1.jpg'],
      featured: false,
      variants: [
        {
          sku: 'APL-AW11-42-ALU-STL',
          labelRu: '42 мм · Алюминий · Сияющая звезда',
          labelEn: '42mm · Aluminium · Starlight',
          color: 'Starlight',
          config: '42 mm · GPS',
          priceRub: rub(44990),
          priceUsd: usd(429),
          stock: 11,
        },
        {
          sku: 'APL-AW11-46-ALU-BLK',
          labelRu: '46 мм · Алюминий · Тёмная ночь',
          labelEn: '46mm · Aluminium · Midnight',
          color: 'Midnight',
          config: '46 mm · GPS',
          priceRub: rub(49990),
          priceUsd: usd(469),
          stock: 7,
        },
        {
          sku: 'APL-AW11-46-TIT-NAT',
          labelRu: '46 мм · Титан · Натуральный',
          labelEn: '46mm · Titanium · Natural',
          color: 'Natural Titanium',
          config: '46 mm · GPS + Cellular',
          priceRub: rub(84990),
          priceUsd: usd(799),
          stock: 2,
        },
      ],
    },
  ],
  audio: [
    {
      slug: 'airpods-pro-3',
      nameRu: 'AirPods Pro 3',
      nameEn: 'AirPods Pro 3',
      descriptionRu:
        'Шумоподавление, которое слышно в первую секунду в метро. Режим прозрачности звучит настолько естественно, что наушники можно не вынимать.',
      descriptionEn:
        'Noise cancelling you notice in the first second on a metro platform. Transparency mode sounds natural enough that you can leave them in.',
      brand: 'Apple',
      basePriceRub: rub(24990),
      basePriceUsd: usd(249),
      images: ['/products/airpods-pro-3-1.jpg'],
      featured: false,
      variants: [
        {
          sku: 'APL-APP3-USBC',
          labelRu: 'Белые · USB-C',
          labelEn: 'White · USB-C',
          color: 'White',
          config: 'USB-C charging case',
          priceRub: rub(24990),
          priceUsd: usd(249),
          stock: 25,
        },
      ],
    },
  ],
  accessories: [
    {
      slug: 'airtag-1',
      nameRu: 'AirTag',
      nameEn: 'AirTag',
      descriptionRu:
        'Метка размером с монету для ключей, рюкзака или чемодана. Находится точным поиском на расстоянии вытянутой руки, батарейка меняется сама, без сервиса.',
      descriptionEn:
        'A coin-sized tracker for keys, a backpack or a suitcase. Precision finding walks you the last few metres, and the battery is one you swap yourself.',
      brand: 'Apple',
      basePriceRub: rub(3490),
      basePriceUsd: usd(29),
      images: ['/products/airtag-1-1.jpg'],
      featured: false,
      variants: [
        {
          sku: 'APL-AIRTAG-1PK',
          labelRu: '1 штука',
          labelEn: '1 pack',
          color: null,
          config: '1 pack',
          priceRub: rub(3490),
          priceUsd: usd(29),
          stock: 40,
        },
        {
          sku: 'APL-AIRTAG-4PK',
          labelRu: '4 штуки',
          labelEn: '4 pack',
          color: null,
          config: '4 pack',
          priceRub: rub(11990),
          priceUsd: usd(99),
          stock: 18,
        },
      ],
    },
  ],
};

type HomeTileSeed = {
  key: string;
  position: number;
  published: boolean;
  width: 'FULL' | 'HALF';
  surface: 'LIGHT' | 'WHITE' | 'DARK';
  headlineRu: string;
  headlineEn: string;
  subheadRu?: string;
  subheadEn?: string;
  imageUrl: string;
  primaryLabelRu?: string;
  primaryLabelEn?: string;
  primaryHref?: string;
  secondaryLabelRu?: string;
  secondaryLabelEn?: string;
  secondaryHref?: string;
};

/**
 * The shop window.
 *
 * Copy is iMIX's own, written as a retailer who has handled the device — never
 * lifted or paraphrased from the manufacturer (see CLAUDE.md). `hero_*` artwork
 * is a wide banner and belongs to a FULL tile; `promo_*` is a HALF, and halves
 * are paired by being adjacent in `position`.
 *
 * The unpublished rows are drafts held back until the catalogue actually
 * carries tablets, watches and audio — a tile whose CTA leads nowhere is worse
 * than no tile. Publishing them is a flag flip once those products exist.
 */
const homeTiles: readonly HomeTileSeed[] = [
  {
    key: 'hero-iphone',
    position: 10,
    published: true,
    width: 'FULL',
    surface: 'LIGHT',
    headlineRu: 'iPhone 17 Pro',
    headlineEn: 'iPhone 17 Pro',
    subheadRu: 'Титан, три камеры и день съёмки на одном заряде.',
    subheadEn: 'Titanium, three cameras, and a full day of shooting per charge.',
    imageUrl: '/home/hero-iphone.jpg',
    primaryLabelRu: 'Купить',
    primaryLabelEn: 'Buy',
    primaryHref: '/product/iphone-17-pro',
    secondaryLabelRu: 'Все смартфоны',
    secondaryLabelEn: 'All phones',
    secondaryHref: '/phones',
  },
  {
    key: 'hero-macbook-air',
    position: 20,
    published: true,
    width: 'FULL',
    surface: 'WHITE',
    headlineRu: 'MacBook Air 15" M5',
    headlineEn: 'MacBook Air 15" M5',
    subheadRu: 'Полтора килограмма, ни одного вентилятора, весь рабочий день.',
    subheadEn: 'Under 1.6 kg, not a single fan, a whole working day.',
    imageUrl: '/home/hero-macbook-air.jpg',
    primaryLabelRu: 'Купить',
    primaryLabelEn: 'Buy',
    primaryHref: '/product/macbook-air-15-m5',
    secondaryLabelRu: 'Все ноутбуки',
    secondaryLabelEn: 'All laptops',
    secondaryHref: '/laptops',
  },
  {
    key: 'promo-iphone',
    position: 30,
    published: true,
    width: 'HALF',
    surface: 'LIGHT',
    headlineRu: 'iPhone 17',
    headlineEn: 'iPhone 17',
    subheadRu: 'Тот же процессор, что в Pro. Корпус легче.',
    subheadEn: 'The same chip as the Pro, in a lighter body.',
    imageUrl: '/home/promo-iphone.jpg',
    primaryLabelRu: 'Купить',
    primaryLabelEn: 'Buy',
    primaryHref: '/product/iphone-17',
  },
  {
    key: 'promo-macbook-pro',
    position: 40,
    published: true,
    width: 'HALF',
    surface: 'DARK',
    headlineRu: 'MacBook Pro 16"',
    headlineEn: 'MacBook Pro 16"',
    subheadRu: 'Для сборок, цвета и всего, что грузит все ядра сразу.',
    subheadEn: 'For builds, colour work, and anything that pins every core.',
    imageUrl: '/home/promo-macbook-pro.jpg',
    primaryLabelRu: 'Купить',
    primaryLabelEn: 'Buy',
    primaryHref: '/product/macbook-pro-16-m5-pro',
  },

  {
    key: 'hero-ipad-air',
    position: 50,
    published: true,
    width: 'FULL',
    surface: 'LIGHT',
    headlineRu: 'iPad Air',
    headlineEn: 'iPad Air',
    subheadRu: 'Планшет, который заменяет ноутбук чаще, чем ожидаешь.',
    subheadEn: 'The tablet that replaces a laptop more often than you expect.',
    imageUrl: '/home/hero-ipad-air.jpg',
    primaryLabelRu: 'Купить',
    primaryLabelEn: 'Buy',
    primaryHref: '/product/ipad-air-13-m4',
    secondaryLabelRu: 'Все планшеты',
    secondaryLabelEn: 'All tablets',
    secondaryHref: '/tablets',
  },
  {
    key: 'promo-watch',
    position: 60,
    published: true,
    width: 'HALF',
    surface: 'LIGHT',
    headlineRu: 'Apple Watch Series 11',
    headlineEn: 'Apple Watch Series 11',
    subheadRu: 'Сон, пульс и тренировки — без ежедневной зарядки.',
    subheadEn: 'Sleep, heart rate and training — without a nightly charge.',
    imageUrl: '/home/promo-watch.jpg',
    primaryLabelRu: 'Купить',
    primaryLabelEn: 'Buy',
    primaryHref: '/product/apple-watch-series-11',
  },
  {
    key: 'promo-ipad-pro',
    position: 70,
    published: true,
    width: 'HALF',
    surface: 'DARK',
    headlineRu: 'iPad Pro',
    headlineEn: 'iPad Pro',
    subheadRu: 'Дисплей, ради которого стоит смотреть на планшет вблизи.',
    subheadEn: 'A display worth looking at from close up.',
    imageUrl: '/home/promo-ipad-pro.jpg',
    primaryLabelRu: 'Купить',
    primaryLabelEn: 'Buy',
    primaryHref: '/product/ipad-pro-13-m5',
  },
  {
    key: 'promo-airpods',
    position: 80,
    published: true,
    width: 'HALF',
    surface: 'LIGHT',
    headlineRu: 'AirPods Pro 3',
    headlineEn: 'AirPods Pro 3',
    subheadRu: 'Шумоподавление, которое слышно в первую секунду.',
    subheadEn: 'Noise cancelling you notice in the first second.',
    imageUrl: '/home/promo-airpods.jpg',
    primaryLabelRu: 'Купить',
    primaryLabelEn: 'Buy',
    primaryHref: '/product/airpods-pro-3',
    // Deliberately the last tile and without a partner: it renders full width
    // through the lone-half rule in `toHomeRows`. The obvious partner would be
    // AirTag, but its only photograph is a square product shot with the object
    // dead centre — no empty upper third, so the copy would land on the device.
    // Tile artwork and catalogue photography are not interchangeable.
  },
];

/**
 * The first ADMIN. There is no way to become one through the API — registration
 * always creates a USER — so the shop needs exactly one account it can be
 * bootstrapped with, and this is it.
 *
 * Skipped when the variables are absent: the seed has to keep running for
 * anyone who only set `DATABASE_URL` and wants a catalogue to look at.
 */
async function seedAdmin(): Promise<string> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    return 'no admin (set ADMIN_EMAIL and ADMIN_PASSWORD to create one)';
  }

  const passwordHash = await hash(password);

  // The password is updated on every run, so a forgotten one is a matter of
  // editing .env and re-seeding rather than a trip to the database.
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'ADMIN' },
    create: { email, passwordHash, role: 'ADMIN', name: 'iMIX admin' },
  });

  return `admin ${email}`;
}

async function main(): Promise<void> {
  const adminSummary = await seedAdmin();

  for (const category of categories) {
    const { slug, ...names } = category;

    const saved = await prisma.category.upsert({
      where: { slug },
      update: names,
      create: { slug, ...names },
    });

    for (const product of productsByCategory[slug] ?? []) {
      const { variants, ...productData } = product;

      const savedProduct = await prisma.product.upsert({
        where: { slug: product.slug },
        update: { ...productData, categoryId: saved.id },
        create: { ...productData, categoryId: saved.id },
      });

      for (const variant of variants) {
        await prisma.productVariant.upsert({
          where: { sku: variant.sku },
          update: { ...variant, productId: savedProduct.id },
          create: { ...variant, productId: savedProduct.id },
        });
      }
    }
  }

  for (const { key, ...tile } of homeTiles) {
    await prisma.homeTile.upsert({
      where: { key },
      update: tile,
      create: { key, ...tile },
    });
  }

  const [categoryCount, productCount, variantCount, tileCount, publishedTiles] =
    await Promise.all([
      prisma.category.count(),
      prisma.product.count(),
      prisma.productVariant.count(),
      prisma.homeTile.count(),
      prisma.homeTile.count({ where: { published: true } }),
    ]);

  process.stdout.write(
    `Seeded ${categoryCount} categories, ${productCount} products, ${variantCount} variants, ` +
      `${tileCount} home tiles (${publishedTiles} published), ${adminSummary}.\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.exitCode = 1;
    throw error;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
