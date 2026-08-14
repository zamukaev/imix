import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Paths that exist regardless of what is in the catalogue.
 *
 * Deliberately short. `/checkout` and `/order/…` are not here: a marketing tile
 * that drops somebody into a checkout they have not filled a cart for is not a
 * link, it is a dead end.
 */
const STATIC_ROUTES = new Set(['/', '/cart', '/login', '/register']);

const PRODUCT_PREFIX = '/product/';

/**
 * Decides whether a home tile's CTA points at a page this shop actually has.
 *
 * The tiles are content, edited without a deploy, and their hrefs used to be
 * whatever an admin typed — which is a 404 waiting for the day somebody renames
 * a category. Resolving them against the real rows is what makes the shop window
 * safe to rearrange (ARCHITECTURE.md §2 called this out as unenforced; this is
 * the enforcement).
 *
 * The locale prefix is not part of the stored href: `/phones` is what goes in,
 * and the storefront's own `Link` adds `/en` when an English visitor follows it.
 * So an href that already carries one is rejected rather than silently accepted
 * as a path that would become `/en/en/phones`.
 */
@Injectable()
export class StorefrontHrefService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `null` when the path is fine, otherwise the sentence explaining why not —
   * the caller decides which field it belongs to.
   */
  async explainIfUnreachable(href: string): Promise<string | null> {
    if (!href.startsWith('/')) {
      return `"${href}" is not a path on this storefront. Links must start with "/".`;
    }

    // Query strings and fragments are not paths and would defeat the lookup.
    if (href.includes('?') || href.includes('#')) {
      return `"${href}" must be a plain path, without a query string or fragment.`;
    }

    if (STATIC_ROUTES.has(href)) {
      return null;
    }

    if (href.startsWith(PRODUCT_PREFIX)) {
      const slug = href.slice(PRODUCT_PREFIX.length);
      const product = await this.prisma.product.findUnique({
        where: { slug },
        select: { id: true },
      });

      return product ? null : `No product has the slug "${slug}".`;
    }

    // Anything else can only be a category: the storefront routes a single
    // segment straight to `[category]`.
    const slug = href.slice(1);

    if (slug.includes('/')) {
      return `"${href}" does not match any page on this storefront.`;
    }

    const category = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });

    return category
      ? null
      : `No category has the slug "${slug}", and "${href}" is not a page of this shop.`;
  }
}
