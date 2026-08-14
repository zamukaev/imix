import type { Route } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { ProductListItemDto } from '@imix/types';
import { Link } from '@/i18n/navigation';

/**
 * The model rail at the top of a category page — one chip per model, each a
 * small cutout above its name.
 *
 * A Server Component, and deliberately so: these are plain links to the product
 * pages, there is no selected state to track (we are on the category page, not
 * on one of them), and horizontal scrolling is CSS. The category landing page
 * therefore still costs no client JavaScript.
 *
 * The chip prefers `navImage` — a cutout on a plain ground — over the gallery
 * shot. A full-bleed marketing photograph scaled to 56px is a coloured square
 * with no device visible in it.
 */

/** Rendered size of a chip's artwork. Mirrored in `sizes` below. */
const CHIP_PX = 56;

/**
 * Next's image optimiser refuses SVG unless the whole app opts in with
 * `dangerouslyAllowSVG`, which would apply to every uploaded file too. A vector
 * has nothing to optimise at 56px anyway, so it is served as-is and the flag
 * stays off.
 */
const isVector = (src: string): boolean => src.toLowerCase().endsWith('.svg');

type CategoryModelNavProps = {
  products: ProductListItemDto[];
};

export async function CategoryModelNav({ products }: CategoryModelNavProps) {
  const t = await getTranslations('catalogue');

  // One chip is not a navigation — it is the page you are already on. Several
  // categories hold a single product, and a lone chip there reads as a stray
  // thumbnail rather than a list to choose from.
  if (products.length < 2) {
    return null;
  }

  return (
    // The gap above belongs to the rail, not to the page: a category with one
    // product renders nothing here, and nothing should include its own spacing.
    <nav aria-label={t('modelNav')} className="mt-12">
      {/*
        `-mx-6 px-6` lets the rail bleed to the edges of a phone screen while its
        first and last chip still line up with the page's text column: a row that
        stops short of the edge looks clipped rather than scrollable.
      */}
      <ul className="scrollbar-none -mx-6 flex snap-x snap-mandatory items-start gap-8 overflow-x-auto px-6 pb-2 sm:gap-10">
        {products.map((product) => {
          const image = product.navImage ?? product.images[0];

          return (
            <li key={product.id} className="shrink-0 snap-start">
              <Link
                href={`/product/${product.slug}` as Route}
                className="text-ink-muted hover:text-ink rounded-card flex w-24 flex-col items-center gap-2 outline-none transition-colors focus-visible:ring-4 focus-visible:ring-(--surface-ink)/20"
              >
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    width={CHIP_PX}
                    height={CHIP_PX}
                    sizes={`${CHIP_PX}px`}
                    // The rail sits directly under the h1, so every chip is above
                    // the fold; lazy-loading them only buys a visibly empty row
                    // on first paint. They are 56px — there is nothing to defer.
                    loading="eager"
                    unoptimized={isVector(image)}
                    // Contain and bottom-align, the same rule the model cards
                    // follow — ARCHITECTURE.md §5.8.
                    className="h-14 w-14 object-contain object-bottom"
                  />
                ) : (
                  <div aria-hidden className="h-14 w-14" />
                )}
                <span className="text-center text-xs font-medium text-balance">
                  {product.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
