/**
 * @imix/types — the single source of truth for the API contract.
 *
 * Both `apps/api` and `apps/web` import from here, so a change to a response
 * shape breaks compilation on whichever side has not been updated.
 */

export {
  CURRENCIES,
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  LOCALES,
} from './common';
export type {
  ApiError,
  Currency,
  Locale,
  LocalisedQuery,
  Money,
  Paginated,
  PricedQuery,
} from './common';
export type { CategoryDto, CategoryListQuery } from './category';
export type { HealthResponse } from './health';
export type {
  HomeTileActionDto,
  HomeTileActions,
  HomeTileDto,
  HomeTileListQuery,
  HomeTileSurface,
  HomeTileWidth,
} from './home-tile';
export { MAX_ORDER_ITEM_QUANTITY } from './order';
export type {
  CreateOrderItemDto,
  CreateOrderRequest,
  OrderDto,
  OrderItemDto,
  OrderQuery,
  OrderStatus,
  ShippingAddressDto,
} from './order';
export type { CreatePaymentIntentRequest, PaymentIntentDto } from './payment';
export type {
  ProductCategoryDto,
  ProductDetailDto,
  ProductListItemDto,
  ProductListQuery,
  ProductVariantDto,
} from './product';
