import { IsString, Matches } from 'class-validator';
import type { CreatePaymentIntentRequest } from '@imix/types';

const CUID_PATTERN = /^[a-z0-9]{20,32}$/;

/** Request body of `POST /payments/intent`. */
export class CreatePaymentIntentDto implements CreatePaymentIntentRequest {
  @IsString()
  @Matches(CUID_PATTERN, { message: 'orderId must be a valid id' })
  orderId!: string;
}
