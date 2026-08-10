import type { LocalisedQuery } from './common';

/**
 * A catalogue category. Response element of `GET /categories`.
 *
 * `name` is already resolved to the requested locale — the API stores one name
 * per language and hands out the single one the caller asked for, so the
 * storefront never sees the other translation.
 */
export type CategoryDto = {
  id: string;
  slug: string;
  name: string;
  /** How many products the category currently holds. */
  productCount: number;
};

/** Accepted query string of `GET /categories`. */
export type CategoryListQuery = LocalisedQuery;
