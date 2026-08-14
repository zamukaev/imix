import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@imix/types';
import { OrderSummaryCard } from '@/components/order-summary-card';
import { ButtonLink } from '@/components/ui/button';
import { getMe, getMyOrders } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { MAIN_CONTENT_ID } from '@/lib/main-content';
import { redirectLocalised } from '@/lib/redirect-localised';
import { getRequestContext } from '@/lib/request-context';
import { PRIVATE_PAGE } from '@/lib/seo';
import { getAccessToken } from '@/lib/session';
import { ACCOUNT_PATH, LOGIN_PATH, RETURN_TO_PARAM } from '@/lib/session-routes';

/**
 * A shopper's own account: who they are here, and what they have bought.
 *
 * A tool rather than a shop window, so it wears the storefront's chrome but not
 * its tile language (ARCHITECTURE.md §5) — headline type, not display type, and
 * no full-bleed artwork. The only colour on the page is an order's status.
 *
 * Server Component throughout. Both reads need the bearer token, which lives in
 * an httpOnly cookie: a client component could not read it, and this way the
 * page arrives rendered rather than as a spinner that fetches.
 */

type AccountPageProps = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({
  params,
}: AccountPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  return {
    title: t('title'),
    // Nothing here belongs to anyone but one visitor, so it stays out of every
    // index — the same rule as the cart and the order pages.
    ...PRIVATE_PAGE,
  };
}

export default async function AccountPage() {
  const context = await getRequestContext();
  const token = await getAccessToken();

  // The middleware already turned anonymous visitors away; this is the second
  // of the three layers in §4.3, and it exists because a cookie can go stale
  // between the middleware and the render.
  if (!token) {
    redirectLocalised(
      `${LOGIN_PATH}?${RETURN_TO_PARAM}=${encodeURIComponent(ACCOUNT_PATH)}`,
      context.locale,
    );
  }

  const auth = { accessToken: token };
  const [t, user, orders] = await Promise.all([
    getTranslations('account'),
    getMe(auth),
    getMyOrders(auth, context),
  ]);

  return (
    // Narrower than the catalogue's column on purpose. This page is read line
    // by line, and a status pinned 70rem away from its own total is a distance
    // the eye has to travel for nothing.
    <main
      id={MAIN_CONTENT_ID}
      className="mx-auto max-w-3xl px-page-gutter py-section"
    >
      <h1 className="text-headline font-semibold">{t('title')}</h1>

      <section className="mt-16">
        <h2 className="text-subhead font-semibold">{t('detailsTitle')}</h2>

        {/* A description list, because that is what this is: labelled facts
            about one person. `dt`/`dd` gives a screen reader the pairing that a
            two-column grid only implies visually. */}
        <dl className="border-line mt-8 grid gap-x-8 gap-y-6 border-t pt-8 sm:grid-cols-[10rem_1fr]">
          <dt className="text-ink-muted text-sm">{t('email')}</dt>
          <dd className="font-medium break-all">{user.email}</dd>

          <dt className="text-ink-muted text-sm">{t('name')}</dt>
          {/* Optional at registration, so it is genuinely absent rather than
              empty — say so instead of rendering a blank row. */}
          <dd className={user.name ? 'font-medium' : 'text-ink-muted'}>
            {user.name ?? t('nameMissing')}
          </dd>

          <dt className="text-ink-muted text-sm">{t('memberSince')}</dt>
          <dd className="font-medium">
            {formatDate(user.createdAt, context.locale)}
          </dd>
        </dl>
      </section>

      <section className="mt-section">
        <h2 className="text-subhead font-semibold">{t('ordersTitle')}</h2>

        {orders.length === 0 ? (
          // An empty screen is an invitation to act, not a dead end: the
          // catalogue is the thing to do next, so it is a button.
          <div className="border-line mt-8 border-t pt-8">
            <p className="text-ink-muted">{t('ordersEmpty')}</p>
            <ButtonLink href="/" className="mt-8">
              {t('ordersEmptyAction')}
            </ButtonLink>
          </div>
        ) : (
          <ul className="mt-8 flex flex-col gap-4">
            {orders.map((order) => (
              <OrderSummaryCard key={order.id} order={order} />
            ))}
          </ul>
        )}

        {/* Said plainly and always, not only when the list is empty: somebody
            who checked out as a guest will come looking for that order here,
            and silence would read as the shop having lost it. */}
        <p className="text-ink-muted mt-8 max-w-prose text-sm">{t('guestNote')}</p>
      </section>
    </main>
  );
}
