'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { DEFAULT_CURRENCY, type Currency, type Locale, type Money } from '@imix/types';
import { formatMoney } from '@/lib/format';

/**
 * Carries the currency the server already decided on (from the cookie) into the
 * client islands, so a price rendered on the server and one rendered in the
 * browser can never disagree.
 */
const CurrencyContext = createContext<Currency>(DEFAULT_CURRENCY);

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: Currency;
  children: ReactNode;
}) {
  return (
    <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency(): Currency {
  return useContext(CurrencyContext);
}

/**
 * `const money = useMoney()` → `money(line.unitPrice)`.
 *
 * Bundling locale and currency here is what keeps every call site from having
 * to thread both through, which is where a mismatched pair would creep in.
 */
export function useMoney(): (amount: Money) => string {
  const locale = useLocale();
  const currency = useCurrency();

  return useCallback(
    (amount: Money) => formatMoney(amount, locale, currency),
    [locale, currency],
  );
}

/** The locale and currency pair, for client code that calls the API itself. */
export function useRequestContext(): { locale: Locale; currency: Currency } {
  const locale = useLocale();
  const currency = useCurrency();

  return useMemo(() => ({ locale, currency }), [locale, currency]);
}
