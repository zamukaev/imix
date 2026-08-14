import type { LocalisedQuery } from './common';
import type { ProductGroupDto } from './product';

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
  /**
   * The tabs the category page offers, in display order. Empty for most lines;
   * fewer than two means the page shows no tab bar at all, because a single tab
   * is not a choice.
   */
  groups: ProductGroupDto[];
};

/** Accepted query string of `GET /categories`. */
export type CategoryListQuery = LocalisedQuery;
