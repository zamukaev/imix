import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartLine } from '@/lib/cart';

const STORAGE_KEY = 'imix-cart';
const STORAGE_VERSION = 2;

const line: CartLine = {
  variantId: 'v1',
  productSlug: 'iphone-17-pro',
  productName: 'iPhone 17 Pro',
  brand: 'Apple',
  variantLabel: '256 ГБ · Чёрный титан',
  unitPrice: 14999000,
  currency: 'RUB',
  locale: 'ru',
  image: null,
  stock: 5,
  quantity: 2,
};

/**
 * A minimal synchronous storage, which is the case that matters here.
 *
 * Stubbed on `window`, not on the global: zustand's default storage is
 * `createJSONStorage(() => window.localStorage)`, and if that access throws the
 * middleware quietly drops persistence altogether — no `.persist` on the store
 * and nothing saved. Which is also why this store simply does not persist during
 * SSR, where there is no `window` at all.
 */
function stubStorage(seeded?: unknown) {
  const entries = new Map<string, string>();

  if (seeded !== undefined) {
    entries.set(STORAGE_KEY, JSON.stringify({ state: seeded, version: STORAGE_VERSION }));
  }

  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
      clear: () => entries.clear(),
      key: () => null,
      length: 0,
    },
  });

  return entries;
}

/** Fresh module per test — the store reads storage at rehydrate time, not import. */
async function loadStore() {
  vi.resetModules();
  return (await import('./cart-store')).useCartStore;
}

describe('cart store hydration', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts empty even when a cart is already persisted', async () => {
    // The whole point: React's first client render has to see what the server
    // rendered. A synchronously-read localStorage would fill this in before
    // React ever ran, and the header's count badge would not match the HTML.
    stubStorage({ lines: [line] });
    const store = await loadStore();

    expect(store.getState().lines).toEqual([]);
    expect(store.getState().hasHydrated).toBe(false);
  });

  it('restores the persisted cart once rehydrate is called', async () => {
    stubStorage({ lines: [line] });
    const store = await loadStore();

    await store.persist.rehydrate();

    expect(store.getState().lines).toEqual([line]);
    expect(store.getState().hasHydrated).toBe(true);
  });

  it('reports hydrated even when there was nothing to restore', async () => {
    // Otherwise the cart page, which renders nothing until this flips, would
    // show an empty screen forever to a first-time visitor.
    stubStorage();
    const store = await loadStore();

    await store.persist.rehydrate();

    expect(store.getState().lines).toEqual([]);
    expect(store.getState().hasHydrated).toBe(true);
  });

  it('keeps a clear that lands after rehydration', async () => {
    // The confirmation page empties the cart in an effect. `CartHydrator` runs
    // first, so the order is restore-then-clear; if it ever inverted, a paid
    // order would leave the old cart sitting in the header.
    stubStorage({ lines: [line] });
    const store = await loadStore();

    await store.persist.rehydrate();
    store.getState().clear();

    expect(store.getState().lines).toEqual([]);
  });

  it('drops a cart persisted under the pre-currency shape', async () => {
    const entries = stubStorage({ lines: [] });
    // A v1 line: a price with no currency beside it, which cannot be shown
    // honestly. `migrate` throws these away rather than guessing.
    entries.set(
      STORAGE_KEY,
      JSON.stringify({ state: { lines: [{ variantId: 'old' }] }, version: 1 }),
    );
    const store = await loadStore();

    await store.persist.rehydrate();

    expect(store.getState().lines).toEqual([]);
  });
});
