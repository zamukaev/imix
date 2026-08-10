'use client';

import { useTranslations } from 'next-intl';
import { CartLineItem } from '@/components/cart-line-item';
import { useMoney } from '@/components/currency-provider';
import { ButtonLink } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cartSubtotal } from '@/lib/cart';
import { useCartStore } from '@/stores/cart-store';

export default function CartPage() {
  const t = useTranslations('cart');
  const money = useMoney();
  const lines = useCartStore((state) => state.lines);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const subtotal = cartSubtotal(lines);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t('title')}</h1>

      {!hasHydrated ? null : lines.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-ink-muted">{t('empty')}</p>
          <Link href="/" className="text-brand mt-4 inline-block text-sm hover:underline">
            {t('continueBrowsing')}
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
            <p className="text-ink-muted text-sm">{t('subtotal')}</p>
            <p className="text-xl font-medium tracking-tight">{money(subtotal)}</p>
          </div>

          <ButtonLink href="/checkout" fullWidth className="mt-8">
            {t('checkout')}
          </ButtonLink>
        </>
      )}
    </main>
  );
}
