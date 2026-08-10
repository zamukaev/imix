import { CURRENCIES, DEFAULT_CURRENCY, type Currency } from '@imix/types';

/**
 * Where the shopper's currency choice lives.
 *
 * A cookie rather than component state, because the catalogue is rendered on
 * the server: the price a Server Component prints has to be decided before any
 * JavaScript runs. It is deliberately not `httpOnly` — the switcher writes it
 * from the browser.
 */
export const CURRENCY_COOKIE = 'imix-currency';

/** A year: a currency preference is not something to re-ask on every visit. */
export const CURRENCY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Narrows an untrusted cookie value; anything unrecognised falls back. */
export function parseCurrency(value: string | undefined): Currency {
  return CURRENCIES.find((currency) => currency === value) ?? DEFAULT_CURRENCY;
}

/** The `Set-Cookie`-style attributes the client switcher writes. */
export function currencyCookieValue(currency: Currency): string {
  return `${CURRENCY_COOKIE}=${currency}; path=/; max-age=${CURRENCY_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}
