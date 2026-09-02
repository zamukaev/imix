'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

/**
 * The product's photographs, as a carousel.
 *
 * On a product that has a `model3dUrl`, `ProductMedia` puts a switcher above
 * this and the 3D viewer beside it. The viewer does not replace the gallery:
 * photos stay the default and the accessible path, and are what a failed or
 * unsupported WebGL context falls back to.
 *
 * Arrows and dots rather than a thumbnail strip. A strip shows the same three
 * pictures twice at two sizes; dots say how many there are and where you are
 * without claiming to be previews.
 */
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const t = useTranslations('product');
  const [index, setIndex] = useState(0);

  // The gallery is re-pointed at another set when a colour is chosen. Without
  // this, picking a finish with fewer photographs than the last would leave the
  // index past the end and the well empty.
  useEffect(() => {
    setIndex(0);
  }, [images]);

  const active = images[index];

  if (!active) {
    return <div className="rounded-card bg-surface-alt aspect-square" aria-hidden />;
  }

  const step = (by: number) => {
    // Wraps, so the arrows never dead-end on a set of three.
    setIndex((current) => (current + by + images.length) % images.length);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-card bg-surface-alt relative aspect-square overflow-hidden">
        <Image
          key={active}
          src={active}
          alt={t('galleryAlt', {
            product: productName,
            index: index + 1,
            total: images.length,
          })}
          width={800}
          height={800}
          // The detail page's hero: on the product page this is the largest
          // thing above the fold, so it loads eagerly rather than on scroll.
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="h-full w-full object-cover"
        />

        {images.length > 1 && (
          <>
            <CarouselArrow
              direction="previous"
              label={t('previousImage')}
              onClick={() => step(-1)}
            />
            <CarouselArrow
              direction="next"
              label={t('nextImage')}
              onClick={() => step(1)}
            />
          </>
        )}
      </div>

      {images.length > 1 && (
        <div
          role="group"
          aria-label={t('chooseImage')}
          className="flex justify-center gap-2"
        >
          {images.map((image, dot) => (
            <button
              key={image}
              type="button"
              aria-label={t('showView', { index: dot + 1 })}
              aria-pressed={dot === index}
              onClick={() => setIndex(dot)}
              // The dot is small; the hit area around it is not. A 6px target is
              // unusable on a phone, so the button is padded and the mark inside
              // it stays the size the design calls for.
              className="focus-visible:ring-ink cursor-pointer rounded-full p-1.5 outline-none focus-visible:ring-2"
            >
              <span
                className={[
                  'block size-1.5 rounded-full transition-colors',
                  dot === index ? 'bg-ink' : 'bg-line',
                ].join(' ')}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** One of the two round arrows, centred against the edge of the well. */
function CarouselArrow({
  direction,
  label,
  onClick,
}: {
  direction: 'previous' | 'next';
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        'bg-surface/80 text-ink absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center',
        'rounded-full backdrop-blur transition-opacity outline-none',
        'hover:bg-surface focus-visible:ring-ink focus-visible:ring-2',
        direction === 'previous' ? 'left-3' : 'right-3',
      ].join(' ')}
    >
      {/*
        Drawn rather than typed: "‹" and "›" are punctuation, and a screen reader
        that ignores `aria-hidden` would read the character out. The label above
        is the whole accessible name.
      */}
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={direction === 'previous' ? 'M15 18 9 12l6-6' : 'm9 18 6-6-6-6'} />
      </svg>
    </button>
  );
}
