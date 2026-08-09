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

type CartState = {
  lines: CartLine[];
  /** False until the persisted cart has been read from localStorage, so the
   * first client render matches the server-rendered (empty) markup. */
  hasHydrated: boolean;
  addItem: (input: CartLineInput, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
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
      clear: () => set({ lines: [] }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ lines: state.lines }),
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
