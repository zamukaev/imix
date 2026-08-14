import type { MetadataRoute } from 'next';
import type { Route } from 'next';
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  LOCALES,
  MAX_PRODUCT_PAGE_SIZE,
} from '@imix/types';
import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getCategories, getProducts } from '@/lib/api';
import { siteUrl } from '@/lib/seo';

/**
 * The sitemap, built from the catalogue rather than from a list somebody has to
 * remember to update.
 *
 * Each entry appears **once**, at its Russian URL, with the English one declared
 * as an alternate — not twice as two competing pages. That mirrors the
 * `hreflang` on the pages themselves: one page, two languages.
 *
 * Private pages are absent by construction: only the home page, the categories
 * and the products are listed. A cart or an order has nothing to crawl.
 */

/**
 * A ceiling on how many pages to walk, so a catalogue that grows unexpectedly
 * cannot turn one sitemap request into an unbounded number of API calls.
 */
const MAX_PAGES = 20;

/** Re-read hourly. A new product should not wait for a deploy to be listed. */
export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

/** Whatever `getPathname` accepts — the catalogue's hrefs are runtime strings. */
type LocalisedHref = Parameters<typeof getPathname>[0]['href'];

function entry(href: LocalisedHref, priority: number, lastModified?: Date): Entry {
  return {
    url: absolute(getPathname({ href, locale: routing.defaultLocale })),
    lastModified,
    priority,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((locale) => [locale, absolute(getPathname({ href, locale }))]),
      ),
    },
  };
}

function absolute(path: string): string {
  return new URL(path, siteUrl).toString();
}

/**
 * Every product, a page at a time.
 *
 * Paged rather than asked for in one go: `GET /products` caps a page at
 * `MAX_PRODUCT_PAGE_SIZE`, and a number invented here instead of taken from the
 * contract is a 400 — which is what happened, and which the `catch` below then
 * hid as "no products". Hence the shared constant.
 */
async function allProducts(context: {
  locale: typeof DEFAULT_LOCALE;
  currency: typeof DEFAULT_CURRENCY;
}) {
  const collected: { slug: string }[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { items, total } = await getProducts(context, {
      page,
      pageSize: MAX_PRODUCT_PAGE_SIZE,
    });

    collected.push(...items);

    if (collected.length >= total || items.length === 0) {
      break;
    }
  }

  return collected;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const context = { locale: DEFAULT_LOCALE, currency: DEFAULT_CURRENCY };

  // A sitemap that cannot reach the API should still list the home page rather
  // than fail the build. An empty list would tell a crawler the shop has no
  // pages, which is worse than telling it about one.
  //
  // This catch is deliberately narrow in intent and was briefly too wide in
  // effect: it swallowed a 400 of this file's own making. If the catalogue ever
  // comes back empty here, that is worth looking at rather than shipping.
  const [categories, products] = await Promise.all([
    getCategories(context).catch(() => []),
    allProducts(context).catch(() => []),
  ]);

  return [
    entry('/', 1),
    ...categories.map((category) => entry(`/${category.slug}` as Route, 0.8)),
    ...products.map((product) => entry(`/product/${product.slug}` as Route, 0.6)),
  ];
}
