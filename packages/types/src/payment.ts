import type { Currency, Money } from './common';

/** Request body of `POST /payments/intent`. */
export type CreatePaymentIntentRequest = {
  orderId: string;
};

/**
 * Response of `POST /payments/intent`. The client secret is what Stripe.js needs
 * to confirm the payment in the browser; the amount is echoed back so the
 * checkout can show what is actually being charged rather than trusting the cart.
 */
export type PaymentIntentDto = {
  clientSecret: string;
  amount: Money;
  /**
   * Normalised back to the shop's uppercase codes. The provider reports its own
   * lowercase ISO 4217 spelling; that spelling stops at the API boundary.
   */
  currency: Currency;
};
