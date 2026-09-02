import type { Currency, Money, PricedQuery } from './common';

/**
 * The largest page `GET /products` will serve.
 *
 * Here rather than in the API alone because both sides need it: the API rejects
 * anything above it, and a caller that wants the whole catalogue — the sitemap —
 * has to know how big a bite it may take. A number invented on the client is a
 * 400 waiting to happen, and it is exactly the one that happened.
 */
export const MAX_PRODUCT_PAGE_SIZE = 60;

/**
 * A buyable configuration of a product.
 *
 * `label` and `price` are already resolved to the locale and currency the
 * request asked for; the currency they were resolved in is on the enclosing
 * product.
 */
export type ProductVariantDto = {
  id: string;
  sku: string;
  /** Human-readable summary, e.g. "256 ГБ · Графит". */
  label: string;
  /**
   * Which finish this variant is, as an id into the enclosing product's
   * `colors`. Null for a product sold in a single colour.
   */
  colorId: string | null;
  config: string | null;
  price: Money;
  stock: number;
};

/**
 * One finish a product is sold in.
 *
 * The images belong to the colour rather than the product because choosing a
 * finish is meant to show it: a shopper picking "Lavender" expects the lavender
 * device. `images` may be empty, and the gallery then falls back to the
 * product's own — a colour without photographs is a swatch, not a broken page.
 */
export type ProductColorDto = {
  id: string;
  /** Locale-independent handle — "lavender". Stable across a name correction. */
  slug: string;
  /** Already resolved to the requested locale. */
  name: string;
  /** `#rrggbb`. The swatch is painted with this, so it is data, not a token. */
  hex: string;
  images: string[];
};

/** The category a product belongs to, embedded in product responses. */
export type ProductCategoryDto = {
  slug: string;
  name: string;
};

/**
 * A tab on a category page — "Laptops" under Mac.
 *
 * The slug is what the tab filters on, so it is locale-independent; the name is
 * already resolved to the requested language.
 */
export type ProductGroupDto = {
  slug: string;
  name: string;
};

/**
 * Product as it appears in a catalogue grid — deliberately without variants or
 * description, so a listing stays cheap to serialise.
 * Response element of `GET /products`.
 */
export type ProductListItemDto = {
  id: string;
  slug: string;
  name: string;
  /** Manufacturer name — not translated, brands read the same in both locales. */
  brand: string;
  /**
   * One line under the name on a category page's model card. Null when the
   * product has none — the card then omits the line rather than falling back to
   * a truncated description.
   */
  tagline: string | null;
  basePrice: Money;
  /** Which currency `basePrice` (and every variant price) is quoted in. */
  currency: Currency;
  images: string[];
  /**
   * Cutout for the model rail on a category page. Null when the product has
   * none — the rail then falls back to the first gallery image.
   */
  navImage: string | null;
  featured: boolean;
  category: ProductCategoryDto;
  /** Null in a category with no tabs, and for anything filed under none. */
  group: ProductGroupDto | null;
};

/** Full product for the detail page. Response of `GET /products/:slug`. */
export type ProductDetailDto = ProductListItemDto & {
  description: string;
  /** `.glb` model for the Phase 5 viewer; null until one is uploaded. */
  model3dUrl: string | null;
  /** In display order. Empty for a product sold in a single finish. */
  colors: ProductColorDto[];
  variants: ProductVariantDto[];
};

/** Accepted query string of `GET /products`. */
export type ProductListQuery = PricedQuery & {
  category?: string;
  featured?: boolean;
  page?: number;
  pageSize?: number;
};
