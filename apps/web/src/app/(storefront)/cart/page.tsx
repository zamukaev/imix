'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { CartLineItem } from '@/components/cart-line-item';
import { cartSubtotal } from '@/lib/cart';
import { formatMoney } from '@/lib/format';
import { useCartStore } from '@/stores/cart-store';

export default function CartPage() {
  const lines = useCartStore((state) => state.lines);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const subtotal = cartSubtotal(lines);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Cart</h1>

      {!hasHydrated ? null : lines.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-ink-muted">Your cart is empty.</p>
          <Link href="/" className="text-brand mt-4 inline-block text-sm hover:underline">
            Continue browsing
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-10">
            {lines.map((line) => (
              <CartLineItem key={line.variantId} line={line} />
            ))}
          </ul>

          <div className="border-line mt-6 flex items-center justify-between border-t pt-6">
            <p className="text-ink-muted text-sm">Subtotal</p>
            <p className="text-xl font-medium tracking-tight">{formatMoney(subtotal)}</p>
          </div>

          <Link
            href={'/checkout' as Route}
            className="bg-ink text-surface mt-8 block w-full rounded-full px-6 py-3 text-center text-sm font-medium opacity-40"
            aria-disabled
            onClick={(event) => event.preventDefault()}
            title="Checkout arrives later in Phase 2"
          >
            Checkout
          </Link>
        </>
      )}
    </main>
  );
}
