'use client';

import { useActionState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, type Appearance } from '@stripe/stripe-js';
import type { Currency, Money } from '@imix/types';
import { CheckoutPaymentStep } from '@/components/checkout-payment-step';
import { CheckoutShippingForm } from '@/components/checkout-shipping-form';
import { CheckoutSummary } from '@/components/checkout-summary';
import { useRequestContext } from '@/components/currency-provider';
import { Link } from '@/i18n/navigation';
import { createPaymentIntent, placeOrder, toUserMessage } from '@/lib/api';
import {
  EMPTY_SHIPPING_FORM,
  buildOrderRequest,
  parseShippingForm,
  readShippingForm,
  type ShippingFieldErrors,
  type ShippingFormRaw,
  type ValidationMessages,
} from '@/lib/checkout';
import { useCartStore } from '@/stores/cart-store';

/**
 * Stripe.js is fetched once per page load, not per render — `loadStripe` is
 * called at module scope on purpose. Without a key there is nothing to load and
 * the page says so instead of failing at confirmation time.
 */
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

/** Keeps the Stripe iframe from looking like a foreign object on the page. */
const appearance: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#0b0b0f',
    colorBackground: '#ffffff',
    colorText: '#0b0b0f',
    colorDanger: '#d93025',
    borderRadius: '12px',
    spacingUnit: '4px',
  },
};

/** Shipping first, then payment — the order exists from the moment step two does. */
type CheckoutState =
  | {
      step: 'shipping';
      values: ShippingFormRaw;
      fieldErrors: ShippingFieldErrors;
      formError: string | null;
    }
  | {
      step: 'payment';
      orderId: string;
      clientSecret: string;
      amount: Money;
      currency: Currency;
    };

const INITIAL_STATE: CheckoutState = {
  step: 'shipping',
  values: EMPTY_SHIPPING_FORM,
  fieldErrors: {},
  formError: null,
};

export default function CheckoutPage() {
  const t = useTranslations('checkout');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const { currency } = useRequestContext();
  const lines = useCartStore((state) => state.lines);
  const hasHydrated = useCartStore((state) => state.hasHydrated);

  const [state, submitShipping, isPending] = useActionState<CheckoutState, FormData>(
    async (_previous, formData) => {
      const values = readShippingForm(formData);
      const parsed = parseShippingForm(values, toValidationMessages(tValidation));

      if (!parsed.ok) {
        return { step: 'shipping', values, fieldErrors: parsed.fieldErrors, formError: null };
      }

      if (lines.length === 0) {
        return {
          step: 'shipping',
          values,
          fieldErrors: {},
          formError: t('cartBecameEmpty'),
        };
      }

      try {
        // The order is priced and stored before Stripe is involved, so the
        // amount being charged is always one the server decided on — in the
        // currency the shopper has been browsing in.
        //
        // It goes through this app's own `/api/orders` rather than straight to
        // the API: same-origin, so the session cookie comes along and a
        // signed-in buyer ends up on the order. A guest posts the same body and
        // nothing about the flow changes.
        const order = await placeOrder(
          buildOrderRequest(parsed.values, lines, currency),
        );
        const intent = await createPaymentIntent(order.id);

        return {
          step: 'payment',
          orderId: order.id,
          clientSecret: intent.clientSecret,
          amount: intent.amount,
          currency: intent.currency,
        };
      } catch (error) {
        return {
          step: 'shipping',
          values,
          fieldErrors: {},
          formError: toUserMessage(error, tErrors('fallback')),
        };
      }
    },
    INITIAL_STATE,
  );

  if (!hasHydrated) {
    return <CheckoutShell title={t('title')} />;
  }

  if (lines.length === 0 && state.step === 'shipping') {
    return (
      <CheckoutShell title={t('title')}>
        <div className="py-16 text-center">
          <p className="text-ink-muted">{t('emptyCart')}</p>
          <Link href="/" className="text-brand mt-4 inline-block text-sm hover:underline">
            {t('continueBrowsing')}
          </Link>
        </div>
      </CheckoutShell>
    );
  }

  return (
    <CheckoutShell title={t('title')}>
      <CheckoutSteps current={state.step} />

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div>
          {state.step === 'shipping' ? (
            <CheckoutShippingForm
              action={submitShipping}
              defaults={state.values}
              fieldErrors={state.fieldErrors}
              formError={state.formError}
              isPending={isPending}
              disabledReason={stripePromise ? null : t('unconfigured')}
            />
          ) : stripePromise ? (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret: state.clientSecret, appearance }}
            >
              <CheckoutPaymentStep
                orderId={state.orderId}
                amount={state.amount}
                currency={state.currency}
              />
            </Elements>
          ) : null}
        </div>

        <CheckoutSummary lines={lines} />
      </div>
    </CheckoutShell>
  );
}

/**
 * Lifts the `validation` namespace into the plain object the schema takes, so
 * `checkout.ts` stays free of React and of next-intl.
 */
function toValidationMessages(
  t: ReturnType<typeof useTranslations<'validation'>>,
): ValidationMessages {
  return {
    email: t('email'),
    name: t('name'),
    nameTooLong: t('nameTooLong'),
    address: t('address'),
    addressTooLong: t('addressTooLong'),
    city: t('city'),
    cityTooLong: t('cityTooLong'),
    zip: t('zip'),
    zipTooLong: t('zipTooLong'),
    country: t('country'),
  };
}

/**
 * Checkout really is a sequence, so numbering it tells the shopper how much is
 * left rather than decorating the page.
 */
function CheckoutSteps({ current }: { current: CheckoutState['step'] }) {
  const t = useTranslations('checkout');
  const steps = [
    { id: 'shipping', label: t('stepShipping') },
    { id: 'payment', label: t('stepPayment') },
  ] as const;

  return (
    <ol className="text-ink-muted mt-6 flex gap-6 text-xs tracking-widest uppercase">
      {steps.map((step, index) => {
        const isCurrent = step.id === current;

        return (
          <li
            key={step.id}
            aria-current={isCurrent ? 'step' : undefined}
            className={isCurrent ? 'text-ink' : undefined}
          >
            <span aria-hidden="true" className="mr-2">
              {index + 1}
            </span>
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

function CheckoutShell({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      {children}
    </main>
  );
}
