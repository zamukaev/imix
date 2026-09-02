'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  addLine,
  cartItemCount,
  cartSubtotal,
  removeLine,
  setLineQuantity,
  type CartLine,
  type CartLineInput,
} from '@/lib/cart';

const STORAGE_KEY = 'imix-cart';

/**
 * Bumped when a persisted line can no longer be trusted.
 *
 * v1 lines predate multi-currency: they carry a price with no record of which
 * currency it is in, so there is no way to display or re-price them honestly.
 * They are dropped rather than guessed at — losing a cart is recoverable, a
 * wrong price is not.
 */
const STORAGE_VERSION = 2;

type CartState = {
  lines: CartLine[];
  /**
   * False until the persisted cart has been read from localStorage, so the
   * first client render matches the server-rendered (empty) markup.
   *
   * This only holds because of `skipHydration` below. Left to itself, `persist`
   * reads localStorage synchronously while this module is evaluated — the cart
   * would already be full on React's very first client render, and every
   * consumer would disagree with the server-rendered HTML.
   */
  hasHydrated: boolean;
  addItem: (input: CartLineInput, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  /** Swaps the whole cart — used when a currency switch re-prices every line. */
  replaceLines: (lines: CartLine[]) => void;
  clear: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      hasHydrated: false,
      addItem: (input, quantity = 1) =>
        set((state) => ({ lines: addLine(state.lines, input, quantity) })),
      setQuantity: (variantId, quantity) =>
        set((state) => ({ lines: setLineQuantity(state.lines, variantId, quantity) })),
      removeItem: (variantId) => set((state) => ({ lines: removeLine(state.lines, variantId) })),
      replaceLines: (lines) => set({ lines }),
      clear: () => set({ lines: [] }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      /**
       * The cart is read after mount, by `CartHydrator`, not while this module
       * is being evaluated.
       *
       * localStorage is synchronous, so the default behaviour fills `lines`
       * before React ever renders on the client. The server has no localStorage
       * and renders an empty cart, so the header's count badge — present on
       * every storefront page — appeared on the client and not in the HTML, and
       * React threw out the hydrated tree for the whole page. That is a
       * hydration error on every visit with a non-empty cart, and it takes the
       * page's interactivity with it until React finishes re-rendering.
       */
      skipHydration: true,
      partialize: (state) => ({ lines: state.lines }),
      // Nothing to carry forward from an older shape — see STORAGE_VERSION.
      migrate: () => ({ lines: [] }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export function useCartItemCount(): number {
  return useCartStore((state) => cartItemCount(state.lines));
}

export function useCartSubtotal(): number {
  return useCartStore((state) => cartSubtotal(state.lines));
}
