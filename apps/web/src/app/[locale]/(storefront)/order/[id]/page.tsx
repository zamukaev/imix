import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Locale, OrderDto, OrderStatus } from '@imix/types';
import { OrderConfirmation } from '@/components/order-confirmation';
import { ButtonLink } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getOrderOrNull } from '@/lib/api';
import { formatCountry, formatDateTime, formatMoney } from '@/lib/format';
import { getRequestContext } from '@/lib/request-context';

type OrderPageProps = {
  params: Promise<{ id: string; locale: Locale }>;
};

/** An order page is private to whoever holds the link — keep it out of search. */
export async function generateMetadata({ params }: OrderPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('orderTitle'),
    robots: { index: false, follow: false },
  };
}

/** Statuses that mean the money has actually changed hands. */
const SETTLED_STATUSES: ReadonlySet<OrderStatus> = new Set(['PAID', 'SHIPPED']);

/** Message keys per status, so a new status is a compile error, not a blank. */
const HEADLINE_KEYS = {
  PENDING: 'headlinePending',
  PAID: 'headlinePaid',
  FAILED: 'headlineFailed',
  SHIPPED: 'headlineShipped',
  CANCELLED: 'headlineCancelled',
} as const satisfies Record<OrderStatus, string>;

export default async function OrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const { locale } = await getRequestContext();
  const [t, order] = await Promise.all([
    getTranslations('order'),
    getOrderOrNull(id, { locale }),
  ]);

  if (!order) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {t(HEADLINE_KEYS[order.status])}
      </h1>

      <div className="mt-4 space-y-1">
        <OrderConfirmation status={order.status} />
        <p className="text-ink-muted text-sm">
          {t.rich('reference', {
            id: order.id,
            date: formatDateTime(order.createdAt, locale),
            ref: (chunks) => <span className="text-ink font-medium">{chunks}</span>,
          })}
        </p>
      </div>

      {order.status === 'FAILED' ? (
        <ButtonLink href="/cart" className="mt-8">
          {t('backToCart')}
        </ButtonLink>
      ) : null}

      <OrderLines order={order} locale={locale} />

      <section aria-labelledby="delivery-heading" className="mt-12">
        <h2 id="delivery-heading" className="text-ink-muted text-xs tracking-widest uppercase">
          {t('deliveringTo')}
        </h2>
        <address className="mt-3 text-sm not-italic">
          {order.shipping.name}
          <br />
          {order.shipping.address}
          <br />
          {order.shipping.zip} {order.shipping.city}
          <br />
          {formatCountry(order.shipping.country, locale)}
        </address>
        <p className="text-ink-muted mt-3 text-sm">
          {t('confirmationSentTo', { email: order.email })}
        </p>
      </section>

      <Link href="/" className="text-brand mt-12 inline-block text-sm hover:underline">
        {t('continueBrowsing')}
      </Link>
    </main>
  );
}

async function OrderLines({ order, locale }: { order: OrderDto; locale: Locale }) {
  const t = await getTranslations('order');
  /** Every amount on this page is in the order's own frozen currency. */
  const money = (amount: number) => formatMoney(amount, locale, order.currency);

  return (
    <section aria-labelledby="items-heading" className="mt-12">
      <h2 id="items-heading" className="text-ink-muted text-xs tracking-widest uppercase">
        {t('items')}
      </h2>

      <ul className="mt-4">
        {order.items.map((item) => (
          <li key={item.id} className="border-line flex gap-4 border-b py-5 last:border-b-0">
            <span
              aria-hidden="true"
              className="bg-surface-alt flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl"
            >
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  width={128}
                  height={128}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </span>

            <div className="flex-1">
              <Link
                href={`/product/${item.productSlug}`}
                className="font-medium tracking-tight hover:underline"
              >
                {item.productName}
              </Link>
              <p className="text-ink-muted text-sm">
                {item.variantLabel} · {item.quantity} ×
              </p>
            </div>

            <p className="text-sm font-medium whitespace-nowrap">
              {money(item.priceAtPurchase * item.quantity)}
            </p>
          </li>
        ))}
      </ul>

      <div className="border-line mt-4 flex items-baseline justify-between border-t pt-4">
        {/* Nothing has been paid until the webhook says so — don't claim it has. */}
        <span className="text-ink-muted text-sm">
          {SETTLED_STATUSES.has(order.status) ? t('totalPaid') : t('total')}
        </span>
        <span className="text-xl font-medium tracking-tight">{money(order.total)}</span>
      </div>
    </section>
  );
}
