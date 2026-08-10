import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from '@imix/types';

/**
 * How locales appear in the URL.
 *
 * `as-needed` keeps Russian — the shop's language — on bare paths (`/phones`)
 * and prefixes only English (`/en/phones`). The set of locales is the same one
 * the API validates against, so the two cannot drift apart.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
});
