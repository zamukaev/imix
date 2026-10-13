import type { Metadata } from 'next';
import { LOCALES, type Locale } from '@imix/types';
import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const DEFAULT_SITE_URL = 'http://localhost:3000';

/**
 * True while building or serving a Vercel preview deployment.
 *
 * Preview builds are the same code on a throwaway hostname, and the difference
 * matters twice: for the URL below, and for what `robots.ts` lets a crawler do
 * with it.
 */
export const isPreviewDeployment = process.env.VERCEL_ENV === 'preview';

/**
 * Where this shop lives, absolutely.
 *
 * Canonical links and OpenGraph images have to be absolute URLs — a crawler has
 * no request context to resolve `/phones` against. Falls back to localhost so
 * development works without configuration; a deployment that forgets to set this
 * gets canonical tags pointing at a machine nobody can reach, which is why it is
 * the first thing listed in `.env.example`.
 *
 * A Vercel preview is the exception, and only a preview. Every push gets a fresh
 * hostname, so the configured `NEXT_PUBLIC_SITE_URL` — baked in at build time —
 * would have each preview claim production as its canonical. `VERCEL_URL` is the
 * only value that knows the host this particular build is served from. It is
 * read without a `NEXT_PUBLIC_` prefix on purpose: `siteUrl` is used by
 * `sitemap.ts`, `robots.ts` and `generateMetadata`, all of which run on the
 * server, so the browser never needs it.
 */
function resolveSiteUrl(): string {
  if (isPreviewDeployment && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
}

export const siteUrl = new URL(resolveSiteUrl());

/** Whatever `getPathname` accepts, kept in step with it rather than restated. */
type LocalisedHref = Parameters<typeof getPathname>[0]['href'];

/**
 * The `hreflang` block for one page: a canonical for the language being served,
 * and a pointer to every other language of the same page.
 *
 * Russian sits on bare paths and English behind `/en` (`localePrefix:
 * 'as-needed'`), so the two URLs are not the same string with a prefix bolted
 * on — `getPathname` is what knows the difference, and it is the same function
 * the app's own `Link` uses. Hand-building `/${locale}${path}` here is exactly
 * the bug that publishes `/ru/phones`, a page this shop does not serve.
 *
 * `x-default` points at Russian: it is the shop's own language, and it is what a
 * visitor with no matching preference should land on.
 */
export function alternatesFor(
  href: LocalisedHref,
  locale: Locale,
): Metadata['alternates'] {
  const languages = Object.fromEntries(
    LOCALES.map((other) => [other, getPathname({ href, locale: other })]),
  );

  return {
    canonical: getPathname({ href, locale }),
    languages: {
      ...languages,
      'x-default': getPathname({ href, locale: routing.defaultLocale }),
    },
  };
}

/**
 * Pages that exist for one visitor and nobody else.
 *
 * A cart, a checkout and an order confirmation have nothing to rank for and
 * everything to leak — an order URL is its own credential (ARCHITECTURE.md §3).
 * `follow` stays on so a crawler still walks the catalogue links on them.
 */
export const PRIVATE_PAGE: Metadata = {
  robots: { index: false, follow: true },
};
