import {
  MAX_ORDER_ITEM_QUANTITY,
  type Currency,
  type Locale,
  type Money,
} from '@imix/types';

/**
 * Cart domain logic, kept free of React and of storage so it can be reasoned
 * about (and tested) on its own. `cart-store.ts` is the thin Zustand wrapper.
 *
 * Every function here is pure and returns a new array — the store never mutates
 * its state in place.
 *
 * The cart is client-only in the MVP; the server re-computes the real total from
 * the database at checkout and never trusts these prices.
 */

/**
 * Ceiling per line, so a fat-fingered stepper cannot order 900 phones. Comes
 * from the shared contract because `POST /orders` enforces the same number.
 */
export const MAX_LINE_QUANTITY = MAX_ORDER_ITEM_QUANTITY;

/**
 * A cart line. Product fields are denormalised copies taken when the line was
 * added, so `/cart` renders without a round trip to the API.
 *
 * Those copies are a snapshot of a *language* and a *currency*, which is why
 * both are recorded on the line: switching either makes the text or the price
 * stale, and the only honest fix is to re-fetch (see `refreshLines`).
 */
export type CartLine = {
  /** Identity of a line — one variant appears at most once in the cart. */
  variantId: string;
  productSlug: string;
  productName: string;
  brand: string;
  variantLabel: string;
  /** Price snapshot in minor units; display only, re-checked server-side. */
  unitPrice: Money;
  /**
   * Which currency `unitPrice` is a snapshot in. There is no exchange rate in
   * this shop, so a line priced in roubles says nothing about its dollar price
   * — switching currency re-fetches instead of converting.
   */
  currency: Currency;
  /** Which language `productName` and `variantLabel` were copied in. */
  locale: Locale;
  image: string | null;
  /** Stock at the time of adding — caps the quantity the user can pick. */
  stock: number;
  quantity: number;
};

/** What a caller supplies when adding to the cart; quantity is applied on top. */
export type CartLineInput = Omit<CartLine, 'quantity'>;

/** The most of a variant a user may hold, given stock and the per-line ceiling. */
export function lineLimit(line: Pick<CartLine, 'stock'>): number {
  return Math.min(line.stock, MAX_LINE_QUANTITY);
}

function clampQuantity(quantity: number, limit: number): number {
  return Math.max(0, Math.min(Math.trunc(quantity), limit));
}

/**
 * Adds a variant, or tops up the quantity if it is already in the cart. The
 * newest product data wins, so a renamed or repriced variant refreshes on
 * re-add. Returns the cart unchanged when the variant is out of stock.
 */
export function addLine(
  lines: readonly CartLine[],
  input: CartLineInput,
  quantity = 1,
): CartLine[] {
  const limit = lineLimit(input);

  if (limit < 1) {
    return [...lines];
  }

  const existing = lines.find((line) => line.variantId === input.variantId);
  const nextQuantity = clampQuantity((existing?.quantity ?? 0) + quantity, limit);

  if (nextQuantity < 1) {
    return removeLine(lines, input.variantId);
  }

  const next: CartLine = { ...input, quantity: nextQuantity };

  return existing
    ? lines.map((line) => (line.variantId === input.variantId ? next : line))
    : [...lines, next];
}

/** Sets an absolute quantity. A quantity of 0 (or less) drops the line. */
export function setLineQuantity(
  lines: readonly CartLine[],
  variantId: string,
  quantity: number,
): CartLine[] {
  const existing = lines.find((line) => line.variantId === variantId);

  if (!existing) {
    return [...lines];
  }

  const nextQuantity = clampQuantity(quantity, lineLimit(existing));

  return nextQuantity < 1
    ? removeLine(lines, variantId)
    : lines.map((line) =>
        line.variantId === variantId ? { ...line, quantity: nextQuantity } : line,
      );
}

export function removeLine(lines: readonly CartLine[], variantId: string): CartLine[] {
  return lines.filter((line) => line.variantId !== variantId);
}

/** The per-variant data a refresh replaces, as fetched from the API. */
export type FreshVariant = Pick<
  CartLine,
  'unitPrice' | 'stock' | 'productName' | 'variantLabel'
>;

/**
 * Restates the cart in `locale` and `currency` from freshly fetched data.
 *
 * Both the prices *and* the product text are replaced: a cart added to while
 * browsing in English must not keep showing English labels once the shop is in
 * Russian, any more than it may keep rouble prices under a dollar header.
 *
 * A line whose variant is missing from `fresh` is dropped: the variant is gone
 * from the catalogue, and keeping it would only fail at checkout. Quantities
 * survive, but are re-clamped in case stock fell in the meantime.
 */
export function refreshLines(
  lines: readonly CartLine[],
  fresh: ReadonlyMap<string, FreshVariant>,
  locale: Locale,
  currency: Currency,
): CartLine[] {
  return lines.flatMap((line) => {
    const current = fresh.get(line.variantId);

    if (!current) {
      return [];
    }

    const quantity = clampQuantity(line.quantity, lineLimit(current));

    return quantity < 1 ? [] : [{ ...line, ...current, locale, currency, quantity }];
  });
}

/**
 * True when any line was captured in a different language or currency than the
 * one now active — i.e. when a refresh would actually change something.
 */
export function isStale(
  lines: readonly CartLine[],
  locale: Locale,
  currency: Currency,
): boolean {
  return lines.some(
    (line) => line.currency !== currency || line.locale !== locale,
  );
}

/** Total number of devices in the cart — what the header badge shows. */
export function cartItemCount(lines: readonly CartLine[]): number {
  return lines.reduce((count, line) => count + line.quantity, 0);
}

/** Sum of the lines in minor units. Shipping and tax are out of scope for now. */
export function cartSubtotal(lines: readonly CartLine[]): Money {
  return lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
}
