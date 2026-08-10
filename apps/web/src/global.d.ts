import type { routing } from '@/i18n/routing';
import type messages from '@/messages/ru.json';

/**
 * Teaches next-intl what this app's locales and messages are.
 *
 * Two things fall out of it: `useLocale()` returns the `'ru' | 'en'` union
 * instead of a bare string (so nothing has to be cast back), and `t('…')` only
 * accepts keys that exist — a message added to one catalogue and forgotten in
 * the other is a compile error, not a `nav.cart` rendered to a shopper.
 *
 * Russian is the reference catalogue because it is the shop's primary language.
 */
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
