import type { Metadata, Route } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import {
  ORDER_STATUSES,
  type AdminOrderDto,
  type Locale,
  type OrderStatus,
} from '@imix/types';
import { OrderStatusControl } from '@/components/admin/order-status-control';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { requireAdminApi } from '@/lib/admin-page';
import { getAdminOrders } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';

type OrdersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
};

const FIRST_PAGE = 1;

/** Message keys for the statuses, shared with the dashboard's own tiles. */
const STATUS_KEYS = {
  PENDING: 'statusPending',
  PAID: 'statusPaid',
  FAILED: 'statusFailed',
  SHIPPED: 'statusShipped',
  CANCELLED: 'statusCancelled',
} as const satisfies Record<OrderStatus, string>;

/** A muted badge per status — colour only where it means "look at this". */
const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: 'text-ink-muted',
  PAID: 'text-success',
  FAILED: 'text-danger',
  SHIPPED: 'text-brand',
  CANCELLED: 'text-ink-muted line-through',
};

export async function generateMetadata({ params }: OrdersPageProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'admin' });

  return { title: t('orders') };
}

function parseStatus(value: string | undefined): OrderStatus | undefined {
  return ORDER_STATUSES.find((status) => status === value);
}

/**
 * The order book.
 *
 * Rendered on the server and filtered through the URL rather than component
 * state: a filtered list is a place an admin links a colleague to, and the back
 * button should mean what it looks like it means.
 */
export default async function AdminOrdersPage({ params, searchParams }: OrdersPageProps) {
  const [{ locale: requested }, query] = await Promise.all([params, searchParams]);
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const status = parseStatus(query.status);
  const page = Number(query.page ?? FIRST_PAGE) || FIRST_PAGE;

  const [t, auth] = await Promise.all([
    getTranslations('admin'),
    requireAdminApi(locale),
  ]);
  const orders = await getAdminOrders(auth, { locale, status, page });

  const labels = Object.fromEntries(
    ORDER_STATUSES.map((value) => [value, t(STATUS_KEYS[value])]),
  ) as Record<OrderStatus, string>;

  const lastPage = Math.max(FIRST_PAGE, Math.ceil(orders.total / orders.pageSize));
  const filterHref = (next: OrderStatus | undefined): Route =>
    (next ? `/admin/orders?status=${next}` : '/admin/orders') as Route;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t('orders')}</h1>
      <p className="text-ink-muted mt-2 text-sm">{t('ordersNote')}</p>

      <nav aria-label={t('filterByStatus')} className="mt-6 flex flex-wrap gap-2">
        <FilterLink href={filterHref(undefined)} active={status === undefined}>
          {t('allStatuses')}
        </FilterLink>
        {ORDER_STATUSES.map((value) => (
          <FilterLink
            key={value}
            href={filterHref(value)}
            active={status === value}
          >
            {labels[value]}
          </FilterLink>
        ))}
      </nav>

      {orders.items.length === 0 ? (
        <p className="text-ink-muted mt-12">{t('noOrders')}</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.items.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              locale={locale}
              labels={labels}
            />
          ))}
        </ul>
      )}

      {lastPage > FIRST_PAGE ? (
        <nav
          aria-label={t('pagination')}
          className="text-ink-muted mt-8 flex items-center gap-4 text-sm"
        >
          {page > FIRST_PAGE ? (
            <Link
              href={
                `${filterHref(status)}${status ? '&' : '?'}page=${page - 1}` as Route
              }
              className="hover:text-ink"
            >
              ← {t('previousPage')}
            </Link>
          ) : null}
          <span>{t('pageOf', { page, total: lastPage })}</span>
          {page < lastPage ? (
            <Link
              href={
                `${filterHref(status)}${status ? '&' : '?'}page=${page + 1}` as Route
              }
              className="hover:text-ink"
            >
              {t('nextPage')} →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: Route;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-pill border px-4 py-1.5 text-xs ${
        active ? 'border-ink text-ink' : 'border-line text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </Link>
  );
}

async function OrderCard({
  order,
  locale,
  labels,
}: {
  order: AdminOrderDto;
  locale: Locale;
  labels: Record<OrderStatus, string>;
}) {
  const t = await getTranslations('admin');

  return (
    <li className="border-line bg-surface rounded-card border p-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={`text-sm font-medium ${STATUS_TONE[order.status]}`}>
          {labels[order.status]}
        </span>
        <span className="text-ink-muted text-xs">
          {formatDateTime(order.createdAt, locale)}
        </span>
        <span className="text-ink-muted text-xs">{order.email}</span>
        {order.userId === null ? (
          <span className="text-ink-muted text-xs">{t('guestOrder')}</span>
        ) : null}

        <span className="ml-auto text-lg font-semibold tabular-nums">
          {/* Currency beside the amount, never implied: the list mixes the two. */}
          {formatMoney(order.total, locale, order.currency)}
        </span>
      </div>

      <ul className="text-ink-muted mt-3 space-y-1 text-sm">
        {order.items.map((item) => (
          <li key={item.id}>
            {item.quantity} × {item.productName} · {item.variantLabel}
            <span className="ml-2 tabular-nums">
              {formatMoney(item.priceAtPurchase, locale, order.currency)}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-ink-muted mt-3 text-xs">
        {order.shipping.name}, {order.shipping.address}, {order.shipping.city}{' '}
        {order.shipping.zip}
      </p>

      <div className="mt-4">
        <OrderStatusControl
          orderId={order.id}
          status={order.status}
          labels={labels}
        />
      </div>
    </li>
  );
}
