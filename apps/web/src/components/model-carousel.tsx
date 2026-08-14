'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { ProductGroupDto } from '@imix/types';

/**
 * The "all models" row of a category page: a tab bar over a horizontal
 * carousel.
 *
 * The cards themselves stay Server Components — they arrive as rendered nodes
 * on `slides`, so the client bundle carries the shell and the scrolling, never
 * the product markup. That is the only reason this file may be `'use client'`
 * at all: tabs and scroll position are state, and state needs the client.
 *
 * Filtering happens here rather than over the network. A category holds at most
 * a page of models and they are already on the page, so a tab is an instant
 * change of what is shown — a refetch would be a slower way to get the same
 * list.
 */

/** Sentinel for the leading tab. Not a slug, so it cannot collide with one. */
const ALL_TAB = '*';

export type ModelSlide = {
  id: string;
  /** Which tab this model belongs to; null shows only under "all". */
  group: string | null;
  card: ReactNode;
};

type ModelCarouselProps = {
  groups: ProductGroupDto[];
  slides: ModelSlide[];
};

export function ModelCarousel({ groups, slides }: ModelCarouselProps) {
  const t = useTranslations('catalogue');
  const [active, setActive] = useState<string>(ALL_TAB);
  const railRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  // A single tab is not a choice, and tabs over an unsplit line-up are noise.
  const hasTabs = groups.length > 1;
  const visible = hasTabs && active !== ALL_TAB
    ? slides.filter((slide) => slide.group === active)
    : slides;

  const syncArrows = useCallback(() => {
    const rail = railRef.current;

    if (!rail) {
      return;
    }

    // A pixel of slack: sub-pixel layout means scrollLeft rarely lands exactly
    // on the maximum, and an arrow that never disables is worse than none.
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    setAtStart(rail.scrollLeft <= 1);
    setAtEnd(rail.scrollLeft >= maxScroll - 1);
  }, []);

  // Re-check after a tab change: a shorter list may not overflow at all, and
  // the arrows have to go quiet rather than scroll nothing.
  useEffect(syncArrows, [syncArrows, visible.length]);

  useEffect(() => {
    const rail = railRef.current;

    if (!rail || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(syncArrows);
    observer.observe(rail);

    return () => observer.disconnect();
  }, [syncArrows]);

  const scrollByCard = (direction: -1 | 1) => {
    const rail = railRef.current;
    const first = rail?.firstElementChild;

    if (!rail || !first) {
      return;
    }

    // Step by a real card plus the gap, measured rather than assumed — the card
    // width is a token and the gap changes at `sm`.
    const step = first.getBoundingClientRect().width + railGap(rail);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    rail.scrollBy({ left: step * direction, behavior: reduced ? 'auto' : 'smooth' });
  };

  const tabs: { key: string; label: string }[] = [
    { key: ALL_TAB, label: t('allProducts') },
    ...groups.map((group) => ({ key: group.slug, label: group.name })),
  ];

  return (
    // No wrapper width here: the rail is full-bleed and the two controls put
    // themselves back in the content column. A `max-w` on this element would
    // clip the row it exists to let out.
    <div>
      {hasTabs ? (
      <div className="mx-auto max-w-page px-page-gutter">
        {/*
          `tablist` would promise arrow-key navigation between tabs and a
          `tabpanel` to land in. This is a filter over one list that stays put,
          so it is a group of buttons that say what they did instead.
        */}
        <div
          role="group"
          aria-label={t('filterByGroup')}
          className="bg-surface-sunken rounded-pill scrollbar-none inline-flex max-w-full gap-1 overflow-x-auto p-1"
        >
          {tabs.map((tab) => {
            const selected = tab.key === active;

            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setActive(tab.key)}
                className={[
                  'rounded-pill px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-4 focus-visible:ring-(--surface-ink)/20',
                  selected
                    ? 'bg-ink text-surface'
                    : 'text-ink hover:bg-surface/60',
                ].join(' ')}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      ) : null}

      {/*
        Full-bleed: the row runs to both edges of the screen while its first
        card stays flush with the heading above it (`bleed-row`). The tail
        running off the screen is what says the row scrolls — a row that stops
        at a margin looks like it simply ended.
      */}
      <ul
        ref={railRef}
        onScroll={syncArrows}
        // Focusable because it scrolls: a keyboard user has to be able to reach
        // the overflow without tabbing through every card to get there.
        tabIndex={0}
        role="group"
        aria-label={t('allModels')}
        className="bleed-row scrollbar-none mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2 outline-none focus-visible:ring-4 focus-visible:ring-(--surface-ink)/20"
      >
        {visible.map((slide) => (
          <li key={slide.id} className="w-model-card shrink-0 snap-start">
            {slide.card}
          </li>
        ))}
      </ul>

      {/* Hidden outright when the row fits: two permanently dead buttons are
          worse than none. */}
      {atStart && atEnd ? null : (
        <div className="mx-auto mt-10 flex max-w-page items-center justify-center gap-3 px-page-gutter">
          <CarouselArrow
            label={t('previousModels')}
            disabled={atStart}
            onClick={() => scrollByCard(-1)}
            direction="left"
          />
          <CarouselArrow
            label={t('nextModels')}
            disabled={atEnd}
            onClick={() => scrollByCard(1)}
            direction="right"
          />
        </div>
      )}
    </div>
  );
}

function CarouselArrow({
  label,
  disabled,
  onClick,
  direction,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  direction: 'left' | 'right';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="border-line text-ink hover:border-ink flex size-11 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-4 focus-visible:ring-(--surface-ink)/20 disabled:pointer-events-none disabled:opacity-30"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={direction === 'left' ? 'M12 4L6 10l6 6' : 'M8 4l6 6-6 6'} />
      </svg>
    </button>
  );
}

/** The rail's own `gap`, read off the element so the token stays the source. */
function railGap(rail: HTMLElement): number {
  const gap = Number.parseFloat(getComputedStyle(rail).columnGap);

  return Number.isNaN(gap) ? 0 : gap;
}
