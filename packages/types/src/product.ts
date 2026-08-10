import type { Currency, Money, PricedQuery } from './common';

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
  color: string | null;
  config: string | null;
  price: Money;
  stock: number;
};

/** The category a product belongs to, embedded in product responses. */
export type ProductCategoryDto = {
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
  basePrice: Money;
  /** Which currency `basePrice` (and every variant price) is quoted in. */
  currency: Currency;
  images: string[];
  featured: boolean;
  category: ProductCategoryDto;
};

/** Full product for the detail page. Response of `GET /products/:slug`. */
export type ProductDetailDto = ProductListItemDto & {
  description: string;
  /** `.glb` model for the Phase 5 viewer; null until one is uploaded. */
  model3dUrl: string | null;
  variants: ProductVariantDto[];
};

/** Accepted query string of `GET /products`. */
export type ProductListQuery = PricedQuery & {
  category?: string;
  featured?: boolean;
  page?: number;
  pageSize?: number;
};
