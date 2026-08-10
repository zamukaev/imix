import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware replacements for `next/link` and the navigation hooks. Import
 * these instead of the ones from `next/*` — they keep the active locale in the
 * URL, so an English visitor stays on `/en/...` when following a link.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
