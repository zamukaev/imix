'use client';

import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { useMoney } from '@/components/currency-provider';
import { Link } from '@/i18n/navigation';
import { lineLimit, type CartLine } from '@/lib/cart';
import { useCartStore } from '@/stores/cart-store';

type CartLineItemProps = {
  line: CartLine;
};

export function CartLineItem({ line }: CartLineItemProps) {
  const t = useTranslations('cart');
  const money = useMoney();
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const limit = lineLimit(line);

  return (
    <li className="border-line flex gap-4 border-b py-6 first:pt-0 last:border-b-0">
      <Link
        href={`/product/${line.productSlug}` as Route}
        className="bg-surface-alt rounded-card size-24 shrink-0 overflow-hidden"
      >
        {line.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={line.image}
            alt=""
            width={200}
            height={200}
            className="h-full w-full object-cover"
          />
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col justify-between">
        <div>
          <p className="text-ink-muted text-xs tracking-widest uppercase">{line.brand}</p>
          <Link
            href={`/product/${line.productSlug}` as Route}
            className="text-lg font-medium tracking-tight hover:underline"
          >
            {line.productName}
          </Link>
          <p className="text-ink-muted text-sm">{line.variantLabel}</p>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-muted">{t('quantity')}</span>
            <select
              value={line.quantity}
              onChange={(event) => setQuantity(line.variantId, Number(event.target.value))}
              className="border-line rounded-lg border px-2 py-1"
              aria-label={t('quantityLabel', {
                product: line.productName,
                variant: line.variantLabel,
              })}
            >
              {Array.from({ length: limit }, (_, index) => index + 1).map((quantity) => (
                <option key={quantity} value={quantity}>
                  {quantity}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => removeItem(line.variantId)}
            className="text-ink-muted hover:text-ink text-sm hover:underline"
          >
            {t('remove')}
          </button>
        </div>
      </div>

      <p className="text-sm font-medium whitespace-nowrap">
        {money(line.unitPrice * line.quantity)}
      </p>
    </li>
  );
}
