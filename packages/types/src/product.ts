import type { Money } from './common';

/** A buyable configuration of a product. */
export type ProductVariantDto = {
  id: string;
  sku: string;
  /** Human-readable summary, e.g. "256 GB · Graphite". */
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
  brand: string;
  basePrice: Money;
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
export type ProductListQuery = {
  category?: string;
  featured?: boolean;
  page?: number;
  pageSize?: number;
};
