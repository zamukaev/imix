/**
 * @imix/types — the single source of truth for the API contract.
 *
 * Both `apps/api` and `apps/web` import from here, so a change to a response
 * shape breaks compilation on whichever side has not been updated.
 */

export type { ApiError, Money, Paginated } from './common';
export type { CategoryDto } from './category';
export type { HealthResponse } from './health';
export type {
  ProductCategoryDto,
  ProductDetailDto,
  ProductListItemDto,
  ProductListQuery,
  ProductVariantDto,
} from './product';
