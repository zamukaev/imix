'use client';

import { useState } from 'react';
import type { ProductVariantDto } from '@imix/types';
import { formatMoney } from '@/lib/format';

const LOW_STOCK_THRESHOLD = 5;

type ProductPurchasePanelProps = {
  variants: ProductVariantDto[];
};

/**
 * The only interactive part of the detail page, so the client boundary stops
 * here rather than wrapping the whole route.
 *
 * "Add to cart" is intentionally inert — the cart is Phase 2.
 */
export function ProductPurchasePanel({ variants }: ProductPurchasePanelProps) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? '');
  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];

  if (!selected) {
    return <p className="text-ink-muted">Currently unavailable.</p>;
  }

  return (
    <div className="space-y-8">
      <p className="text-3xl font-medium tracking-tight">{formatMoney(selected.price)}</p>

      <fieldset>
        <legend className="text-ink-muted mb-3 text-xs tracking-widest uppercase">
          Configuration
        </legend>

        <div className="grid gap-2">
          {variants.map((variant) => {
            const isSelected = variant.id === selected.id;
            const soldOut = variant.stock === 0;

            return (
              <label
                key={variant.id}
                className={[
                  'flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm transition-colors',
                  isSelected ? 'border-ink' : 'border-line hover:border-ink-muted',
                  soldOut ? 'opacity-50' : '',
                ].join(' ')}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="variant"
                    value={variant.id}
                    checked={isSelected}
                    disabled={soldOut}
                    onChange={() => setSelectedId(variant.id)}
                    className="accent-brand"
                  />
                  {variant.label}
                </span>
                <span className="text-ink-muted">{formatMoney(variant.price)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-3">
        <button
          type="button"
          disabled
          title="The cart arrives in Phase 2"
          className="bg-ink text-surface w-full rounded-full px-6 py-3 text-sm font-medium disabled:opacity-40"
        >
          Add to cart
        </button>

        <p aria-live="polite" className="text-ink-muted text-center text-xs">
          {selected.stock === 0
            ? 'Sold out'
            : selected.stock <= LOW_STOCK_THRESHOLD
              ? `Only ${selected.stock} left`
              : 'In stock'}
        </p>
      </div>
    </div>
  );
}
