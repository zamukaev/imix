'use client';

import { useTranslations } from 'next-intl';
import { LOCALES, type Currency, type Locale } from '@imix/types';
import { useCartRefresh } from '@/components/use-cart-refresh';
import { usePathname, useRouter } from '@/i18n/navigation';

/** What each language calls itself — never translated into the other one. */
const LANGUAGE_NAMES: Record<Locale, string> = {
  ru: 'RU',
  en: 'EN',
};

type LanguageSwitcherProps = {
  current: Locale;
  /** Unchanged by this switcher, but the cart is re-fetched in both at once. */
  currency: Currency;
};

/**
 * Switches language while staying on the same page.
 *
 * The cart carries denormalised product names and variant labels, so it has to
 * be re-fetched too — otherwise a Russian page shows a cart full of English.
 */
export function LanguageSwitcher({ current, currency }: LanguageSwitcherProps) {
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const { refresh, error } = useCartRefresh();

  async function switchTo(locale: Locale) {
    if (locale === current) {
      return;
    }

    if (!(await refresh(locale, currency))) {
      return;
    }

    // `usePathname` here returns the path with the locale prefix already
    // stripped and dynamic segments already filled in, so re-pushing it under a
    // different locale lands on the same page in the other language.
    router.replace(pathname, { locale });
  }

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1 text-sm" role="group" aria-label={t('language')}>
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            lang={locale}
            onClick={() => void switchTo(locale)}
            aria-current={locale === current}
            className={
              locale === current
                ? 'text-ink font-medium'
                : 'text-ink-muted hover:text-ink transition-colors'
            }
          >
            {LANGUAGE_NAMES[locale]}
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
