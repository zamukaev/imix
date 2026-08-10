'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { CURRENCIES, type Currency } from '@imix/types';
import { useCartRefresh } from '@/components/use-cart-refresh';
import { currencyCookieValue } from '@/lib/currency';

/** The symbol each currency is recognised by, short enough for the header. */
const CURRENCY_LABELS: Record<Currency, string> = {
  RUB: '₽',
  USD: '$',
};

/**
 * Switches the currency the whole storefront is priced in.
 *
 * Order matters: the cart is re-fetched first, and the cookie is only written
 * if that succeeded. Leaving the shop in the currency the cart is actually
 * priced in beats a mismatched pair.
 */
export function CurrencySwitcher({ current }: { current: Currency }) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const { refresh, error } = useCartRefresh();
  const [isPending, startTransition] = useTransition();

  async function switchTo(currency: Currency) {
    if (currency === current || isPending) {
      return;
    }

    if (!(await refresh(locale, currency))) {
      return;
    }

    document.cookie = currencyCookieValue(currency);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1 text-sm" role="group" aria-label={t('currency')}>
        {CURRENCIES.map((currency) => (
          <button
            key={currency}
            type="button"
            onClick={() => void switchTo(currency)}
            disabled={isPending}
            aria-current={currency === current}
            className={
              currency === current
                ? 'text-ink font-medium'
                : 'text-ink-muted hover:text-ink transition-colors disabled:opacity-50'
            }
          >
            {CURRENCY_LABELS[currency]}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
