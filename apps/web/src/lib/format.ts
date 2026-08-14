import type { Currency, Locale, Money } from '@imix/types';

/**
 * Rendering money, dates and places.
 *
 * Every function takes the locale explicitly rather than reading an ambient
 * one: these run in Server Components, in client islands and in tests, and a
 * hidden global would render the wrong language in at least one of them.
 *
 * Money always arrives paired with the currency it was priced in — the API
 * never sends an amount without one — so nothing here converts or guesses.
 */

const MINOR_UNITS_PER_MAJOR = 100;

/** BCP 47 tags for the shop's locales. `ru` alone would not pick a region. */
const INTL_LOCALES: Record<Locale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
};

/**
 * `Intl` constructors are slow enough that rebuilding one per row of a
 * catalogue shows up in a profile; there are only a handful of combinations, so
 * they are built once and kept.
 */
const currencyFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<Locale, Intl.DateTimeFormat>();
const regionNames = new Map<Locale, Intl.DisplayNames>();

function currencyFormatter(locale: Locale, currency: Currency): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  const cached = currencyFormatters.get(key);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: 'currency',
    currency,
    // Devices are whole-rouble goods; trailing ",00" is noise on every price.
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  currencyFormatters.set(key, formatter);

  return formatter;
}

/**
 * Renders integer minor units as currency.
 * `formatMoney(14999000, 'ru', 'RUB')` → "149 990 ₽".
 * `formatMoney(109900, 'en', 'USD')` → "$1,099".
 */
export function formatMoney(
  amount: Money,
  locale: Locale,
  currency: Currency,
): string {
  return currencyFormatter(locale, currency).format(
    amount / MINOR_UNITS_PER_MAJOR,
  );
}

function dateFormatter(locale: Locale): Intl.DateTimeFormat {
  const cached = dateFormatters.get(locale);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  dateFormatters.set(locale, formatter);

  return formatter;
}

/** Renders an ISO timestamp from the API. `9 августа 2026 г. в 13:05`. */
export function formatDateTime(isoDate: string, locale: Locale): string {
  return dateFormatter(locale).format(new Date(isoDate));
}

const dayFormatters = new Map<Locale, Intl.DateTimeFormat>();

/**
 * The same instant without the clock. `9 августа 2026 г.`
 *
 * For dates where the time of day carries nothing — when an account was opened,
 * not when an order was placed. Printing "at 11:39 PM" next to a signup year is
 * precision nobody asked for.
 */
export function formatDate(isoDate: string, locale: Locale): string {
  const cached = dayFormatters.get(locale);
  const formatter =
    cached ??
    new Intl.DateTimeFormat(INTL_LOCALES[locale], { dateStyle: 'long' });

  if (!cached) {
    dayFormatters.set(locale, formatter);
  }

  return formatter.format(new Date(isoDate));
}

function regionDisplayNames(locale: Locale): Intl.DisplayNames {
  const cached = regionNames.get(locale);

  if (cached) {
    return cached;
  }

  const names = new Intl.DisplayNames([INTL_LOCALES[locale]], {
    type: 'region',
  });
  regionNames.set(locale, names);

  return names;
}

/** `"RU"` → `"Россия"` / `"Russia"`. Falls back to the code if unrecognised. */
export function formatCountry(code: string, locale: Locale): string {
  return regionDisplayNames(locale).of(code) ?? code;
}
