import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { PaymentIntentDto } from '@imix/types';
import type { Request } from 'express';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly stripe: StripeService,
  ) {}

  @Post('intent')
  createIntent(@Body() dto: CreatePaymentIntentDto): Promise<PaymentIntentDto> {
    return this.payments.createIntent(dto.orderId);
  }

  /**
   * Stripe's callback. Authentication is the signature over the **raw** body,
   * which is why `main.ts` enables `rawBody` — re-serialising the parsed JSON
   * would change the bytes and every signature would fail.
   *
   * Answers 200 as soon as the event is applied; anything else makes Stripe
   * retry the delivery.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true }> {
    const payload = request.rawBody;

    if (!payload || !signature) {
      throw new BadRequestException('Missing Stripe signature or payload');
    }

    const event = this.verify(payload, signature);
    await this.payments.handleEvent(event);

    return { received: true };
  }

  private verify(payload: Buffer, signature: string) {
    try {
      return this.stripe.constructWebhookEvent(payload, signature);
    } catch (error) {
      // A missing webhook secret is our misconfiguration (503), a bad signature
      // is the caller's problem (400) — don't collapse the two.
      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadRequestException('Invalid Stripe signature');
    }
  }
}
