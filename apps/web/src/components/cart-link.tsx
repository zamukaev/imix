'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCartItemCount } from '@/stores/cart-store';

/**
 * Client island for the header — the cart count only exists in the browser
 * (localStorage), so this can't be a Server Component like the rest of
 * `SiteHeader`. Reads 0 during SSR/hydration and updates once the persisted
 * cart loads, which is an acceptable flash for a count badge.
 */
export function CartLink() {
  const t = useTranslations('nav');
  const itemCount = useCartItemCount();

  return (
    <Link
      href="/cart"
      className="text-ink-muted hover:text-ink flex items-center gap-1.5 text-sm transition-colors"
    >
      {t('cart')}
      {itemCount > 0 && (
        <span
          // Polite, not assertive: adding something to the cart should be
          // confirmed at the next pause, not by interrupting whatever is being
          // read. The number alone would announce as a bare digit, so the label
          // carries the sentence and the badge is hidden from the reader.
          role="status"
          aria-live="polite"
          className="bg-ink text-surface inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium"
        >
          <span className="sr-only">{t('cartItems', { count: itemCount })}</span>
          <span aria-hidden="true">{itemCount}</span>
        </span>
      )}
    </Link>
  );
}
