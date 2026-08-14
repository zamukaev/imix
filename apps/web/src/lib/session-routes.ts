import { routing } from '@/i18n/routing';

/**
 * The paths that mean nothing without a session, and the arithmetic for getting
 * somebody to one.
 *
 * Two of them, gated differently: `/admin` needs the ADMIN role, `/account`
 * needs only that somebody is signed in. Both gates decide which *page* a
 * visitor sees and nothing more — the API re-checks every request it serves
 * (ARCHITECTURE.md §4.3).
 */

/** The admin lives behind this prefix, after the locale. */
export const ADMIN_PATH = '/admin';

/** A shopper's own account: their details and their order history. */
export const ACCOUNT_PATH = '/account';

/** Where a visitor without a session is sent, and what carries them back. */
export const LOGIN_PATH = '/login';
export const RETURN_TO_PARAM = 'next';

/**
 * Splits `/en/admin/orders` into its locale prefix and the rest.
 *
 * Russian sits on bare paths (`localePrefix: 'as-needed'`), so the prefix is
 * usually empty — which is exactly why this cannot be a `startsWith('/admin')`.
 */
export function splitLocale(pathname: string): { prefix: string; path: string } {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) {
      return { prefix: `/${locale}`, path: '/' };
    }

    if (pathname.startsWith(`/${locale}/`)) {
      return { prefix: `/${locale}`, path: pathname.slice(locale.length + 1) };
    }
  }

  return { prefix: '', path: pathname };
}

/** True for `base` and everything under it, in either locale. */
function isUnder(pathname: string, base: string): boolean {
  const { path } = splitLocale(pathname);

  return path === base || path.startsWith(`${base}/`);
}

/** True for `/admin` and everything under it, in either locale. */
export function isAdminPath(pathname: string): boolean {
  return isUnder(pathname, ADMIN_PATH);
}

/** True for `/account` and everything under it, in either locale. */
export function isAccountPath(pathname: string): boolean {
  return isUnder(pathname, ACCOUNT_PATH);
}

/**
 * Narrows a `?next=` value to somewhere inside this site.
 *
 * Anything that is not a plain absolute path is dropped: `//evil.example` is a
 * protocol-relative URL that a browser will happily follow off-site, and a
 * login form that forwards wherever it is told is an open redirect with a
 * friendly face.
 */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  return value;
}
