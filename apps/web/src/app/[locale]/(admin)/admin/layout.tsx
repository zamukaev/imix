import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { SignOutButton } from '@/components/sign-out-button';
import { Logo } from '@/components/ui/logo';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { redirectLocalised } from '@/lib/redirect-localised';
import { getSession } from '@/lib/session';

type AdminLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  // Nothing under /admin belongs in an index, and none of it is reachable
  // without a session anyway.
  robots: { index: false, follow: false },
};

/**
 * The admin's own chrome — no storefront header, no cart, no currency switcher.
 * This is a tool, not a shop window: the tile language in ARCHITECTURE.md §5 is
 * for the marketing surface and deliberately does not apply here.
 *
 * The role is checked again even though the middleware already redirected.
 * Middleware is one layer, this is the second, and the API's guard is the one
 * that actually decides — a shell rendered for the wrong person would show
 * nothing but 403s, and it should not render at all.
 */
export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const [session, t] = await Promise.all([getSession(), getTranslations('admin')]);

  // Two different refusals: nobody signed in goes to the door, a signed-in
  // shopper goes home — asking them to sign in again would be a loop.
  if (!session || session.role !== 'ADMIN') {
    redirectLocalised(session ? '/' : '/login', locale);
  }

  return (
    <div className="bg-surface-alt min-h-dvh">
      <header className="border-line bg-surface border-b">
        <nav
          aria-label={t('navLabel')}
          className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4"
        >
          {/*
            The logo, then the word for what this is. `title` still names the
            link for a screen reader — it reads "iMIX · Админка" whole, which is
            what the tab is called too.
          */}
          <Link
            href="/admin"
            aria-label={t('title')}
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <Logo priority className="h-5 w-auto" />
            <span aria-hidden className="text-ink-muted font-normal">
              {t('titleShort')}
            </span>
          </Link>

          <div className="text-ink-muted flex items-center gap-4 text-sm">
            <Link href="/admin/products" className="hover:text-ink">
              {t('products')}
            </Link>
            <Link href="/admin/categories" className="hover:text-ink">
              {t('categories')}
            </Link>
            <Link href="/admin/orders" className="hover:text-ink">
              {t('orders')}
            </Link>
            <Link href="/admin/home-tiles" className="hover:text-ink">
              {t('homeTiles')}
            </Link>
          </div>

          <div className="text-ink-muted ml-auto flex items-center gap-4 text-sm">
            <Link href="/" className="hover:text-ink">
              {t('backToShop')}
            </Link>
            <span className="hidden max-w-[16ch] truncate sm:inline" title={session.email}>
              {session.email}
            </span>
            <SignOutButton label={t('signOut')} />
          </div>
        </nav>
      </header>

      {children}
    </div>
  );
}
