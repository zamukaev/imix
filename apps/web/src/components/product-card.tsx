import type { Route } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ProductListItemDto } from '@imix/types';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/format';

type ProductCardProps = {
  product: ProductListItemDto;
  /** The first row of a grid is above the fold and should not lazy-load. */
  priority?: boolean;
};

export async function ProductCard({ product, priority = false }: ProductCardProps) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('product')]);
  const [image] = product.images;

  return (
    <article className="group">
      <Link href={`/product/${product.slug}` as Route} className="block">
        <div className="rounded-card bg-surface-alt aspect-square overflow-hidden">
          {image ? (
            // Plain <img> for now; next/image optimisation is Phase 4.2.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              width={800}
              height={800}
              loading={priority ? 'eager' : 'lazy'}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div aria-hidden className="h-full w-full" />
          )}
        </div>

        <div className="mt-4 space-y-1">
          <p className="text-ink-muted text-xs tracking-widest uppercase">{product.brand}</p>
          <h3 className="text-lg font-medium tracking-tight">{product.name}</h3>
          {/* The card advertises the cheapest variant, in the currency the API
              priced this response in. */}
          <p className="text-ink-muted text-sm">
            {t('priceFrom', {
              price: formatMoney(product.basePrice, locale, product.currency),
            })}
          </p>
        </div>
      </Link>
    </article>
  );
}
