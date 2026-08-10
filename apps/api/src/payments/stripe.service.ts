import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';

/**
 * Owns the Stripe SDK client and the two secrets it needs.
 *
 * Stripe keys are optional so the storefront still boots for someone who only
 * wants to browse the catalogue — the failure surfaces as a 503 on the payment
 * endpoints instead of a crash at startup.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string | undefined;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    this.stripe = secretKey ? new Stripe(secretKey) : null;

    if (!this.stripe) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not set — payment endpoints will answer 503.',
      );
    }
  }

  /** The SDK client, or a 503 explaining which variable is missing. */
  get client(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Payments are not configured on this server (STRIPE_SECRET_KEY missing).',
      );
    }

    return this.stripe;
  }

  /**
   * Verifies a webhook against its signature. An unsigned or mis-signed request
   * throws, which the controller turns into a 400 — never trust the payload
   * before this has run.
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException(
        'Webhooks are not configured on this server (STRIPE_WEBHOOK_SECRET missing).',
      );
    }

    return this.client.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );
  }
}
