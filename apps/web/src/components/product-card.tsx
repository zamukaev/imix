import type { Route } from 'next';
import Link from 'next/link';
import type { ProductListItemDto } from '@imix/types';
import { formatPriceFrom } from '@/lib/format';

type ProductCardProps = {
  product: ProductListItemDto;
  /** The first row of a grid is above the fold and should not lazy-load. */
  priority?: boolean;
};

export function ProductCard({ product, priority = false }: ProductCardProps) {
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
          <p className="text-ink-muted text-sm">{formatPriceFrom(product.basePrice)}</p>
        </div>
      </Link>
    </article>
  );
}
