'use client';

import Link from 'next/link';
import { useCartItemCount } from '@/stores/cart-store';

/**
 * Client island for the header — the cart count only exists in the browser
 * (localStorage), so this can't be a Server Component like the rest of
 * `SiteHeader`. Reads 0 during SSR/hydration and updates once the persisted
 * cart loads, which is an acceptable flash for a count badge.
 */
export function CartLink() {
  const itemCount = useCartItemCount();

  return (
    <Link
      href="/cart"
      className="text-ink-muted hover:text-ink flex items-center gap-1.5 text-sm transition-colors"
    >
      Cart
      {itemCount > 0 && (
        <span className="bg-ink text-surface inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
