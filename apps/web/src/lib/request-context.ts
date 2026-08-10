import { cookies } from 'next/headers';
import { hasLocale } from 'next-intl';
import { getLocale } from 'next-intl/server';
import type { Currency, Locale } from '@imix/types';
import { routing } from '@/i18n/routing';
import { CURRENCY_COOKIE, parseCurrency } from './currency';

/**
 * The two things every catalogue request needs to be answered: which language
 * to write it in and which currency to price it in. The locale comes from the
 * URL (next-intl), the currency from the shopper's cookie.
 *
 * Server-only — client islands read the same pair from `CurrencyProvider` and
 * `useLocale()`.
 */
export type RequestContext = {
  locale: Locale;
  currency: Currency;
};

export async function getRequestContext(): Promise<RequestContext> {
  const [active, cookieStore] = await Promise.all([getLocale(), cookies()]);

  return {
    // Narrowed rather than cast: `getLocale` is typed as a bare string, and a
    // cast here would hide a routing misconfiguration instead of correcting it.
    locale: hasLocale(routing.locales, active) ? active : routing.defaultLocale,
    currency: parseCurrency(cookieStore.get(CURRENCY_COOKIE)?.value),
  };
}
