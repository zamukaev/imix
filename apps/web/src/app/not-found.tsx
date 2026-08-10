import { redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';

/**
 * Catches requests the locale middleware never rewrote — malformed paths that
 * match no `[locale]` segment at all. There is no layout above this one, so
 * rather than duplicating `<html>` and the whole chrome, it sends the visitor
 * to the storefront root, where the real localised 404 lives.
 */
export default function RootNotFound() {
  redirect(`/${routing.defaultLocale}`);
}
