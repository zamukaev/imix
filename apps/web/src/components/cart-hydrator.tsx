'use client';

import { useEffect } from 'react';
import { useCartStore } from '@/stores/cart-store';

/**
 * Reads the persisted cart out of localStorage, once, after the storefront has
 * mounted.
 *
 * The cart store sets `skipHydration` so that React's first client render sees
 * the same empty cart the server rendered (see `stores/cart-store.ts`). Someone
 * then has to actually perform the read, and an effect is the earliest moment
 * that is safe: effects do not run during hydration, so nothing here can change
 * the markup React is still matching against.
 *
 * It lives in the storefront layout rather than in `CartLink`, so the cart is
 * restored because the shop is on screen — not as a side effect of one badge in
 * the header happening to be mounted.
 */
export function CartHydrator() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  return null;
}
