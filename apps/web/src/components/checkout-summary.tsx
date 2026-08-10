'use client';

import { useTranslations } from 'next-intl';
import { useMoney } from '@/components/currency-provider';
import { cartSubtotal, type CartLine } from '@/lib/cart';

type CheckoutSummaryProps = {
  lines: readonly CartLine[];
};

/**
 * What is being bought, restated next to the form. Prices here are the cart's
 * snapshot; the total that gets charged is the one the API computes.
 */
export function CheckoutSummary({ lines }: CheckoutSummaryProps) {
  const t = useTranslations('checkout');
  const money = useMoney();

  return (
    <section aria-labelledby="summary-heading" className="bg-surface-alt rounded-card p-6">
      <h2 id="summary-heading" className="text-sm tracking-widest uppercase">
        {t('summaryTitle')}
      </h2>

      <ul className="mt-6 space-y-4">
        {lines.map((line) => (
          <li key={line.variantId} className="flex gap-3 text-sm">
            <span
              aria-hidden="true"
              className="border-line bg-surface flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border"
            >
              {line.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={line.image}
                  alt=""
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </span>

            <span className="flex-1">
              <span className="block font-medium">{line.productName}</span>
              <span className="text-ink-muted block text-xs">
                {line.variantLabel} · {line.quantity} ×
              </span>
            </span>

            <span className="font-medium whitespace-nowrap">
              {money(line.unitPrice * line.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-line mt-6 flex items-baseline justify-between border-t pt-4">
        <span className="text-ink-muted text-sm">{t('summaryTotal')}</span>
        <span className="text-lg font-medium tracking-tight">{money(cartSubtotal(lines))}</span>
      </div>

      <p className="text-ink-muted mt-2 text-xs">{t('summaryNote')}</p>
    </section>
  );
}
