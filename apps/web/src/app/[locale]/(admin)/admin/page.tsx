import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import {
  ORDER_STATUSES,
  type AdminStatsDto,
  type Locale,
  type OrderStatus,
} from '@imix/types';
import { routing } from '@/i18n/routing';
import { ApiRequestError, getAdminStats } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { redirectLocalised } from '@/lib/redirect-localised';
import { getAccessToken } from '@/lib/session';

type DashboardProps = {
  params: Promise<{ locale: string }>;
};

const UNAUTHORISED = [401, 403];

export async function generateMetadata({ params }: DashboardProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'admin' });

  return { title: t('dashboardTitle') };
}

/**
 * The dashboard.
 *
 * Four catalogue counts, the order book by status, and revenue — which is the
 * one figure here with an opinion behind it. See `RevenueCard`.
 */
export default async function AdminDashboardPage({ params }: DashboardProps) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const [t, accessToken] = await Promise.all([
    getTranslations('admin'),
    getAccessToken(),
  ]);

  if (!accessToken) {
    redirectLocalised('/login', locale);
  }

  const stats = await loadStats(accessToken, locale);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t('dashboardTitle')}</h1>

      <Section title={t('catalogueLegend')}>
        <Stat label={t('categories')} value={stats.catalogue.categories} />
        <Stat label={t('products')} value={stats.catalogue.products} />
        <Stat label={t('variants')} value={stats.catalogue.variants} />
        <Stat
          label={t('outOfStock')}
          value={stats.catalogue.outOfStockVariants}
          // The only catalogue number that is a to-do rather than a fact.
          tone={stats.catalogue.outOfStockVariants > 0 ? 'warning' : 'plain'}
        />
      </Section>

      <Section title={t('ordersLegend')}>
        <Stat label={t('ordersTotal')} value={stats.orders.total} />
        {ORDER_STATUSES.map((status) => (
          <Stat
            key={status}
            label={t(statusKey(status))}
            value={stats.orders.byStatus[status]}
          />
        ))}
      </Section>

      <Section title={t('revenueLegend')} note={t('revenueNote')}>
        {stats.revenue.map((entry) => (
          <RevenueCard
            key={entry.currency}
            amount={formatMoney(entry.total, locale, entry.currency)}
            currency={entry.currency}
            orders={t('revenueOrders', { count: entry.orders })}
          />
        ))}
      </Section>
    </main>
  );
}

async function loadStats(accessToken: string, locale: Locale): Promise<AdminStatsDto> {
  try {
    return await getAdminStats({ accessToken });
  } catch (error) {
    // The API is the one that decides. If it says no, the cookie is stale or
    // the role was taken away since it was issued — either way, back to the
    // door rather than a page full of empty numbers.
    if (error instanceof ApiRequestError && UNAUTHORISED.includes(error.status)) {
      redirectLocalised('/login', locale);
    }

    throw error;
  }
}

/** Keeps the status → message-key mapping in one place and typed. */
const STATUS_KEYS = {
  PENDING: 'statusPending',
  PAID: 'statusPaid',
  FAILED: 'statusFailed',
  SHIPPED: 'statusShipped',
  CANCELLED: 'statusCancelled',
} as const satisfies Record<OrderStatus, string>;

function statusKey(status: OrderStatus): (typeof STATUS_KEYS)[OrderStatus] {
  return STATUS_KEYS[status];
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-ink-muted text-caption uppercase">{title}</h2>
      {note ? <p className="text-ink-muted mt-2 text-sm">{note}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone = 'plain',
}: {
  label: string;
  value: number;
  tone?: 'plain' | 'warning';
}) {
  return (
    <div className="border-line bg-surface rounded-card border p-5">
      <p className="text-ink-muted text-sm">{label}</p>
      <p
        className={`mt-1 text-3xl font-semibold tabular-nums ${
          tone === 'warning' ? 'text-danger' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * One currency, on its own card.
 *
 * The two are never added up and there is no combined total anywhere on this
 * page: the shop stores a rouble price and a dollar price set by hand, with no
 * exchange rate in the system, so a single number would be one nobody could
 * reproduce from the orders.
 */
function RevenueCard({
  amount,
  currency,
  orders,
}: {
  amount: string;
  currency: string;
  orders: string;
}) {
  return (
    <div className="border-line bg-surface rounded-card border p-5">
      <p className="text-ink-muted text-caption uppercase">{currency}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{amount}</p>
      <p className="text-ink-muted mt-1 text-sm">{orders}</p>
    </div>
  );
}
