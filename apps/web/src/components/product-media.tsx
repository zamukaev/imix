'use client';

import { Component, Suspense, useCallback, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ProductGallery } from './product-gallery';
import { useProductColor } from '@/components/product-color-context';
import { imagesForColor } from '@/lib/product-colors';
import {
  planProductMedia,
  shouldShowModeSwitcher,
  type ProductMediaMode,
} from '@/lib/product-media';

/**
 * Everything the detail page shows of the product itself: the photo gallery, and
 * the 3D viewer on the products that have a model.
 *
 * `ssr: false` is the point of this file. three, R3F and drei are the heaviest
 * thing in the storefront, and they belong to a tab most visitors never open —
 * so they load on demand, in their own chunk, and the server renders the photo.
 */
const ProductViewer = dynamic(() => import('./product-viewer'), { ssr: false });

/** The square well both modes sit in — one box, so switching cannot shift the page. */
const WELL = 'rounded-card bg-surface-alt aspect-square overflow-hidden relative';

/**
 * Keeps a failed viewer from taking the page down with it.
 *
 * Suspense covers a model that is *loading*; nothing covers one that 404s, that
 * is malformed, or a device with no WebGL at all. Without this boundary any of
 * those would reach `error.tsx` and replace an otherwise working product page —
 * exactly the "3D is never a dependency of core commerce" rule in §6.
 */
class ViewerBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Reports when the referenced box has a real size on screen.
 *
 * R3F sizes its renderer once, from the container it is mounted into. The well
 * takes its height from `aspect-square` — a height derived from the width, and
 * not yet resolved on the commit that mounts the canvas — so R3F measures zero,
 * leaves the canvas at its 300×150 default and draws nothing into it. Waiting
 * for a non-zero box means the canvas is only ever mounted into a well that has
 * already been laid out.
 */
function useHasSize() {
  const [hasSize, setHasSize] = useState(false);
  const observer = useRef<ResizeObserver | null>(null);

  // A callback ref rather than an effect: the well lives inside the 3D branch,
  // so it does not exist on the render that mounts this component. An effect
  // with an empty dependency list would run once, against a null ref, and never
  // again. This runs exactly when the node arrives and when it leaves.
  const ref = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;

    if (!element) {
      setHasSize(false);
      return;
    }

    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setHasSize(width > 0 && height > 0);
    };

    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(element);
  }, []);

  return { ref, hasSize };
}

type ProductMediaProps = {
  /** The product's own photographs — the fallback, not necessarily what is shown. */
  images: string[];
  model3dUrl: string | null;
  productName: string;
};

export function ProductMedia({
  images: productImages,
  model3dUrl,
  productName,
}: ProductMediaProps) {
  const t = useTranslations('product');
  const { selected } = useProductColor();

  // Choosing a finish re-points the gallery at that finish's photographs. A
  // colour that has none falls back to the product's, which is the usual case
  // until each one has been shot.
  const images = imagesForColor(selected, productImages);
  const plan = planProductMedia({ images, model3dUrl });
  const [mode, setMode] = useState<ProductMediaMode>(plan.initialMode);
  const { ref: wellRef, hasSize } = useHasSize();

  const labels: Record<ProductMediaMode, string> = {
    photo: t('mediaPhoto'),
    model: t('mediaModel'),
  };

  // Stands in for the canvas while the chunk and the `.glb` download, and stays
  // put if either never arrives. An image rather than a spinner, so the well
  // never goes empty and the shape of the page is right from the first paint.
  const poster = plan.posterImage ? (
    <Image
      src={plan.posterImage}
      alt=""
      width={800}
      height={800}
      sizes="(min-width: 1024px) 50vw, 100vw"
      className="h-full w-full object-cover"
    />
  ) : null;

  return (
    <div className="space-y-4">
      {shouldShowModeSwitcher(plan) && (
        // Same segmented control as the category page's group filter: a group of
        // buttons that say what they did, not a `tablist` — which would promise
        // arrow-key navigation and a `tabpanel` this does not have.
        <div
          role="group"
          aria-label={t('mediaSwitch')}
          className="bg-surface-sunken rounded-pill inline-flex gap-1 p-1"
        >
          {plan.modes.map((option) => {
            const selected = option === mode;

            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => setMode(option)}
                className={[
                  'rounded-pill px-5 py-2 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-4 focus-visible:ring-(--surface-ink)/20',
                  selected ? 'bg-ink text-surface' : 'text-ink hover:bg-surface/60',
                ].join(' ')}
              >
                {labels[option]}
              </button>
            );
          })}
        </div>
      )}

      {/* The url check narrows `modelUrl` for the viewer and is the same
          condition that put `model` in `modes` — a mode with nothing to load
          cannot be reached, and the gallery is what a product falls back to. */}
      {mode === 'model' && plan.modelUrl !== null ? (
        <div className="space-y-4">
          <div ref={wellRef} className={WELL}>
            <ViewerBoundary
              fallback={
                <>
                  {poster}
                  <p className="bg-surface/90 text-ink-muted absolute inset-x-0 bottom-0 px-4 py-3 text-center text-sm">
                    {t('modelUnavailable')}
                  </p>
                </>
              }
            >
              <Suspense fallback={poster}>
                {/*
                  `absolute inset-0` gives the canvas a definite box: the well's
                  own height is derived from `aspect-square`, which a
                  `height: 100%` child cannot resolve against. Together with the
                  `hasSize` gate above, the canvas only ever mounts into a well
                  that is both laid out and measurable.
                */}
                {hasSize ? (
                  <div className="absolute inset-0">
                    <ProductViewer
                      url={plan.modelUrl}
                      label={t('modelAlt', { product: productName })}
                    />
                  </div>
                ) : (
                  poster
                )}
              </Suspense>
            </ViewerBoundary>
          </div>

          <p className="text-ink-muted text-sm">{t('modelHint')}</p>
        </div>
      ) : (
        <ProductGallery images={images} productName={productName} />
      )}
    </div>
  );
}
