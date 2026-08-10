'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { OrderStatus } from '@imix/types';
import { useCartStore } from '@/stores/cart-store';

/** Long enough for a webhook round trip, short enough to feel live. */
const POLL_INTERVAL_MS = 2500;
/** Stop after ~20s — past that, a webhook problem is not going to fix itself. */
const MAX_POLLS = 8;

type OrderConfirmationProps = {
  status: OrderStatus;
};

/** Message keys per status, so a new status is a compile error, not a blank. */
const STATUS_KEYS = {
  PENDING: 'statusPending',
  PAID: 'statusPaid',
  FAILED: 'statusFailed',
  SHIPPED: 'statusShipped',
  CANCELLED: 'statusCancelled',
} as const satisfies Record<OrderStatus, string>;

/**
 * The client half of the confirmation page.
 *
 * Two jobs, both of which need the browser: empty the cart now that its contents
 * are an order, and keep the status honest. Stripe can confirm the payment in
 * the browser before its webhook reaches the API, so an order that is still
 * PENDING gets re-fetched a few times rather than leaving the shopper staring at
 * a page that will never update on its own.
 */
export function OrderConfirmation({ status }: OrderConfirmationProps) {
  const t = useTranslations('order');
  const router = useRouter();

  useEffect(() => {
    useCartStore.getState().clear();
  }, []);

  useEffect(() => {
    if (status !== 'PENDING') {
      return;
    }

    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;

      if (polls > MAX_POLLS) {
        clearInterval(timer);
        return;
      }

      router.refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [status, router]);

  return (
    <p aria-live="polite" className="text-ink-muted text-sm">
      {t(STATUS_KEYS[status])}
    </p>
  );
}
