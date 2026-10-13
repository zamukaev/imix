import type { Currency, LocalisedQuery, Money } from './common';
import type { OrderDto, OrderStatus } from './order';

/**
 * The admin's view of the catalogue.
 *
 * Everything below carries **both languages and both prices**, where the public
 * DTOs carry one of each. That is the whole difference: a shopper is shown one
 * resolved language, whereas the person editing the shop owns all of it and
 * cannot fill in what they cannot see.
 *
 * Neither is optional anywhere in these shapes. A product with a Russian name
 * and no English one is a product that is broken in half the shop, and a price
 * in one currency only cannot be charged in the other — there is no rate in this
 * system to fall back on.
 */
export type AdminCategoryRefDto = {
  id: string;
  slug: string;
  nameRu: string;
  nameEn: string;
};

/** A tab of a category page, as the admin edits products against it. */
export type AdminProductGroupDto = {
  id: string;
  slug: string;
  nameRu: string;
  nameEn: string;
};

export type AdminCategoryDto = AdminCategoryRefDto & {
  /** Why a category may refuse to be deleted. */
  productCount: number;
  /** The tabs a product in this category may be filed under, in display order. */
  groups: AdminProductGroupDto[];
};

/** Body of `POST /admin/categories` and `PATCH /admin/categories/:id`. */
export type CategoryWriteRequest = {
  /** Locale-independent: "iphone", "mac". Part of the category's URL. */
  slug: string;
  nameRu: string;
  nameEn: string;
};

/** One finish, as the admin edits it. */
export type AdminColorDto = {
  id: string;
  slug: string;
  nameRu: string;
  nameEn: string;
  /** `#rrggbb`. */
  hex: string;
  images: string[];
  position: number;
  /**
   * True while a variant still names this colour. Deleting it would leave those
   * variants without a finish, so the admin has to move them off it first.
   */
  inUse: boolean;
};

export type ColorWriteRequest = {
  slug: string;
  nameRu: string;
  nameEn: string;
  hex: string;
  images: string[];
};

export type AdminVariantDto = {
  id: string;
  sku: string;
  labelRu: string;
  labelEn: string;
  /** Id of one of the product's colours, or null for a single-finish product. */
  colorId: string | null;
  config: string | null;
  priceRub: Money;
  priceUsd: Money;
  stock: number;
  /**
   * True once an order references this variant. It can still be edited — a
   * price change does not touch `priceAtPurchase` — but it can no longer be
   * deleted without taking somebody's order history with it.
   */
  sold: boolean;
};

export type VariantWriteRequest = {
  sku: string;
  labelRu: string;
  labelEn: string;
  /**
   * A colour's `slug`, not its id: the request that creates a product's colours
   * is the one that creates its variants, so an id does not exist yet on the
   * client. The API resolves it against the colours in the same body.
   */
  colorSlug?: string | null;
  config?: string | null;
  priceRub: Money;
  priceUsd: Money;
  stock: number;
};

export type AdminProductListItemDto = {
  id: string;
  slug: string;
  nameRu: string;
  nameEn: string;
  brand: string;
  featured: boolean;
  category: AdminCategoryRefDto;
  /**
   * Derived, not entered: the cheapest variant's price in each currency. The
   * catalogue grid prints it as "from …", so letting an admin type it would let
   * the grid disagree with what the variant picker charges.
   */
  basePriceRub: Money;
  basePriceUsd: Money;
  images: string[];
  variantCount: number;
  /** Summed across variants — the number that answers "can I still sell it?". */
  stock: number;
};

export type AdminProductDto = AdminProductListItemDto & {
  descriptionRu: string;
  descriptionEn: string;
  /** One line for the model card on a category page. Optional in both languages. */
  taglineRu: string | null;
  taglineEn: string | null;
  /** Cutout for the category page's model rail; null falls back to `images[0]`. */
  navImageUrl: string | null;
  /** Which tab of the category page this model sits under; null means none. */
  groupId: string | null;
  model3dUrl: string | null;
  /** In display order — the order the swatch row uses. */
  colors: AdminColorDto[];
  variants: AdminVariantDto[];
};

/** Body of `PATCH /admin/products/:id`. Variants have their own endpoints. */
export type ProductWriteRequest = {
  slug: string;
  nameRu: string;
  nameEn: string;
  descriptionRu: string;
  descriptionEn: string;
  taglineRu?: string | null;
  taglineEn?: string | null;
  /** "Apple" — a manufacturer's name is not translated. */
  brand: string;
  categoryId: string;
  /** Must be a group of `categoryId`; the API refuses one from another category. */
  groupId?: string | null;
  images: string[];
  navImageUrl?: string | null;
  model3dUrl?: string | null;
  featured: boolean;
  /**
   * The product's finishes, in display order. The whole list every time: a
   * colour missing from it is deleted, which is how the variant list already
   * works and keeps one product edit to one request.
   */
  colors?: ColorWriteRequest[];
};

/**
 * Body of `POST /admin/products`.
 *
 * At least one variant, because a product's prices are derived from its
 * variants: one with none would sit in the catalogue at zero.
 */
export type CreateProductRequest = ProductWriteRequest & {
  variants: VariantWriteRequest[];
};

/** Response of `POST /admin/upload`. */
export type UploadedAssetDto = {
  /** Either a path this shop serves or an absolute URL at the CDN. */
  url: string;
};

/**
 * An order as the admin list shows it: everything the confirmation page shows,
 * plus who placed it.
 *
 * `total` still travels next to `currency`, and that pairing matters more here
 * than anywhere else in the shop — the list mixes roubles and dollars in
 * adjacent rows, so an amount without its currency beside it is a number that
 * means two different things.
 */
export type AdminOrderDto = OrderDto & {
  /** Null for a guest checkout, which stays a first-class flow. */
  userId: string | null;
};

export type AdminOrderListQuery = LocalisedQuery & {
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
};

/** Body of `PATCH /admin/orders/:id`. */
export type UpdateOrderStatusRequest = {
  status: OrderStatus;
};

/**
 * Which statuses an admin may move an order to, from where.
 *
 * Shared rather than restated on each side: the list is what the UI offers and
 * what the API enforces, and two copies of it would eventually disagree about
 * something that decides whether a parcel is owed.
 *
 * **PAID and FAILED appear in no list.** They are the payment provider's to
 * set — the webhook writes them, and an admin who could type PAID could record
 * money that never arrived. What the admin owns is fulfilment.
 *
 * SHIPPED and CANCELLED are terminal. A parcel that has gone is not a status
 * field's problem, and a returns flow is a feature, not a dropdown.
 */
export const ADMIN_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ADMIN_ORDER_TRANSITIONS[from].includes(to);
}

/**
 * What the shop took, in one currency.
 *
 * There is one of these per currency the shop quotes, always — a currency with
 * no orders yet reports zero rather than going missing, so the dashboard shows
 * the same columns on day one as it does in year two.
 *
 * These totals are **never added together**. There is no exchange rate anywhere
 * in this system (see the header of `apps/api/prisma/schema.prisma`), so a
 * combined figure would be a number nobody could reproduce from the orders.
 */
export type AdminRevenueDto = {
  currency: Currency;
  /** Minor units of `currency`. Meaningless without it. */
  total: Money;
  /** How many orders make up `total` — an average is not worth a round trip. */
  orders: number;
};

/** Every status carries a count, including the ones sitting at zero. */
export type AdminOrderCountsDto = Record<OrderStatus, number>;

export type AdminCatalogueStatsDto = {
  categories: number;
  products: number;
  variants: number;
  /** Variants at zero stock — the one catalogue number that needs acting on. */
  outOfStockVariants: number;
};

/** Response of `GET /admin/stats`. */
export type AdminStatsDto = {
  catalogue: AdminCatalogueStatsDto;
  orders: {
    total: number;
    byStatus: AdminOrderCountsDto;
  };
  revenue: AdminRevenueDto[];
};
