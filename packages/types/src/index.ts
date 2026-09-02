/**
 * @imix/types — the single source of truth for the API contract.
 *
 * Both `apps/api` and `apps/web` import from here, so a change to a response
 * shape breaks compilation on whichever side has not been updated.
 */

export { ADMIN_ORDER_TRANSITIONS, canTransition } from './admin';
export type {
  AdminCatalogueStatsDto,
  AdminCategoryDto,
  AdminCategoryRefDto,
  AdminColorDto,
  AdminOrderCountsDto,
  AdminOrderDto,
  AdminOrderListQuery,
  AdminProductDto,
  AdminProductGroupDto,
  AdminProductListItemDto,
  AdminRevenueDto,
  AdminStatsDto,
  AdminVariantDto,
  CategoryWriteRequest,
  ColorWriteRequest,
  CreateProductRequest,
  ProductWriteRequest,
  UpdateOrderStatusRequest,
  UploadedAssetDto,
  VariantWriteRequest,
} from './admin';
export { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, ROLES } from './auth';
export type {
  AccessTokenPayload,
  AuthResponse,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  Role,
  UserDto,
} from './auth';
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
export {
  HOME_TILE_SURFACES,
  HOME_TILE_WIDTHS,
  TILE_MOVE_DIRECTIONS,
} from './home-tile';
export type {
  AdminHomeTileDto,
  HomeTileActionDto,
  HomeTileActions,
  HomeTileDto,
  HomeTileListQuery,
  HomeTileSurface,
  HomeTileWidth,
  HomeTileWriteRequest,
  MoveHomeTileRequest,
  TileMoveDirection,
} from './home-tile';
export { MAX_ORDER_ITEM_QUANTITY, ORDER_STATUSES } from './order';
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
export { MAX_PRODUCT_PAGE_SIZE } from './product';
export type {
  ProductCategoryDto,
  ProductColorDto,
  ProductDetailDto,
  ProductGroupDto,
  ProductListItemDto,
  ProductListQuery,
  ProductVariantDto,
} from './product';
