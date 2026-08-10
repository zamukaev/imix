import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CURRENCIES,
  MAX_ORDER_ITEM_QUANTITY,
  type CreateOrderItemDto,
  type CreateOrderRequest,
  type Currency,
  type ShippingAddressDto,
} from '@imix/types';

/** A cart that large is a script, not a shopper. */
export const MAX_ORDER_LINES = 20;

const CUID_PATTERN = /^[a-z0-9]{20,32}$/;
/** ISO 3166-1 alpha-2, e.g. "DE". */
const COUNTRY_PATTERN = /^[A-Z]{2}$/;

const MAX_NAME_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 200;
const MAX_CITY_LENGTH = 100;
const MAX_ZIP_LENGTH = 16;
const MAX_EMAIL_LENGTH = 254;

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ShippingAddressInputDto implements ShippingAddressDto {
  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  name!: string;

  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_ADDRESS_LENGTH)
  address!: string;

  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_CITY_LENGTH)
  city!: string;

  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_ZIP_LENGTH)
  zip!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(COUNTRY_PATTERN, {
    message: 'country must be an ISO 3166-1 alpha-2 code like "DE"',
  })
  country!: string;
}

export class CreateOrderItemInputDto implements CreateOrderItemDto {
  @IsString()
  @Matches(CUID_PATTERN, { message: 'variantId must be a valid id' })
  variantId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ORDER_ITEM_QUANTITY)
  quantity!: number;
}

/**
 * Request body of `POST /orders`.
 *
 * Note what is absent: no prices and no total. The client says *what* it wants,
 * the server decides what it costs (see `OrdersService.create`).
 */
export class CreateOrderDto implements CreateOrderRequest {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email must be a valid address' })
  @Length(1, MAX_EMAIL_LENGTH)
  email!: string;

  // Required, not defaulted: this decides which stored price column the server
  // charges from, and silently picking one would mean billing in a currency the
  // buyer never saw.
  @IsIn(CURRENCIES, {
    message: `currency must be one of: ${CURRENCIES.join(', ')}`,
  })
  currency!: Currency;

  // `@ValidateNested` alone skips a missing value, which would reach the service
  // as undefined — `@IsObject` is what turns an absent block into a 400.
  @IsObject({ message: 'shipping is required' })
  @ValidateNested()
  @Type(() => ShippingAddressInputDto)
  shipping!: ShippingAddressInputDto;

  @IsArray()
  @ArrayNotEmpty({ message: 'an order needs at least one item' })
  @ArrayMaxSize(MAX_ORDER_LINES)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemInputDto)
  items!: CreateOrderItemInputDto[];
}
