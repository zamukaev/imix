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

/**
 * Every finish the catalogue sells, by slug.
 *
 * Central rather than repeated per product because the same finish appears on
 * several: "Midnight" is one colour with one Russian name and one swatch, and
 * two products disagreeing about its hex is a bug nobody would ever notice.
 *
 * The hexes approximate the manufacturer's finishes. They are the swatch, not a
 * design token — see the note on `ProductColor` in the schema.
 */
const COLOURS = {
  'black-titanium': { nameRu: 'Чёрный титан', nameEn: 'Black Titanium', hex: '#46444a' },
  'natural-titanium': { nameRu: 'Натуральный титан', nameEn: 'Natural Titanium', hex: '#c4bfb8' },
  'space-black': { nameRu: 'Космический чёрный', nameEn: 'Space Black', hex: '#2b2b2d' },
  midnight: { nameRu: 'Тёмная ночь', nameEn: 'Midnight', hex: '#1f2430' },
  starlight: { nameRu: 'Сияющая звезда', nameEn: 'Starlight', hex: '#f0e8dc' },
  silver: { nameRu: 'Серебристый', nameEn: 'Silver', hex: '#e3e4e6' },
  white: { nameRu: 'Белый', nameEn: 'White', hex: '#f2f2f4' },
  blue: { nameRu: 'Синий', nameEn: 'Blue', hex: '#5b7fa6' },
  'sky-blue': { nameRu: 'Небесно-голубой', nameEn: 'Sky Blue', hex: '#b8cfe0' },
  ultramarine: { nameRu: 'Ультрамарин', nameEn: 'Ultramarine', hex: '#6a7fd4' },
  purple: { nameRu: 'Фиолетовый', nameEn: 'Purple', hex: '#d0c3e8' },
  pink: { nameRu: 'Розовый', nameEn: 'Pink', hex: '#f2d5da' },
} as const satisfies Record<string, { nameRu: string; nameEn: string; hex: string }>;

type ColourSlug = keyof typeof COLOURS;

type VariantSeed = {
  sku: string;
  labelRu: string;
  labelEn: string;
  /** Null where the product comes in one finish — an AirTag has no colour. */
  colorSlug: ColourSlug | null;
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
  /**
   * One line for the model card on the category page. Written here as a
   * retailer who has handled the device — never lifted or paraphrased from the
   * manufacturer's own marketing (see the hard constraints in CLAUDE.md).
   */
  taglineRu: string;
  taglineEn: string;
  brand: string;
  basePriceRub: number;
  basePriceUsd: number;
  images: string[];
  /** Cutout for the model rail; omitted where there is no artwork for one yet. */
  navImageUrl?: string;
  /**
   * `.glb` for the 3D viewer. The seeded values point at the generic
   * placeholder slabs in `apps/web/public/models` — iMIX does not ship
   * Apple-owned 3D assets (CLAUDE.md, "Hard constraints"), so these stand in
   * until self-authored per-device models exist. Swapping one is an admin edit,
   * not a code change.
   */
  model3dUrl?: string;
  /** Tab of the category page, by slug. Omitted where the line has no tabs. */
  group?: string;
  featured: boolean;
  variants: VariantSeed[];
};

type GroupSeed = {
  slug: string;
  nameRu: string;
  nameEn: string;
  position: number;
};

type CategorySeed = {
  slug: string;
  nameRu: string;
  nameEn: string;
  /** Header order. Seeded in tens so a line can be inserted without renumbering. */
  position: number;
};

/**
 * The shop's sections, named after the product lines iMIX actually stocks.
 *
 * These were brand-neutral once (`phones`, `laptops`), on the theory that a
 * second manufacturer would then need no migration. That theory cost more than
 * it saved: a shopper looking for an iPhone reads "iPhone", and a section called
 * "Smartphones" holding nothing but iPhones was a category in name only. If a
 * second manufacturer ever arrives it gets its own sections, which is what a
 * reseller's navigation looks like anyway.
 *
 * `Product.brand` still carries the manufacturer, and iMIX is still the brand
 * around the whole thing — see the hard constraints in CLAUDE.md.
 */
const categories: readonly CategorySeed[] = [
  { slug: 'mac', nameRu: 'Mac', nameEn: 'Mac', position: 10 },
  { slug: 'ipad', nameRu: 'iPad', nameEn: 'iPad', position: 20 },
  { slug: 'iphone', nameRu: 'iPhone', nameEn: 'iPhone', position: 30 },
  { slug: 'watch', nameRu: 'Watch', nameEn: 'Watch', position: 40 },
  { slug: 'airpods', nameRu: 'AirPods', nameEn: 'AirPods', position: 50 },
  // AirTag is not one of the five lines, and dropping the product to make the
  // list rounder would be the wrong way round. Last, as the catch-all.
  { slug: 'accessories', nameRu: 'Аксессуары', nameEn: 'Accessories', position: 60 },
] as const;

/**
 * Tabs, by category slug. Only Mac has any: seven models spanning laptops,
 * desktops and displays is more than one row can be scanned in, which is the
 * only reason tabs exist. A category absent from here shows none.
 */
const groupsByCategory: Record<string, GroupSeed[]> = {
  mac: [
    { slug: 'laptops', nameRu: 'Ноутбуки', nameEn: 'Laptops', position: 10 },
    { slug: 'desktops', nameRu: 'Компьютеры', nameEn: 'Desktops', position: 20 },
    { slug: 'displays', nameRu: 'Мониторы', nameEn: 'Displays', position: 30 },
  ],
};

const productsByCategory: Record<string, ProductSeed[]> = {
  iphone: [
    {
      slug: 'iphone-17-pro',
      nameRu: 'iPhone 17 Pro',
      nameEn: 'iPhone 17 Pro',
      descriptionRu:
        'Корпус из титана, дисплей ProMotion с частотой до 120 Гц и система из трёх камер с оптическим зумом. Чип последнего поколения держит нагрузку без перегрева, а батареи хватает на полный день съёмки.',
      descriptionEn:
        'A titanium body, a ProMotion display running up to 120 Hz, and a three-lens camera system with optical zoom. The latest-generation chip sustains load without throttling, and the battery lasts a full day of shooting.',
      taglineRu: 'Титан, три камеры, полный съёмочный день.',
      taglineEn: 'Titanium, three cameras, a full day of shooting.',
      brand: 'Apple',
      basePriceRub: rub(149990),
      basePriceUsd: usd(1099),
      images: ['/products/iphone-17-pro-1.jpg'],
      navImageUrl: '/products/nav/iphone-17-pro.png',
      model3dUrl: '/models/placeholder-phone.glb',
      featured: true,
      variants: [
        {
          sku: 'APL-I17P-256-BLK',
          labelRu: '256 ГБ · Чёрный титан',
          labelEn: '256GB · Black Titanium',
          colorSlug: 'black-titanium',
          config: '256 GB',
          priceRub: rub(149990),
          priceUsd: usd(1099),
          stock: 12,
        },
        {
          sku: 'APL-I17P-512-BLK',
          labelRu: '512 ГБ · Чёрный титан',
          labelEn: '512GB · Black Titanium',
          colorSlug: 'black-titanium',
          config: '512 GB',
          priceRub: rub(174990),
          priceUsd: usd(1299),
          stock: 7,
        },
        {
          sku: 'APL-I17P-512-NAT',
          labelRu: '512 ГБ · Натуральный титан',
          labelEn: '512GB · Natural Titanium',
          colorSlug: 'natural-titanium',
          config: '512 GB',
          priceRub: rub(174990),
          priceUsd: usd(1299),
          stock: 3,
        },
      ],
    },
    {
      slug: 'iphone-air',
      nameRu: 'iPhone Air',
      nameEn: 'iPhone Air',
      descriptionRu:
        'Самый тонкий корпус в линейке — и при этом полноценный флагманский процессор. Одна камера вместо блока из трёх, зато аппарат почти не чувствуется в кармане и не оттягивает руку на долгом созвоне.',
      descriptionEn:
        'The thinnest body in the range, and a full flagship chip inside it. One camera instead of a block of three — in exchange the phone all but disappears in a pocket and does not weigh on your hand through a long call.',
      taglineRu: 'Лёгкий и тонкий — заметно в первый же день.',
      taglineEn: 'Light and thin — you notice it on day one.',
      brand: 'Apple',
      basePriceRub: rub(124990),
      basePriceUsd: usd(999),
      images: ['/products/iphone-air-1.jpg'],
      navImageUrl: '/products/nav/iphone-air.png',
      featured: false,
      variants: [
        {
          sku: 'APL-IAIR-256-SKY',
          labelRu: '256 ГБ · Небесно-голубой',
          labelEn: '256GB · Sky Blue',
          colorSlug: 'sky-blue',
          config: '256 GB',
          priceRub: rub(124990),
          priceUsd: usd(999),
          stock: 9,
        },
        {
          sku: 'APL-IAIR-512-SKY',
          labelRu: '512 ГБ · Небесно-голубой',
          labelEn: '512GB · Sky Blue',
          colorSlug: 'sky-blue',
          config: '512 GB',
          priceRub: rub(144990),
          priceUsd: usd(1199),
          stock: 4,
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
      taglineRu: 'Тот же процессор, что в Pro. Дешевле.',
      taglineEn: 'The same silicon as the Pro. Less money.',
      brand: 'Apple',
      basePriceRub: rub(99990),
      basePriceUsd: usd(799),
      images: ['/products/iphone-17-1.jpg'],
      navImageUrl: '/products/nav/iphone-17.png',
      featured: false,
      variants: [
        {
          sku: 'APL-I17-256-MID',
          labelRu: '256 ГБ · Тёмная ночь',
          labelEn: '256GB · Midnight',
          colorSlug: 'midnight',
          config: '256 GB',
          priceRub: rub(99990),
          priceUsd: usd(799),
          stock: 20,
        },
        {
          sku: 'APL-I17-512-MID',
          labelRu: '512 ГБ · Тёмная ночь',
          labelEn: '512GB · Midnight',
          colorSlug: 'midnight',
          config: '512 GB',
          priceRub: rub(119990),
          priceUsd: usd(999),
          stock: 15,
        },
      ],
    },
    {
      slug: 'iphone-17e',
      nameRu: 'iPhone 17e',
      nameEn: 'iPhone 17e',
      descriptionRu:
        'Младшая модель поколения: тот же экран и та же камера для повседневных снимков, но без ProMotion и телеобъектива. Для тех, кому нужен свежий аппарат на несколько лет, а не максимум характеристик.',
      descriptionEn:
        'The entry model of the generation: the same screen and the same camera for everyday shots, without ProMotion or the telephoto lens. For anyone who wants a current phone for the next few years rather than the highest numbers.',
      taglineRu: 'Всё нужное — и без переплаты.',
      taglineEn: 'Everything you need, nothing you pay extra for.',
      brand: 'Apple',
      basePriceRub: rub(74990),
      basePriceUsd: usd(599),
      images: ['/products/iphone-17e-1.jpg'],
      navImageUrl: '/products/nav/iphone-17e.png',
      featured: false,
      variants: [
        {
          sku: 'APL-I17E-128-PNK',
          labelRu: '128 ГБ · Розовый',
          labelEn: '128GB · Pink',
          colorSlug: 'pink',
          config: '128 GB',
          priceRub: rub(74990),
          priceUsd: usd(599),
          stock: 24,
        },
        {
          sku: 'APL-I17E-256-PNK',
          labelRu: '256 ГБ · Розовый',
          labelEn: '256GB · Pink',
          colorSlug: 'pink',
          config: '256 GB',
          priceRub: rub(84990),
          priceUsd: usd(699),
          stock: 18,
        },
      ],
    },
    {
      slug: 'iphone-16',
      nameRu: 'iPhone 16',
      nameEn: 'iPhone 16',
      descriptionRu:
        'Прошлое поколение, которое всё ещё получает обновления системы. Алюминиевый корпус, две камеры и честная цена: разницу с новым поколением большинство замечает только в характеристиках.',
      descriptionEn:
        'Last year’s generation, still on the system update list. An aluminium body, two cameras and an honest price: most people notice the gap to the current generation only on a spec sheet.',
      taglineRu: 'Прошлое поколение по спокойной цене.',
      taglineEn: 'Last year’s flagship at a calmer price.',
      brand: 'Apple',
      basePriceRub: rub(84990),
      basePriceUsd: usd(699),
      images: ['/products/iphone-16-1.jpg'],
      navImageUrl: '/products/nav/iphone-16.png',
      featured: false,
      variants: [
        {
          sku: 'APL-I16-128-ULT',
          labelRu: '128 ГБ · Ультрамарин',
          labelEn: '128GB · Ultramarine',
          colorSlug: 'ultramarine',
          config: '128 GB',
          priceRub: rub(84990),
          priceUsd: usd(699),
          stock: 16,
        },
        {
          sku: 'APL-I16-256-ULT',
          labelRu: '256 ГБ · Ультрамарин',
          labelEn: '256GB · Ultramarine',
          colorSlug: 'ultramarine',
          config: '256 GB',
          priceRub: rub(94990),
          priceUsd: usd(799),
          stock: 11,
        },
      ],
    },
  ],
  mac: [
    {
      slug: 'macbook-air-15-m5',
      nameRu: 'MacBook Air 15" M5',
      nameEn: 'MacBook Air 15" M5',
      descriptionRu:
        'Полтора килограмма, полностью бесшумная работа без вентилятора и до восемнадцати часов автономности. Клавиатура, за которой можно писать книгу.',
      descriptionEn:
        'Under 1.6 kg, completely silent with no fan, and up to eighteen hours on a charge. A keyboard worth writing a book on.',
      taglineRu: 'Тихий, лёгкий, работает весь день.',
      taglineEn: 'Silent, light, lasts the whole working day.',
      brand: 'Apple',
      basePriceRub: rub(159990),
      basePriceUsd: usd(1199),
      images: ['/products/macbook-air-15-m5-1.jpg'],
      navImageUrl: '/products/nav/macbook-air-15-m5.png',
      model3dUrl: '/models/placeholder-laptop.glb',
      group: 'laptops',
      featured: true,
      variants: [
        {
          sku: 'APL-MBA15-16-512-SLV',
          labelRu: '16 ГБ · 512 ГБ · Серебристый',
          labelEn: '16GB · 512GB · Silver',
          colorSlug: 'silver',
          config: '16 GB RAM · 512 GB SSD',
          priceRub: rub(159990),
          priceUsd: usd(1199),
          stock: 9,
        },
        {
          sku: 'APL-MBA15-24-1TB-MID',
          labelRu: '24 ГБ · 1 ТБ · Тёмная ночь',
          labelEn: '24GB · 1TB · Midnight',
          colorSlug: 'midnight',
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
      taglineRu: 'Для монтажа и сборок, а не для почты.',
      taglineEn: 'For renders and builds, not for email.',
      brand: 'Apple',
      basePriceRub: rub(279990),
      basePriceUsd: usd(2499),
      images: ['/products/macbook-pro-16-m5-1.jpg'],
      navImageUrl: '/products/nav/macbook-pro-16-m5-pro.png',
      model3dUrl: '/models/placeholder-laptop.glb',
      group: 'laptops',
      featured: false,
      variants: [
        {
          sku: 'APL-MBP16-24-512-SPB',
          labelRu: '24 ГБ · 512 ГБ · Космический чёрный',
          labelEn: '24GB · 512GB · Space Black',
          colorSlug: 'space-black',
          config: '24 GB RAM · 512 GB SSD',
          priceRub: rub(279990),
          priceUsd: usd(2499),
          stock: 4,
        },
        {
          sku: 'APL-MBP16-48-1TB-SPB',
          labelRu: '48 ГБ · 1 ТБ · Космический чёрный',
          labelEn: '48GB · 1TB · Space Black',
          colorSlug: 'space-black',
          config: '48 GB RAM · 1 TB SSD',
          priceRub: rub(349990),
          priceUsd: usd(3099),
          stock: 2,
        },
      ],
    },

    {
      slug: 'imac-24-m5',
      nameRu: 'iMac 24" M5',
      nameEn: 'iMac 24" M5',
      descriptionRu:
        'Моноблок толщиной с планшет: весь компьютер живёт за экраном, на столе остаётся один кабель. Экран 4,5K с честной цветопередачей, клавиатура и мышь в цвет корпуса идут в комплекте.',
      descriptionEn:
        'An all-in-one no thicker than a tablet: the whole computer lives behind the screen and one cable reaches the desk. A 4.5K display with honest colour, and a colour-matched keyboard and mouse in the box.',
      taglineRu: 'Весь компьютер — за экраном.',
      taglineEn: 'The whole computer, behind the screen.',
      brand: 'Apple',
      basePriceRub: rub(139990),
      basePriceUsd: usd(1299),
      images: ['/products/imac-24-m5-1.jpg'],
      navImageUrl: '/products/nav/imac-24-m5.png',
      group: 'desktops',
      featured: false,
      variants: [
        {
          sku: 'APL-IMAC24-16-256-BLU',
          labelRu: '16 ГБ · 256 ГБ · Синий',
          labelEn: '16GB · 256GB · Blue',
          colorSlug: 'blue',
          config: '16 GB / 256 GB',
          priceRub: rub(139990),
          priceUsd: usd(1299),
          stock: 6,
        },
        {
          sku: 'APL-IMAC24-24-512-BLU',
          labelRu: '24 ГБ · 512 ГБ · Синий',
          labelEn: '24GB · 512GB · Blue',
          colorSlug: 'blue',
          config: '24 GB / 512 GB',
          priceRub: rub(169990),
          priceUsd: usd(1599),
          stock: 3,
        },
      ],
    },
    {
      slug: 'mac-mini-m5',
      nameRu: 'Mac mini M5',
      nameEn: 'Mac mini M5',
      descriptionRu:
        'Самый доступный способ перейти на macOS: коробка размером с книгу, к которой подключается ваш монитор и ваша клавиатура. Тихий под нагрузкой и почти не занимает места на столе.',
      descriptionEn:
        'The cheapest way onto macOS: a box the size of a book that takes the monitor and keyboard you already own. Quiet under load, and it barely occupies the desk.',
      taglineRu: 'Приносите свой монитор.',
      taglineEn: 'Bring your own monitor.',
      brand: 'Apple',
      basePriceRub: rub(64990),
      basePriceUsd: usd(599),
      images: ['/products/mac-mini-m5-1.jpg'],
      navImageUrl: '/products/nav/mac-mini-m5.png',
      group: 'desktops',
      featured: false,
      variants: [
        {
          sku: 'APL-MINI-16-256',
          labelRu: '16 ГБ · 256 ГБ',
          labelEn: '16GB · 256GB',
          colorSlug: null,
          config: '16 GB / 256 GB',
          priceRub: rub(64990),
          priceUsd: usd(599),
          stock: 14,
        },
        {
          sku: 'APL-MINI-24-512',
          labelRu: '24 ГБ · 512 ГБ',
          labelEn: '24GB · 512GB',
          colorSlug: null,
          config: '24 GB / 512 GB',
          priceRub: rub(89990),
          priceUsd: usd(799),
          stock: 8,
        },
      ],
    },
    {
      slug: 'mac-studio-m5-max',
      nameRu: 'Mac Studio M5 Max',
      nameEn: 'Mac Studio M5 Max',
      descriptionRu:
        'Рабочая станция для монтажа, 3D и больших сборок. Порты вынесены и назад, и вперёд, так что кардридер и накопитель не приходится искать за корпусом.',
      descriptionEn:
        'A workstation for editing, 3D and long builds. Ports on the front as well as the back, so a card reader and a drive are not something you reach behind the machine for.',
      taglineRu: 'Рендер идёт — вентилятора не слышно.',
      taglineEn: 'It renders without making a noise about it.',
      brand: 'Apple',
      basePriceRub: rub(259990),
      basePriceUsd: usd(2299),
      images: ['/products/mac-studio-m5-max-1.jpg'],
      navImageUrl: '/products/nav/mac-studio-m5-max.png',
      group: 'desktops',
      featured: false,
      variants: [
        {
          sku: 'APL-STUDIO-36-512',
          labelRu: '36 ГБ · 512 ГБ',
          labelEn: '36GB · 512GB',
          colorSlug: null,
          config: '36 GB / 512 GB',
          priceRub: rub(259990),
          priceUsd: usd(2299),
          stock: 4,
        },
        {
          sku: 'APL-STUDIO-48-1TB',
          labelRu: '48 ГБ · 1 ТБ',
          labelEn: '48GB · 1TB',
          colorSlug: null,
          config: '48 GB / 1 TB',
          priceRub: rub(319990),
          priceUsd: usd(2899),
          stock: 2,
        },
      ],
    },

    {
      slug: 'studio-display-27',
      nameRu: 'Studio Display 27"',
      nameEn: 'Studio Display 27"',
      descriptionRu:
        'Экран 5K, в который встроены камера, микрофоны и колонки — на столе остаётся один кабель, он же питает ноутбук. Подставку и покрытие выбирают при заказе, поменять их потом нельзя.',
      descriptionEn:
        'A 5K screen with the camera, microphones and speakers already inside it — one cable on the desk, and it charges the laptop too. Stand and coating are chosen at order time and cannot be swapped later.',
      taglineRu: 'Один кабель до ноутбука.',
      taglineEn: 'One cable to the laptop.',
      brand: 'Apple',
      basePriceRub: rub(169990),
      basePriceUsd: usd(1599),
      images: ['/products/studio-display-27-1.jpg'],
      navImageUrl: '/products/nav/studio-display-27.png',
      group: 'displays',
      featured: false,
      variants: [
        {
          sku: 'APL-SD27-STD-TILT',
          labelRu: 'Стандартное стекло · наклонная подставка',
          labelEn: 'Standard glass · tilt stand',
          colorSlug: null,
          config: 'Standard glass',
          priceRub: rub(169990),
          priceUsd: usd(1599),
          stock: 5,
        },
        {
          sku: 'APL-SD27-NANO-TILT',
          labelRu: 'Нанотекстурное стекло · наклонная подставка',
          labelEn: 'Nano-texture glass · tilt stand',
          colorSlug: null,
          config: 'Nano-texture glass',
          priceRub: rub(199990),
          priceUsd: usd(1899),
          stock: 2,
        },
      ],
    },
    {
      slug: 'studio-display-xdr-32',
      nameRu: 'Studio Display XDR 32"',
      nameEn: 'Studio Display XDR 32"',
      descriptionRu:
        'Референсный монитор 6K для цветокоррекции: держит яркость на всей площади экрана и не уводит цвет за смену. Берут те, кому картинку потом сдавать заказчику.',
      descriptionEn:
        'A 6K reference monitor for grading: it holds brightness across the whole panel and does not drift over a shift. Bought by people who have to hand the picture to a client afterwards.',
      taglineRu: 'Для тех, кто сдаёт цвет заказчику.',
      taglineEn: 'For work that gets signed off on colour.',
      brand: 'Apple',
      basePriceRub: rub(549990),
      basePriceUsd: usd(4999),
      images: ['/products/studio-display-xdr-32-1.jpg'],
      navImageUrl: '/products/nav/studio-display-xdr-32.png',
      group: 'displays',
      featured: false,
      variants: [
        {
          sku: 'APL-SDXDR32-STD',
          labelRu: 'Стандартное стекло',
          labelEn: 'Standard glass',
          colorSlug: null,
          config: 'Standard glass',
          priceRub: rub(549990),
          priceUsd: usd(4999),
          stock: 2,
        },
        {
          sku: 'APL-SDXDR32-NANO',
          labelRu: 'Нанотекстурное стекло',
          labelEn: 'Nano-texture glass',
          colorSlug: null,
          config: 'Nano-texture glass',
          priceRub: rub(609990),
          priceUsd: usd(5599),
          stock: 1,
        },
      ],
    },
  ],
  ipad: [
    {
      slug: 'ipad-air-13-m4',
      nameRu: 'iPad Air 13" M4',
      nameEn: 'iPad Air 13" M4',
      descriptionRu:
        'Планшет, который чаще заменяет ноутбук, чем ожидаешь: тонкий корпус, тихая работа без вентилятора и полный день автономности. С клавиатурой превращается в рабочее место.',
      descriptionEn:
        'The tablet that replaces a laptop more often than you expect: thin, fanless, silent, and good for a full day away from a socket. Add a keyboard and it becomes a desk.',
      taglineRu: 'Большой экран, а вес как у книги.',
      taglineEn: 'A big screen that weighs like a book.',
      brand: 'Apple',
      basePriceRub: rub(99990),
      basePriceUsd: usd(799),
      images: ['/products/ipad-air-13-m4-1.png'],
      navImageUrl: '/products/nav/ipad-air-13-m4.png',
      featured: false,
      variants: [
        {
          sku: 'APL-IPA13-128-BLU',
          labelRu: '128 ГБ · Синий · Wi-Fi',
          labelEn: '128GB · Blue · Wi-Fi',
          colorSlug: 'blue',
          config: '128 GB · Wi-Fi',
          priceRub: rub(99990),
          priceUsd: usd(799),
          stock: 14,
        },
        {
          sku: 'APL-IPA13-256-BLU',
          labelRu: '256 ГБ · Синий · Wi-Fi',
          labelEn: '256GB · Blue · Wi-Fi',
          colorSlug: 'blue',
          config: '256 GB · Wi-Fi',
          priceRub: rub(114990),
          priceUsd: usd(899),
          stock: 9,
        },
        {
          sku: 'APL-IPA13-256-STL',
          labelRu: '256 ГБ · Серый · Wi-Fi + 5G',
          labelEn: '256GB · Starlight · Wi-Fi + 5G',
          colorSlug: 'starlight',
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
      taglineRu: 'Планшет, который заменяет ноутбук.',
      taglineEn: 'The tablet that stands in for a laptop.',
      brand: 'Apple',
      basePriceRub: rub(179990),
      basePriceUsd: usd(1299),
      images: ['/products/ipad-pro-13-m5-1.png'],
      navImageUrl: '/products/nav/ipad-pro-13-m5.png',
      featured: true,
      variants: [
        {
          sku: 'APL-IPP13-256-SPB',
          labelRu: '256 ГБ · Космический чёрный',
          labelEn: '256GB · Space Black',
          colorSlug: 'space-black',
          config: '256 GB · Wi-Fi',
          priceRub: rub(179990),
          priceUsd: usd(1299),
          stock: 6,
        },
        {
          sku: 'APL-IPP13-512-SPB',
          labelRu: '512 ГБ · Космический чёрный',
          labelEn: '512GB · Space Black',
          colorSlug: 'space-black',
          config: '512 GB · Wi-Fi',
          priceRub: rub(209990),
          priceUsd: usd(1499),
          stock: 3,
        },
      ],
    },
    {
      slug: 'ipad-11-a18',
      nameRu: 'iPad 11" A18',
      nameEn: 'iPad 11" A18',
      descriptionRu:
        'Базовый планшет, которого хватает большинству: сериалы, заметки, браузер и рисование. Тот же корпус и тот же разъём, что у старших моделей, но заметно дешевле.',
      descriptionEn:
        'The entry tablet that covers what most people actually do: video, notes, a browser and drawing. The same body and the same port as its bigger siblings, for noticeably less.',
      taglineRu: 'Планшет без лишнего — и без переплаты.',
      taglineEn: 'The tablet most people actually need.',
      brand: 'Apple',
      basePriceRub: rub(39990),
      basePriceUsd: usd(349),
      images: ['/products/ipad-11-a18-1.png'],
      navImageUrl: '/products/nav/ipad-11-a18.png',
      featured: false,
      variants: [
        {
          sku: 'APL-IPAD11-128-SLV',
          labelRu: '128 ГБ · Серебристый',
          labelEn: '128GB · Silver',
          colorSlug: 'silver',
          config: '128 GB · Wi-Fi',
          priceRub: rub(39990),
          priceUsd: usd(349),
          stock: 22,
        },
        {
          sku: 'APL-IPAD11-256-SLV',
          labelRu: '256 ГБ · Серебристый',
          labelEn: '256GB · Silver',
          colorSlug: 'silver',
          config: '256 GB · Wi-Fi',
          priceRub: rub(49990),
          priceUsd: usd(449),
          stock: 14,
        },
      ],
    },
    {
      slug: 'ipad-mini-a18-pro',
      nameRu: 'iPad mini A18 Pro',
      nameEn: 'iPad mini A18 Pro',
      descriptionRu:
        'Помещается в карман куртки и держится одной рукой — при этом внутри процессор уровня телефона-флагмана. Берут в дорогу, за руль и для чтения.',
      descriptionEn:
        'Fits a jacket pocket and holds in one hand, with flagship-phone silicon inside it. Bought for travelling, for the car, and for reading.',
      taglineRu: 'Держится одной рукой.',
      taglineEn: 'Holds in one hand.',
      brand: 'Apple',
      basePriceRub: rub(54990),
      basePriceUsd: usd(499),
      images: ['/products/ipad-mini-a18-pro-1.png'],
      navImageUrl: '/products/nav/ipad-mini-a18-pro.png',
      featured: false,
      variants: [
        {
          sku: 'APL-IPADMINI-128-PRP',
          labelRu: '128 ГБ · Фиолетовый',
          labelEn: '128GB · Purple',
          colorSlug: 'purple',
          config: '128 GB · Wi-Fi',
          priceRub: rub(54990),
          priceUsd: usd(499),
          stock: 11,
        },
        {
          sku: 'APL-IPADMINI-256-PRP',
          labelRu: '256 ГБ · Фиолетовый',
          labelEn: '256GB · Purple',
          colorSlug: 'purple',
          config: '256 GB · Wi-Fi',
          priceRub: rub(64990),
          priceUsd: usd(599),
          stock: 7,
        },
      ],
    },
  ],
  watch: [
    {
      slug: 'apple-watch-series-11',
      nameRu: 'Apple Watch Series 11',
      nameEn: 'Apple Watch Series 11',
      descriptionRu:
        'Сон, пульс и тренировки в одном месте — и заряда хватает так, что зарядка перестаёт быть ежевечерним ритуалом. Экран читается на солнце не хуже бумаги.',
      descriptionEn:
        'Sleep, heart rate and training in one place — and enough battery that charging stops being a nightly ritual. The screen reads in sunlight like paper.',
      taglineRu: 'Шаги, пульс и сон — без лишней возни.',
      taglineEn: 'Steps, pulse and sleep, with no fuss.',
      brand: 'Apple',
      basePriceRub: rub(44990),
      basePriceUsd: usd(429),
      images: ['/products/apple-watch-series-11-1.png'],
      navImageUrl: '/products/nav/apple-watch-series-11.svg',
      featured: false,
      variants: [
        {
          sku: 'APL-AW11-42-ALU-STL',
          labelRu: '42 мм · Алюминий · Сияющая звезда',
          labelEn: '42mm · Aluminium · Starlight',
          colorSlug: 'starlight',
          config: '42 mm · GPS',
          priceRub: rub(44990),
          priceUsd: usd(429),
          stock: 11,
        },
        {
          sku: 'APL-AW11-46-ALU-BLK',
          labelRu: '46 мм · Алюминий · Тёмная ночь',
          labelEn: '46mm · Aluminium · Midnight',
          colorSlug: 'midnight',
          config: '46 mm · GPS',
          priceRub: rub(49990),
          priceUsd: usd(469),
          stock: 7,
        },
        {
          sku: 'APL-AW11-46-TIT-NAT',
          labelRu: '46 мм · Титан · Натуральный',
          labelEn: '46mm · Titanium · Natural',
          colorSlug: 'natural-titanium',
          config: '46 mm · GPS + Cellular',
          priceRub: rub(84990),
          priceUsd: usd(799),
          stock: 2,
        },
      ],
    },
    {
      slug: 'apple-watch-se-3',
      nameRu: 'Apple Watch SE 3',
      nameEn: 'Apple Watch SE 3',
      descriptionRu:
        'Всё, ради чего часы обычно и покупают: уведомления, тренировки, пульс и оплата с запястья. Без датчиков, которыми большинство всё равно не пользуется, и заметно дешевле.',
      descriptionEn:
        'Everything people actually buy a watch for: notifications, workouts, heart rate and paying from the wrist. Without the sensors most owners never open, and for noticeably less.',
      taglineRu: 'Главное — и ничего сверх.',
      taglineEn: 'The parts you will actually use.',
      brand: 'Apple',
      basePriceRub: rub(27990),
      basePriceUsd: usd(249),
      images: ['/products/apple-watch-se-3-1.png'],
      navImageUrl: '/products/nav/apple-watch-se-3.svg',
      featured: false,
      variants: [
        {
          sku: 'APL-AWSE3-40-ALU-MID',
          labelRu: '40 мм · Алюминий · Тёмная ночь',
          labelEn: '40mm · Aluminium · Midnight',
          colorSlug: 'midnight',
          config: '40 mm · GPS',
          priceRub: rub(27990),
          priceUsd: usd(249),
          stock: 18,
        },
        {
          sku: 'APL-AWSE3-44-ALU-MID',
          labelRu: '44 мм · Алюминий · Тёмная ночь',
          labelEn: '44mm · Aluminium · Midnight',
          colorSlug: 'midnight',
          config: '44 mm · GPS',
          priceRub: rub(31990),
          priceUsd: usd(279),
          stock: 12,
        },
      ],
    },
    {
      slug: 'apple-watch-ultra-3',
      nameRu: 'Apple Watch Ultra 3',
      nameEn: 'Apple Watch Ultra 3',
      descriptionRu:
        'Титановый корпус, самый яркий экран в линейке и автономность на несколько суток. Для гор, воды и длинных дистанций — там, где обычные часы просят зарядку на середине маршрута.',
      descriptionEn:
        'A titanium case, the brightest screen in the range, and battery measured in days rather than hours. For mountains, water and long distances — where an ordinary watch asks for a charger halfway.',
      taglineRu: 'Заряда хватает на весь маршрут.',
      taglineEn: 'Lasts the whole route, not half of it.',
      brand: 'Apple',
      basePriceRub: rub(94990),
      basePriceUsd: usd(799),
      images: ['/products/apple-watch-ultra-3-1.png'],
      navImageUrl: '/products/nav/apple-watch-ultra-3.svg',
      featured: false,
      variants: [
        {
          sku: 'APL-AWU3-49-TIT-NAT',
          labelRu: '49 мм · Титан · Натуральный',
          labelEn: '49mm · Titanium · Natural',
          colorSlug: 'natural-titanium',
          config: '49 mm · GPS + Cellular',
          priceRub: rub(94990),
          priceUsd: usd(799),
          stock: 5,
        },
        {
          sku: 'APL-AWU3-49-TIT-BLK',
          labelRu: '49 мм · Титан · Чёрный',
          labelEn: '49mm · Titanium · Black',
          colorSlug: 'black-titanium',
          config: '49 mm · GPS + Cellular',
          priceRub: rub(99990),
          priceUsd: usd(849),
          stock: 3,
        },
      ],
    },
  ],
  airpods: [
    {
      slug: 'airpods-pro-3',
      nameRu: 'AirPods Pro 3',
      nameEn: 'AirPods Pro 3',
      descriptionRu:
        'Шумоподавление, которое слышно в первую секунду в метро. Режим прозрачности звучит настолько естественно, что наушники можно не вынимать.',
      descriptionEn:
        'Noise cancelling you notice in the first second on a metro platform. Transparency mode sounds natural enough that you can leave them in.',
      taglineRu: 'Шумоподавление, которое слышно в метро.',
      taglineEn: 'Noise cancelling you notice on the metro.',
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
          colorSlug: 'white',
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
      taglineRu: 'Ключи, сумка, чемодан — всё на карте.',
      taglineEn: 'Keys, bag, suitcase — all on one map.',
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
          colorSlug: null,
          config: '1 pack',
          priceRub: rub(3490),
          priceUsd: usd(29),
          stock: 40,
        },
        {
          sku: 'APL-AIRTAG-4PK',
          labelRu: '4 штуки',
          labelEn: '4 pack',
          colorSlug: null,
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
    secondaryHref: '/iphone',
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
    secondaryHref: '/mac',
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
    secondaryHref: '/ipad',
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

    // Tabs before products, because a product references one by id.
    const groupIds = new Map<string, string>();

    for (const group of groupsByCategory[slug] ?? []) {
      const { slug: groupSlug, ...groupData } = group;

      const savedGroup = await prisma.productGroup.upsert({
        where: { categoryId_slug: { categoryId: saved.id, slug: groupSlug } },
        update: groupData,
        create: { slug: groupSlug, ...groupData, categoryId: saved.id },
      });

      groupIds.set(groupSlug, savedGroup.id);
    }

    for (const product of productsByCategory[slug] ?? []) {
      const { variants, group, ...productData } = product;
      const groupId = group === undefined ? null : (groupIds.get(group) ?? null);

      if (group !== undefined && groupId === null) {
        throw new Error(
          `Product "${product.slug}" names group "${group}", which "${slug}" does not have.`,
        );
      }

      const savedProduct = await prisma.product.upsert({
        where: { slug: product.slug },
        update: { ...productData, categoryId: saved.id, groupId },
        create: { ...productData, categoryId: saved.id, groupId },
      });

      // A product's finishes are derived from its variants rather than listed
      // again beside them: the variants already say which colours exist, and a
      // second list would be a second thing to keep in step. First appearance
      // sets the order, so the swatch row reads in the order the variants do.
      const colourSlugs = [
        ...new Set(
          variants
            .map((variant) => variant.colorSlug)
            .filter((slug): slug is ColourSlug => slug !== null),
        ),
      ];

      const colourIds = new Map<ColourSlug, string>();

      for (const [position, colourSlug] of colourSlugs.entries()) {
        const savedColour = await prisma.productColor.upsert({
          where: { productId_slug: { productId: savedProduct.id, slug: colourSlug } },
          // No images: there is one photograph per product in this catalogue and
          // it is not of any particular finish. The gallery falls back to the
          // product's own images, and an admin uploading per-colour shots is
          // what turns the swatches into a preview.
          update: { ...COLOURS[colourSlug], position },
          create: {
            ...COLOURS[colourSlug],
            slug: colourSlug,
            position,
            productId: savedProduct.id,
          },
        });

        colourIds.set(colourSlug, savedColour.id);
      }

      for (const { colorSlug, ...variant } of variants) {
        const colorId = colorSlug === null ? null : (colourIds.get(colorSlug) ?? null);

        await prisma.productVariant.upsert({
          where: { sku: variant.sku },
          update: { ...variant, colorId, productId: savedProduct.id },
          create: { ...variant, colorId, productId: savedProduct.id },
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
