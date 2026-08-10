/**
 * An amount in integer **minor units** — never a float. Which unit depends on
 * the accompanying `Currency`: `199900` is 1 999,00 ₽ in RUB and $1,999.00 in
 * USD. An amount is therefore only meaningful next to the currency it was
 * priced in, which is why every DTO carrying money also carries a `Currency`.
 */
export type Money = number;

/**
 * Languages the storefront speaks. Russian is the shop's primary language;
 * English is the secondary one.
 */
export const LOCALES = ['ru', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** Used whenever a request does not say which language it wants. */
export const DEFAULT_LOCALE: Locale = 'ru';

/**
 * Currencies the catalogue is priced in. Each price is **stored** per currency
 * rather than converted at read time: the merchant sets both, so no exchange
 * rate can drift and no rounding can turn a listed price into a different
 * charge.
 */
export const CURRENCIES = ['RUB', 'USD'] as const;

export type Currency = (typeof CURRENCIES)[number];

/** Used whenever a request does not say which currency it wants. */
export const DEFAULT_CURRENCY: Currency = 'RUB';

/** Every list endpoint accepts these; both fall back to the defaults above. */
export type LocalisedQuery = {
  locale?: Locale;
};

export type PricedQuery = LocalisedQuery & {
  currency?: Currency;
};

/** Envelope for every paginated list endpoint. */
export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

/** Shape NestJS' default exception filter serialises errors into. */
export type ApiError = {
  statusCode: number;
  message: string | string[];
  error?: string;
};
