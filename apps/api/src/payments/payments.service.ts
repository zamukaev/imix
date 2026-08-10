import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Currency, PaymentIntentDto } from '@imix/types';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';

/**
 * Intent states that can still be paid, so the checkout may hand the same
 * client secret back out instead of opening a second charge on the order.
 */
const REUSABLE_INTENT_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'processing',
]);

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  /**
   * Returns the client secret the browser needs to confirm payment for an order.
   * Both the amount *and* the currency come from the stored order, never from
   * the request, so the charge always matches what the server priced.
   */
  async createIntent(orderId: string): Promise<PaymentIntentDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        email: true,
        total: true,
        currency: true,
        status: true,
        stripePaymentIntentId: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`No order with id "${orderId}"`);
    }

    if (order.status !== 'PENDING') {
      throw new ConflictException(
        `Order "${order.id}" is ${order.status.toLowerCase()} and no longer awaiting payment.`,
      );
    }

    const reused = order.stripePaymentIntentId
      ? await this.retrieveReusableIntent(order.stripePaymentIntentId)
      : null;

    if (reused) {
      return toPaymentIntentDto(reused, order.currency);
    }

    const intent = await this.stripe.client.paymentIntents.create({
      amount: order.total,
      // Providers speak lowercase ISO 4217; the shop's uppercase codes are
      // restored on the way out, so that spelling never reaches the storefront.
      currency: order.currency.toLowerCase(),
      receipt_email: order.email,
      // The only link back from Stripe to us if a webhook arrives before the
      // id below is stored.
      metadata: { orderId: order.id },
      automatic_payment_methods: { enabled: true },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: intent.id },
    });

    return toPaymentIntentDto(intent, order.currency);
  }

  /**
   * Applies a signed Stripe event. Deliveries are retried and can arrive out of
   * order, so every branch has to be safe to run twice.
   */
  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.markPaid(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await this.markFailed(event.data.object);
        break;

      default:
        this.logger.debug(`Ignoring Stripe event ${event.type}`);
    }
  }

  private async retrieveReusableIntent(
    intentId: string,
  ): Promise<Stripe.PaymentIntent | null> {
    const intent = await this.stripe.client.paymentIntents.retrieve(intentId);

    return REUSABLE_INTENT_STATUSES.has(intent.status) ? intent : null;
  }

  /**
   * Moves PENDING → PAID and reserves the stock, in one transaction.
   *
   * The status change doubles as the lock: `updateMany` with a PENDING filter
   * either claims the order or reports zero rows, which is how a redelivered
   * event is recognised and dropped without decrementing stock twice.
   */
  private async markPaid(intent: Stripe.PaymentIntent): Promise<void> {
    const order = await this.findOrderForIntent(intent);

    if (!order) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: { status: 'PAID' },
      });

      if (claimed.count === 0) {
        this.logger.log(
          `Order ${order.id} was already settled — event ignored`,
        );
        return;
      }

      const items = await tx.orderItem.findMany({
        where: { orderId: order.id },
        select: { variantId: true, quantity: true },
      });

      for (const item of items) {
        const reserved = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });

        // Stock is only checked when the order is placed, so a variant can sell
        // out in between. The payment stands — refusing it here would take the
        // money without recording the sale — but stock never goes negative and
        // the line is flagged for a human.
        if (reserved.count === 0) {
          this.logger.error(
            `Order ${order.id} oversold variant ${item.variantId} (x${item.quantity}) — needs manual fulfilment`,
          );
        }
      }

      this.logger.log(`Order ${order.id} paid`);
    });
  }

  private async markFailed(intent: Stripe.PaymentIntent): Promise<void> {
    const order = await this.findOrderForIntent(intent);

    if (!order) {
      return;
    }

    // Only a pending order may fail: a paid one that later reports a failure is
    // a stale delivery, and its stock has already been reserved.
    const updated = await this.prisma.order.updateMany({
      where: { id: order.id, status: 'PENDING' },
      data: { status: 'FAILED' },
    });

    if (updated.count > 0) {
      this.logger.warn(
        `Order ${order.id} failed: ${intent.last_payment_error?.message ?? 'no reason given'}`,
      );
    }
  }

  /**
   * Finds the order an intent belongs to, by stored id or — if the webhook won
   * the race against `createIntent` writing that id — by the metadata we set
   * when the intent was created.
   */
  private async findOrderForIntent(
    intent: Stripe.PaymentIntent,
  ): Promise<{ id: string } | null> {
    const orderId = intent.metadata?.orderId;

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { stripePaymentIntentId: intent.id },
          ...(orderId ? [{ id: orderId }] : []),
        ],
      },
      select: { id: true },
    });

    if (!order) {
      this.logger.warn(`No order matches payment intent ${intent.id}`);
    }

    return order;
  }
}

/**
 * `currency` is the order's own, not the provider's echo: passing it through
 * keeps the DTO on the shop's uppercase codes without casting a loose string
 * back into the union.
 */
function toPaymentIntentDto(
  intent: Stripe.PaymentIntent,
  currency: Currency,
): PaymentIntentDto {
  if (!intent.client_secret) {
    throw new InternalServerErrorException(
      `Stripe returned payment intent ${intent.id} without a client secret`,
    );
  }

  return {
    clientSecret: intent.client_secret,
    amount: intent.amount,
    currency,
  };
}
