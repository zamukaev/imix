'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ADMIN_ORDER_TRANSITIONS,
  type Locale,
  type OrderStatus,
} from '@imix/types';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { updateAdminOrderStatus } from '@/lib/admin-api';
import { toUserMessage } from '@/lib/api';

type OrderStatusControlProps = {
  orderId: string;
  status: OrderStatus;
  /** How each status is written, resolved by the row so this stays a leaf. */
  labels: Record<OrderStatus, string>;
};

/**
 * The buttons that move one order along.
 *
 * Only the transitions in `ADMIN_ORDER_TRANSITIONS` are offered, and that map is
 * shared with the API rather than restated here — an admin should not be shown a
 * button that comes back 409. PAID and FAILED are in nobody's list: the payment
 * webhook writes those.
 *
 * A terminal order renders no buttons at all, which is the honest way to say
 * that there is nothing left to do.
 */
export function OrderStatusControl({
  orderId,
  status,
  labels,
}: OrderStatusControlProps) {
  const t = useTranslations('admin');
  const tErrors = useTranslations('errors');
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = ADMIN_ORDER_TRANSITIONS[status];

  const move = async (next: OrderStatus) => {
    setPending(true);
    setError(null);

    try {
      await updateAdminOrderStatus(orderId, next, locale);
      // The list is rendered on the server, so this is what redraws the row —
      // and it redraws it from the database rather than from a local guess.
      router.refresh();
    } catch (failure) {
      setError(toUserMessage(failure, tErrors('fallback')));
    } finally {
      setPending(false);
    }
  };

  if (available.length === 0) {
    return <span className="text-ink-muted text-xs">{t('statusFinal')}</span>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {available.map((next) => (
          <Button
            key={next}
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => void move(next)}
            className="px-4 py-1.5 text-xs"
          >
            {pending ? t('saving') : t('moveTo', { status: labels[next] })}
          </Button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
