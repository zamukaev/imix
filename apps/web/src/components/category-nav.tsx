'use client';

import { useEffect, useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import type { CategoryDto } from '@imix/types';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * The category list in the header.
 *
 * Six categories do not fit next to the switchers below `lg`. Measured, not
 * guessed: at 375 they overflowed the viewport by a full screen width, and at
 * 768 they still pushed the cart link 39px past the right edge — which is why
 * the breakpoint is `lg` rather than the `sm` this started at. Above it they
 * sit inline; below it they collapse behind a toggle and drop out of the header
 * as a panel.
 *
 * Only the *categories* collapse. The currency and language switchers stay
 * visible at every width: they are two characters each, and burying the price
 * currency behind a menu on the screen where prices matter most would be a poor
 * trade.
 */
export function CategoryNav({ categories }: { categories: CategoryDto[] }) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Client-side navigation keeps the DOM, so the panel would otherwise stay
  // open behind the page the shopper just asked for.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex flex-1 items-center">
      <ul className="hidden items-center gap-6 text-sm lg:flex">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={`/${category.slug}` as Route}
              className="text-ink-muted hover:text-ink transition-colors"
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-controls="category-menu"
        className="text-ink-muted hover:text-ink -m-2 p-2 transition-colors lg:hidden"
      >
        <span className="sr-only">{t('menu')}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          {open ? (
            <>
              <path d="M5 5l10 10" />
              <path d="M15 5L5 15" />
            </>
          ) : (
            <>
              <path d="M3 6h14" />
              <path d="M3 10h14" />
              <path d="M3 14h14" />
            </>
          )}
        </svg>
      </button>

      {/* Positioned against the `relative` header, so it drops below the whole
          bar rather than below the button. */}
      <ul
        id="category-menu"
        hidden={!open}
        className="border-line bg-surface absolute inset-x-0 top-full border-b px-6 py-2 lg:hidden"
      >
        {categories.map((category) => (
          <li key={category.id} className="border-line border-b last:border-b-0">
            <Link
              href={`/${category.slug}` as Route}
              className="text-ink block py-3 text-sm"
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
