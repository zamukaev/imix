import type { Route } from 'next';
import Image from 'next/image';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ProductListItemDto } from '@imix/types';
import { ButtonLink } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/format';

/**
 * One model on a category page — the landing page's unit, as `Tile` is the home
 * page's (ARCHITECTURE.md §5.8).
 *
 * Not a `Tile`: a tile is full-bleed, at least 48rem tall, and carries its
 * artwork as the ground under centred copy. This is a card in a grid, with the
 * photograph in a rounded well above the text. Same tokens, different unit.
 *
 * Server Component. Nothing here is interactive beyond two links.
 */

type ModelCardProps = {
  product: ProductListItemDto;
  /** The first row of the grid is above the fold and should not lazy-load. */
  priority?: boolean;
};

export async function ModelCard({ product, priority = false }: ModelCardProps) {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations('catalogue'),
  ]);
  const [image] = product.images;
  const href = `/product/${product.slug}` as Route;

  return (
    <article className="group flex h-full flex-col items-center text-center">
      <Link href={href} className="flex w-full flex-col items-center">
        <div className="rounded-card bg-surface aspect-square w-full overflow-hidden">
          {image ? (
            // `object-cover` and no padding: the artwork *is* the well. These
            // are marketing shots that bring their own ground — a gradient, a
            // black stage — and insetting them on white would frame a
            // photograph inside a photograph. The same argument as the tile in
            // §5.1: one surface, not two.
            //
            // The carousel slot is a fixed width (`--spacing-model-card`), so
            // the hint is that width rather than a fraction of the viewport —
            // there is no breakpoint at which the card grows.
            <Image
              src={image}
              alt=""
              width={800}
              height={800}
              priority={priority}
              sizes="20rem"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div aria-hidden className="h-full w-full" />
          )}
        </div>

        {/* `h3` under the section's `h2`, which sits under the page's `h1`.
            The chain has no gap in it — §5.7. */}
        <h3 className="text-subhead mt-10 font-semibold tracking-tight">
          {product.name}
        </h3>

        {/* Dark and medium, not muted: on a model card the tagline is the line
            that sells the difference between two models, so it carries the same
            weight as the name rather than sitting back from it. Dropped
            entirely when there is none, rather than falling back to a
            description written for a different place. */}
        {product.tagline ? (
          <p className="mt-4 max-w-prose font-medium text-balance">
            {product.tagline}
          </p>
        ) : null}

        <p className="text-ink-muted mt-6 text-sm">
          {t('priceFrom', {
            price: formatMoney(product.basePrice, locale, product.currency),
          })}
        </p>
      </Link>

      {/*
        One pill, not two. The reference pairs "learn more" with "buy", but both
        land on the same detail page here — the variant picker is on it — and a
        second button to the same place is decoration (§5.3, §5.5).

        It repeats the card's own link, so it is labelled with the product name:
        a column of identical "Buy" links tells a screen reader nothing.
      */}
      {/* `mt-auto` on the wrapper rather than the pill: the pill's own padding is
          what makes it a pill, so the alignment lives one level out. */}
      <div className="mt-auto pt-10">
        <ButtonLink
          href={href}
          aria-label={t('buyAria', { product: product.name })}
        >
          {t('buy')}
        </ButtonLink>
      </div>
    </article>
  );
}
