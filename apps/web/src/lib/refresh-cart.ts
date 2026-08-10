import { getProduct, type PriceContext } from '@/lib/api';
import { refreshLines, type CartLine, type FreshVariant } from '@/lib/cart';

/**
 * Re-fetches everything in the cart and restates it in the requested language
 * and currency.
 *
 * One request per distinct *product*, not per line — a cart is typically one or
 * two products in a few configurations, and the detail endpoint already returns
 * every variant of a product in the requested language and currency.
 */
export async function refreshCart(
  lines: readonly CartLine[],
  context: PriceContext,
): Promise<CartLine[]> {
  if (lines.length === 0) {
    return [];
  }

  const slugs = [...new Set(lines.map((line) => line.productSlug))];
  const products = await Promise.all(
    slugs.map((slug) => getProduct(slug, context)),
  );

  const fresh = new Map<string, FreshVariant>(
    products.flatMap((product) =>
      product.variants.map((variant) => [
        variant.id,
        {
          unitPrice: variant.price,
          stock: variant.stock,
          productName: product.name,
          variantLabel: variant.label,
        },
      ]),
    ),
  );

  return refreshLines(lines, fresh, context.locale, context.currency);
}
