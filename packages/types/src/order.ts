import type { Currency, LocalisedQuery, Money } from './common';

/**
 * Ceiling on a single order line. Lives here rather than in either app because
 * it is part of the contract: the storefront caps the quantity stepper with it
 * and the API rejects anything above it.
 */
export const MAX_ORDER_ITEM_QUANTITY = 10;

/** Lifecycle of an order. Mirrors the `OrderStatus` enum in the Prisma schema. */
export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'SHIPPED' | 'CANCELLED';

/** Where the parcel goes. Flat on purpose — one order, one destination. */
export type ShippingAddressDto = {
  name: string;
  address: string;
  city: string;
  zip: string;
  /** ISO 3166-1 alpha-2, uppercase — e.g. "RU". */
  country: string;
};

/**
 * A requested line. Only identity and amount: the price is looked up server-side
 * from `ProductVariant`, so a tampered client cannot set its own total.
 */
export type CreateOrderItemDto = {
  variantId: string;
  quantity: number;
};

/** Request body of `POST /orders`. */
export type CreateOrderRequest = {
  /** Where the confirmation goes. The only owner reference on a guest order. */
  email: string;
  /**
   * Which of the shop's currencies the buyer is paying in. Required rather than
   * defaulted: the server prices every line from the matching stored column, so
   * guessing here would mean charging in a currency the buyer never saw.
   */
  currency: Currency;
  shipping: ShippingAddressDto;
  items: CreateOrderItemDto[];
};

/**
 * A purchased line. Product fields are resolved at read time for display;
 * `priceAtPurchase` is the frozen snapshot and never re-derived.
 */
export type OrderItemDto = {
  id: string;
  variantId: string;
  sku: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  image: string | null;
  quantity: number;
  priceAtPurchase: Money;
};

/** Response of `POST /orders` and `GET /orders/:id`. */
export type OrderDto = {
  id: string;
  status: OrderStatus;
  email: string;
  /** Sum of the lines in minor units, computed by the server. */
  total: Money;
  /**
   * The currency the order was placed in. Frozen with the order: switching the
   * storefront to the other currency afterwards must not restate what was
   * charged.
   */
  currency: Currency;
  shipping: ShippingAddressDto;
  items: OrderItemDto[];
  /** ISO 8601 — JSON has no date type. */
  createdAt: string;
};

/**
 * Accepted query string of `GET /orders/:id`. Only the language: the currency
 * is whatever the order was placed in and is never re-resolved.
 */
export type OrderQuery = LocalisedQuery;
