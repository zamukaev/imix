import type { MetadataRoute } from 'next';
import { isPreviewDeployment, siteUrl } from '@/lib/seo';

/**
 * What a crawler may walk.
 *
 * The disallowed list is every path that belongs to one person rather than to
 * the shop. Two of them matter beyond tidiness: `/order/` URLs are their own
 * credential — the cuid is what lets a guest read their confirmation
 * (ARCHITECTURE.md §3) — and `/api/` proxies the session to the backend.
 *
 * Written without a locale prefix and with `/en/…` beside it, because Russian
 * sits on bare paths: `Disallow: /cart` does not cover `/en/cart`.
 */
const PRIVATE_PATHS = [
  '/account',
  '/admin',
  '/cart',
  '/checkout',
  '/order/',
  '/login',
  '/register',
  '/api/',
];

export default function robots(): MetadataRoute.Robots {
  /**
   * A preview deployment is the whole shop on a hostname nobody should find in
   * a search result — duplicate catalogue, staging prices, half-finished copy.
   * Now that its canonicals point at itself rather than at production, nothing
   * else keeps it out of an index.
   */
  if (isPreviewDeployment) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  const disallow = PRIVATE_PATHS.flatMap((path) => [path, `/en${path}`]);

  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: new URL('/sitemap.xml', siteUrl).toString(),
    host: siteUrl.host,
  };
}
