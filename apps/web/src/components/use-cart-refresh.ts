'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Currency, Locale } from '@imix/types';
import { isStale } from '@/lib/cart';
import { refreshCart } from '@/lib/refresh-cart';
import { useCartStore } from '@/stores/cart-store';

/**
 * Shared by the language and currency switchers: both invalidate the cart's
 * denormalised copy of the catalogue, and neither may commit its change until
 * the cart agrees — a rouble total under a dollar header, or English labels on
 * a Russian page, is worse than a switch that did not happen.
 *
 * Returns whether the caller may proceed.
 */
export function useCartRefresh(): {
  refresh: (locale: Locale, currency: Currency) => Promise<boolean>;
  error: string | null;
} {
  const t = useTranslations('cart');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (locale: Locale, currency: Currency): Promise<boolean> => {
      setError(null);
      const { lines, replaceLines } = useCartStore.getState();

      if (!isStale(lines, locale, currency)) {
        return true;
      }

      try {
        replaceLines(await refreshCart(lines, { locale, currency }));
        return true;
      } catch {
        setError(t('refreshFailed'));
        return false;
      }
    },
    [t],
  );

  return { refresh, error };
}
