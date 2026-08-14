'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

/** Image gallery with thumbnail selection. The 3D viewer replaces this on
 * products that have a model in Phase 5. */
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const t = useTranslations('product');
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  if (!active) {
    return <div className="rounded-card bg-surface-alt aspect-square" aria-hidden />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-card bg-surface-alt aspect-square overflow-hidden">
        <Image
          src={active}
          alt={t('galleryAlt', {
            product: productName,
            index: activeIndex + 1,
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
      </div>

      {images.length > 1 && (
        <ul className="flex gap-3">
          {images.map((image, index) => (
            <li key={image}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={t('showView', { index: index + 1 })}
                aria-current={index === activeIndex}
                className={[
                  'rounded-xl bg-surface-alt size-20 overflow-hidden border transition-colors',
                  index === activeIndex ? 'border-ink' : 'border-transparent hover:border-line',
                ].join(' ')}
              >
                <Image
                  src={image}
                  alt=""
                  width={160}
                  height={160}
                  sizes="80px"
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
