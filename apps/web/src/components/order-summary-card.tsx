import type { Route } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import type { OrderDto, OrderStatus } from '@imix/types';
import { Link } from '@/i18n/navigation';
import { formatDateTime, formatMoney } from '@/lib/format';

/**
 * One past order, as it appears in the account's history.
 *
 * A summary, not the order: what a shopper scans a list for is *when*, *how
 * much*, and *where is it* — the contents are one click away on the
 * confirmation page, which already renders them.
 *
 * Server Component. Nothing here is interactive but the link.
 */

/** Message keys per status, so a new status is a compile error, not a blank. */
const STATUS_KEYS = {
  PENDING: 'statusPending',
  PAID: 'statusPaid',
  FAILED: 'statusFailed',
  SHIPPED: 'statusShipped',
  CANCELLED: 'statusCancelled',
} as const satisfies Record<OrderStatus, string>;

/**
 * The one place colour is spent on this page, and only where it carries
 * meaning: money taken, money not taken. The three states in between are
 * ordinary and stay in ink — colouring all five would make none of them read.
 */
const STATUS_TONE = {
  PENDING: 'text-ink-muted',
  PAID: 'text-success',
  FAILED: 'text-danger',
  SHIPPED: 'text-success',
  CANCELLED: 'text-ink-muted',
} as const satisfies Record<OrderStatus, string>;

type OrderSummaryCardProps = {
  order: OrderDto;
};

export async function OrderSummaryCard({ order }: OrderSummaryCardProps) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('account')]);
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <li>
      <Link
        href={`/order/${order.id}` as Route}
        className="border-line hover:border-ink rounded-card bg-surface block border p-6 transition-colors outline-none focus-visible:ring-4 focus-visible:ring-(--surface-ink)/20 sm:p-8"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className={`font-medium ${STATUS_TONE[order.status]}`}>
            {t(STATUS_KEYS[order.status])}
          </p>
          <p className="text-lg font-medium">
            {formatMoney(order.total, locale, order.currency)}
          </p>
        </div>

        <div className="text-ink-muted mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
          <span>{formatDateTime(order.createdAt, locale)}</span>
          <span>{t('itemCount', { count: itemCount })}</span>
        </div>

        {/* The id last and quietest: it is a reference to quote at us, not
            something a shopper reads the list by. */}
        <p className="text-ink-muted mt-4 font-mono text-xs">{order.id}</p>
      </Link>
    </li>
  );
}
