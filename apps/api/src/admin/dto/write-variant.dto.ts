import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import type { VariantWriteRequest } from '@imix/types';
import {
  MAX_NAME_LENGTH,
  MAX_SLUG_LENGTH,
  SLUG_PATTERN,
  trimmed,
} from './write-category.dto';

/** Uppercase, digits and hyphens — a SKU is read aloud and typed into a search. */
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

const MAX_SKU_LENGTH = 64;
const MAX_CONFIG_LENGTH = 60;

/**
 * Prices are integer minor units, so this is 10 000 000,00 in either currency.
 * Not a business rule — a guard against a misplaced decimal point becoming a
 * price nobody notices until an order arrives.
 */
const MAX_PRICE_MINOR_UNITS = 1_000_000_000;

/** Enough for a warehouse, small enough that a typo in a quantity shows up. */
const MAX_STOCK = 100_000;

const upperCased = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** An empty optional text field means "not set", not an empty string. */
const emptyToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim().length === 0 ? null : trimmed({ value });

export class WriteVariantDto implements VariantWriteRequest {
  @Transform(upperCased)
  @IsString()
  @Length(1, MAX_SKU_LENGTH)
  @Matches(SKU_PATTERN, {
    message: 'sku must be uppercase letters, digits and hyphens',
  })
  sku!: string;

  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  labelRu!: string;

  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  labelEn!: string;

  // `ValidateIf` rather than `IsOptional`, so an explicit null is accepted as
  // "clear this" while a wrong type is still a 400.
  //
  // A colour's slug rather than its id: the request that creates a product's
  // colours is the same one that creates its variants, so no id exists yet on
  // the client. The service resolves it against the colours in the same body and
  // rejects one that names a colour the product does not have.
  @Transform(emptyToNull)
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  @Length(1, MAX_SLUG_LENGTH)
  @Matches(SLUG_PATTERN, {
    message: 'colorSlug must be lowercase words joined by single hyphens',
  })
  colorSlug?: string | null;

  @Transform(emptyToNull)
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  @Length(1, MAX_CONFIG_LENGTH)
  config?: string | null;

  // Both prices, both required. There is no exchange rate in this system, so a
  // variant priced in roubles only is a variant that cannot be sold in dollars —
  // and silently defaulting one from the other is exactly the guess the whole
  // two-column design exists to avoid.
  @Type(() => Number)
  @IsInt({ message: 'priceRub must be an integer number of kopecks' })
  @Min(0)
  @Max(MAX_PRICE_MINOR_UNITS)
  priceRub!: number;

  @Type(() => Number)
  @IsInt({ message: 'priceUsd must be an integer number of cents' })
  @Min(0)
  @Max(MAX_PRICE_MINOR_UNITS)
  priceUsd!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  stock!: number;
}

/**
 * Same shape, every field optional — a stock correction should not have to
 * restate the labels and prices it is not touching.
 */
export class PatchVariantDto implements Partial<VariantWriteRequest> {
  @IsOptional()
  @Transform(upperCased)
  @IsString()
  @Length(1, MAX_SKU_LENGTH)
  @Matches(SKU_PATTERN, {
    message: 'sku must be uppercase letters, digits and hyphens',
  })
  sku?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  labelRu?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  labelEn?: string;

  @Transform(emptyToNull)
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  @Length(1, MAX_SLUG_LENGTH)
  @Matches(SLUG_PATTERN, {
    message: 'colorSlug must be lowercase words joined by single hyphens',
  })
  colorSlug?: string | null;

  @Transform(emptyToNull)
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  @Length(1, MAX_CONFIG_LENGTH)
  config?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_MINOR_UNITS)
  priceRub?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_MINOR_UNITS)
  priceUsd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  stock?: number;
}
