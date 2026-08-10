import type { ReactNode } from 'react';

/**
 * The marketing surface, as described in ARCHITECTURE.md §5.1.
 *
 * A tile is a full-bleed unit carrying one idea: a headline, at most one
 * supporting line, at most two actions, and a product image *below* the text —
 * never behind it. The shape of these props is the design rule: there is no way
 * to pass a third action or a second paragraph.
 *
 * Server Component. Nothing here is interactive, so the marketing surface costs
 * no client JavaScript.
 */

export type TileSurface = 'light' | 'white' | 'dark';

/** Sets the `--surface-*` contract that `Button` and muted text read from. */
const SURFACES: Record<TileSurface, string> = {
  light: 'bg-surface-alt',
  white: 'bg-surface',
  dark: 'surface-dark bg-surface-dark',
};

type TileSize = 'full' | 'half';

/**
 * A half tile keeps the full tile's proportions one step down the scale, rather
 * than shrinking the same type — which is what stops a pair from looking like a
 * squeezed hero.
 */
const SIZES: Record<
  TileSize,
  { section: string; headline: string; subhead: string; pad: string }
> = {
  full: {
    section: 'min-h-tile',
    // Display type only from `lg` up. Not a wrapping concern — it is the copy
    // *block* height: at 72px the headline, subhead and pills together outgrow
    // the top ~39% of the tile that the artwork reserves for them, and the
    // buttons land on the device. Measured across 375/768/1024/1280 at viewport
    // heights 640–900.
    headline: 'text-headline lg:text-display',
    subhead: 'text-lg lg:text-subhead',
    pad: 'px-6 pt-16 sm:pt-24',
  },
  half: {
    section: 'min-h-tile-half',
    headline: 'text-subhead lg:text-headline',
    subhead: 'text-base lg:text-lg',
    pad: 'px-6 pt-12 sm:pt-16',
  },
};

export type TileMedia = {
  src: string;
  /**
   * Empty for a device shot the headline already names — the common case.
   * Spell it out only when the image says something the text does not.
   */
  alt: string;
  /** Set on the first tile of a page so its image is not lazy-loaded. */
  priority?: boolean;
};

export type TileProps = {
  headline: ReactNode;
  subhead?: ReactNode;
  surface?: TileSurface;
  /**
   * One action, or two in the order primary then ghost. A tuple rather than an
   * array so a third CTA does not type-check.
   */
  actions?: readonly [ReactNode] | readonly [ReactNode, ReactNode];
  media?: TileMedia;
  /** `h1` on the first tile of a page, `h2` everywhere else. */
  as?: 'h1' | 'h2';
};

type InternalTileProps = TileProps & { size?: TileSize };

export function Tile({
  headline,
  subhead,
  surface = 'light',
  actions,
  media,
  as: Heading = 'h2',
  size = 'full',
}: InternalTileProps) {
  const scale = SIZES[size];

  return (
    <section
      className={[
        'relative flex flex-col items-center overflow-hidden text-center',
        SURFACES[surface],
        scale.section,
      ].join(' ')}
    >
      {media ? (
        // The artwork *is* the tile, not a band inside it: one surface, with the
        // copy set on the empty upper third the shot reserves for it. A separate
        // media strip below the text leaves a seam wherever the tile's own
        // colour and the artwork's background differ.
        //
        // `object-cover` on artwork far wider than any tile always fits the
        // height exactly and trims the sides, so the device keeps the vertical
        // placement the photographer framed — low in the frame, clear of the
        // copy. `surface` still decides the text colour, and shows through as
        // the ground on a tile that has no image yet.
        <>
          {/* Plain <img> for now; next/image optimisation is Phase 4.4. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.src}
            alt={media.alt}
            loading={media.priority ? 'eager' : 'lazy'}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </>
      ) : null}

      <div
        className={[
          'relative flex flex-col items-center',
          scale.pad,
        ].join(' ')}
      >
        <Heading
          className={[
            'max-w-headline font-semibold text-balance text-(--surface-ink)',
            scale.headline,
          ].join(' ')}
        >
          {headline}
        </Heading>

        {subhead ? (
          <p
            className={[
              'mt-3 max-w-prose text-(--surface-ink-muted)',
              scale.subhead,
            ].join(' ')}
          >
            {subhead}
          </p>
        ) : null}

        {actions ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>

    </section>
  );
}

export type TilePairProps = {
  left: TileProps;
  right: TileProps;
};

/**
 * Two half tiles in a row, stacked on a phone.
 *
 * Takes its tiles as props rather than children so the pair — not the caller —
 * decides they are halves. "Half tiles come in pairs" is then structural: there
 * is no way to leave one at full size or to put three in a row.
 */
export function TilePair({ left, right }: TilePairProps) {
  return (
    <div className="grid gap-gutter sm:grid-cols-2">
      <Tile {...left} size="half" />
      <Tile {...right} size="half" />
    </div>
  );
}

/**
 * The stack itself. Tiles are separated by a hairline of page background, which
 * is what removes the need for a border between two adjacent surfaces.
 */
export function TileStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-gutter">{children}</div>;
}
