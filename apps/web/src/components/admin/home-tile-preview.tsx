import Image from 'next/image';
import type { HomeTileSurface } from '@imix/types';
import { Button } from '@/components/ui/button';
import { TILE_SURFACE_CLASS } from '@/components/ui/tile';
import { TILE_SURFACE_OF } from '@/lib/home-tiles';

type HomeTilePreviewProps = {
  surface: HomeTileSurface;
  imageUrl: string;
  headline: string;
  subhead: string;
  primaryLabel: string;
  secondaryLabel: string;
};

/**
 * The tile's copy over the tile's artwork, at a glance.
 *
 * Exists because `surface` decides the text colour while the uploaded image
 * decides what the text actually sits on — and on an image tile those two are
 * set in different places. Dark artwork under a light surface means dark text
 * on black, which is only obvious once the two are drawn together.
 *
 * Inert: the pills are pictures of buttons, not controls inside the form.
 */
export function HomeTilePreview({
  surface,
  imageUrl,
  headline,
  subhead,
  primaryLabel,
  secondaryLabel,
}: HomeTilePreviewProps) {
  return (
    <div
      inert
      className={[
        'relative flex aspect-video flex-col items-center overflow-hidden rounded-lg text-center',
        TILE_SURFACE_CLASS[TILE_SURFACE_OF[surface]],
      ].join(' ')}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt="" fill sizes="40rem" className="object-cover object-center" />
      ) : null}

      <div className="relative flex flex-col items-center px-4 pt-8">
        <p className="text-subhead font-semibold text-balance text-(--surface-ink)">
          {headline}
        </p>
        {subhead ? <p className="mt-2 text-sm text-(--surface-ink-muted)">{subhead}</p> : null}
        {primaryLabel || secondaryLabel ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {primaryLabel ? <Button>{primaryLabel}</Button> : null}
            {secondaryLabel ? <Button variant="ghost">{secondaryLabel}</Button> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
