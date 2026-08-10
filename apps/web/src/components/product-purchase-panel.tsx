'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Currency, ProductVariantDto } from '@imix/types';
import { useMoney } from '@/components/currency-provider';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cart-store';

const LOW_STOCK_THRESHOLD = 5;
/** How long the "Added" confirmation stays up before the button resets. */
const ADDED_CONFIRMATION_MS = 1500;

type ProductPurchasePanelProps = {
  productSlug: string;
  productName: string;
  brand: string;
  /**
   * The currency the API priced these variants in. Stored on the cart line
   * along with the active locale, so the cart knows what its copies are copies
   * *of* and can be re-fetched when either changes.
   */
  currency: Currency;
  image: string | null;
  variants: ProductVariantDto[];
};

/**
 * The only interactive part of the detail page, so the client boundary stops
 * here rather than wrapping the whole route.
 */
export function ProductPurchasePanel({
  productSlug,
  productName,
  brand,
  currency,
  image,
  variants,
}: ProductPurchasePanelProps) {
  const t = useTranslations('product');
  const locale = useLocale();
  const money = useMoney();
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? '');
  const [justAdded, setJustAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];

  if (!selected) {
    return <p className="text-ink-muted">{t('unavailable')}</p>;
  }

  function handleAddToCart() {
    if (!selected) return;

    addItem({
      variantId: selected.id,
      productSlug,
      productName,
      brand,
      variantLabel: selected.label,
      unitPrice: selected.price,
      currency,
      locale,
      image,
      stock: selected.stock,
    });

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), ADDED_CONFIRMATION_MS);
  }

  return (
    <div className="space-y-8">
      <p className="text-3xl font-medium tracking-tight">{money(selected.price)}</p>

      <fieldset>
        <legend className="text-ink-muted mb-3 text-xs tracking-widest uppercase">
          {t('configuration')}
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
                <span className="text-ink-muted">{money(variant.price)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-3">
        <Button onClick={handleAddToCart} disabled={selected.stock === 0} fullWidth>
          {justAdded ? t('added') : t('addToCart')}
        </Button>

        <p aria-live="polite" className="text-ink-muted text-center text-xs">
          {selected.stock === 0
            ? t('soldOut')
            : selected.stock <= LOW_STOCK_THRESHOLD
              ? t('lowStock', { count: selected.stock })
              : t('inStock')}
        </p>
      </div>
    </div>
  );
}
