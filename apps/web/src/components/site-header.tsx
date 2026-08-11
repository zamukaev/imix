import { getTranslations } from 'next-intl/server';
import { AccountLink } from '@/components/account-link';
import { CartLink } from '@/components/cart-link';
import { CategoryNav } from '@/components/category-nav';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Link } from '@/i18n/navigation';
import { getCategories } from '@/lib/api';
import { getRequestContext } from '@/lib/request-context';

/**
 * Storefront chrome. Server Component — the category nav comes straight from
 * the API in the active language, so adding a category in the admin (Phase 3)
 * surfaces it here with no code change.
 *
 * `relative` on the `<nav>` is load-bearing: the mobile category panel is
 * absolutely positioned against it, so it drops below the whole bar rather than
 * below the toggle button.
 */
export async function SiteHeader() {
  const [{ locale, currency }, t] = await Promise.all([
    getRequestContext(),
    getTranslations('nav'),
  ]);
  const categories = await getCategories({ locale }).catch(() => []);

  return (
    <header className="border-line bg-surface/80 sticky top-0 z-10 border-b backdrop-blur">
      <nav
        aria-label={t('primary')}
        className="relative mx-auto flex max-w-6xl items-center gap-4 px-6 py-4 sm:gap-8"
      >
        <Link href="/" className="text-xl font-semibold tracking-tight">
          iMIX
        </Link>

        <CategoryNav categories={categories} />

        <div className="flex items-center gap-3 sm:gap-4">
          <CurrencySwitcher current={currency} />
          <LanguageSwitcher current={locale} currency={currency} />
          <AccountLink />
          <CartLink />
        </div>
      </nav>
    </header>
  );
}
