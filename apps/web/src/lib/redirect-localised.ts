import type { Route } from 'next';
import { redirect } from 'next/navigation';
import type { Locale } from '@imix/types';
import { getPathname } from '@/i18n/navigation';

/**
 * Sends a Server Component somewhere else, on the locale it is already on.
 *
 * Next's own `redirect` rather than next-intl's, because this one is typed
 * `never` — which is what lets a caller write `if (!session) redirectTo(...)`
 * and have everything below know the session is real. `getPathname` supplies
 * the locale prefix, and the cast is the same one the storefront makes wherever
 * an href is computed rather than written down (typed routes cannot follow a
 * value through a function).
 *
 * Kept out of `session-routes.ts` on purpose: that module is imported by the
 * middleware, which runs on the Edge runtime and has no business pulling in
 * `next/navigation`.
 */
/** Whatever `getPathname` accepts — kept in step with it rather than restated. */
type LocalisedHref = Parameters<typeof getPathname>[0]['href'];

export function redirectLocalised(href: LocalisedHref, locale: Locale): never {
  redirect(getPathname({ href, locale }) as Route);
}
