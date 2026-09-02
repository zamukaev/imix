'use client';

import { useTranslations } from 'next-intl';
import { useProductColor } from '@/components/product-color-context';
import { shouldShowColorPicker } from '@/lib/product-colors';

/**
 * The swatch row — "Farbe – Lavendel" and a chip per finish.
 *
 * Two things make this more than a row of coloured circles:
 *
 * - **The name is written out.** A swatch alone is unreadable to anyone who
 *   cannot see it, and hard to name for anyone who can — "the third grey one"
 *   is not something a shopper can put in an email. The line above changes with
 *   the selection and is what the accessible name of each chip repeats.
 * - **Every chip has a hairline border.** Silver and White are within a few
 *   percent of the surface they sit on; without it they are an invisible
 *   control on a light page.
 */
export function ProductColorPicker() {
  const t = useTranslations('product');
  const { colors, selectedId, selected, select } = useProductColor();

  if (!shouldShowColorPicker(colors)) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {t('colorLabel', { color: selected?.name ?? '' })}
      </p>

      {/*
        A group of buttons rather than a `radiogroup`: the same reasoning as the
        category page's filter — a radiogroup promises arrow-key navigation
        between options, and these are ordinary buttons that say what they did
        through `aria-pressed`.
      */}
      <div role="group" aria-label={t('colorGroup')} className="flex flex-wrap gap-3">
        {colors.map((color) => {
          const isSelected = color.id === selectedId;

          return (
            <button
              key={color.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => select(color.id)}
              // The name, not the hex: "#46444a" read aloud is noise.
              aria-label={color.name}
              title={color.name}
              className={[
                'size-8 rounded-full border border-line outline-none transition-[box-shadow]',
                // The ring sits outside the chip, separated by an offset, so the
                // colour itself is never overlaid by the mark that selects it.
                'ring-offset-surface ring-offset-2',
                // The shop's own accent, not the reference's blue: a swatch ring
                // is exactly the kind of small borrowed signal that makes a site
                // read as the manufacturer (CLAUDE.md, hard constraints).
                isSelected ? 'ring-brand ring-2' : 'hover:ring-line hover:ring-2',
                'focus-visible:ring-ink focus-visible:ring-2',
              ].join(' ')}
              style={{ backgroundColor: color.hex }}
            />
          );
        })}
      </div>
    </div>
  );
}
