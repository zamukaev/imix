import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches, ValidateIf } from 'class-validator';
import type { CategoryWriteRequest } from '@imix/types';

/**
 * Lowercase, digits and single hyphens. A slug is a URL, and one that differs
 * from its neighbours only by case is a second page for the same category.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const MAX_SLUG_LENGTH = 60;
export const MAX_NAME_LENGTH = 120;

export const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const slugified = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** An empty optional text field means "not set", not an empty string. */
export const emptyToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim().length === 0 ? null : trimmed({ value });

/**
 * Optional shopper-facing text, as it appears across the admin DTOs: a tile's
 * subhead, an image alt, a product's tagline. The four decorators are composed
 * once because they only work together. `ValidateIf` rather than `IsOptional`
 * so an explicit `null` is accepted as "clear this" while a wrong type is still
 * a 400 — absent, null and "" all arrive meaning the same thing.
 */
export const OptionalText = (max: number) =>
  applyDecorators(
    Transform(emptyToNull),
    ValidateIf((_object, value) => value !== null && value !== undefined),
    IsString(),
    Length(1, max),
  );

export class WriteCategoryDto implements CategoryWriteRequest {
  @Transform(slugified)
  @IsString()
  @Length(1, MAX_SLUG_LENGTH)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase words joined by single hyphens',
  })
  slug!: string;

  // Both languages, both required. A category named in one of them is a hole in
  // the navigation of the other.
  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  nameRu!: string;

  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  nameEn!: string;
}
