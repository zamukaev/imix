import type { Currency, Locale, Money } from '@imix/types';

/**
 * Picking a language and a currency out of a database row.
 *
 * Rows store every shopper-facing string twice (`nameRu` / `nameEn`) and every
 * price twice (`priceRub` / `priceUsd`); a DTO carries exactly one of each. The
 * two helpers below are the only place that choice is made, so no service has to
 * build column names out of strings.
 */

/** `text(locale, { ru: row.nameRu, en: row.nameEn })` → the one string to send. */
export function text(locale: Locale, translations: Record<Locale, string>): string {
  return translations[locale];
}

/**
 * `text()` for a column pair that may be empty on both sides.
 *
 * A separate helper rather than a ternary at the call site: the nullable pair is
 * its own shape — an optional line is absent in *both* languages or present in
 * both, and `null` has to survive to the DTO so the UI can drop the element
 * instead of rendering an empty one.
 */
export function optionalText(
  locale: Locale,
  translations: Record<Locale, string | null>,
): string | null {
  return translations[locale];
}

/** `amount(currency, { RUB: row.priceRub, USD: row.priceUsd })` → what to charge. */
export function amount(
  currency: Currency,
  prices: Record<Currency, Money>,
): Money {
  return prices[currency];
}

/** The column a locale sorts and filters on, for `orderBy` clauses. */
export function nameColumn(locale: Locale): 'nameRu' | 'nameEn' {
  return locale === 'ru' ? 'nameRu' : 'nameEn';
}

/** The price column a currency sorts on, for `orderBy` clauses. */
export function priceColumn(currency: Currency): 'priceRub' | 'priceUsd' {
  return currency === 'RUB' ? 'priceRub' : 'priceUsd';
}
