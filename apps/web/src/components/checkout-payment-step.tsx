'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import type { Currency, Money } from '@imix/types';
import { Button } from '@/components/ui/button';
import { getPathname, useRouter } from '@/i18n/navigation';
import { formatMoney } from '@/lib/format';

type PaymentState =
  { status: 'ready' } | { status: 'confirming' } | { status: 'error'; message: string };

type CheckoutPaymentStepProps = {
  orderId: string;
  /** Amount the provider will charge, as the API priced it. */
  amount: Money;
  /**
   * The order's own currency, echoed by the API. Not the shopper's current
   * pick: the order was priced when it was placed and cannot be restated.
   */
  currency: Currency;
};

/**
 * Step two of checkout. Must be rendered inside `<Elements>` — the Stripe hooks
 * read the client secret from that provider.
 *
 * Card details never touch this code: `PaymentElement` renders in a Stripe-owned
 * iframe and `confirmPayment` sends them straight to Stripe.
 */
export function CheckoutPaymentStep({
  orderId,
  amount,
  currency,
}: CheckoutPaymentStepProps) {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [state, setState] = useState<PaymentState>({ status: 'ready' });

  const confirmationPath = `/order/${orderId}` as const;
  /**
   * Stripe redirects the browser straight to this URL, bypassing the router, so
   * it has to carry the locale prefix itself — otherwise an English shopper
   * lands back on the Russian confirmation page.
   */
  const returnPath = getPathname({ href: confirmationPath, locale });
  const isBusy = state.status === 'confirming';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Stripe.js is loaded asynchronously; until it is, there is nothing to confirm.
    if (!stripe || !elements) {
      return;
    }

    setState({ status: 'confirming' });

    // Methods that need a bank's own page redirect and never come back here;
    // cards resolve inline, which is why the push below is still reachable.
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: new URL(returnPath, window.location.origin).toString(),
      },
      redirect: 'if_required',
    });

    if (result.error) {
      setState({
        status: 'error',
        message: result.error.message ?? t('paymentFailed'),
      });
      return;
    }

    router.push(confirmationPath);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ layout: 'tabs' }} />

      {state.status === 'error' ? (
        <p role="alert" className="text-danger text-sm">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={!stripe || isBusy} fullWidth>
        {isBusy
          ? t('paying')
          : t('pay', { amount: formatMoney(amount, locale, currency) })}
      </Button>

      <p className="text-ink-muted text-center text-xs">{t('paymentNote')}</p>
    </form>
  );
}
