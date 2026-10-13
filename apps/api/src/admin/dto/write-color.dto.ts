import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, Length, Matches } from 'class-validator';
import type { ColorWriteRequest } from '@imix/types';
import {
  MAX_NAME_LENGTH,
  MAX_SLUG_LENGTH,
  SLUG_PATTERN,
  slugified,
  trimmed,
} from './write-category.dto';

/**
 * `#rrggbb`, lowercase. Three-digit shorthand is rejected rather than expanded:
 * the swatch is the only thing telling a shopper what "Lavender" looks like, and
 * two spellings of one colour in the database is a difference nobody can see and
 * everybody has to handle.
 */
const HEX_PATTERN = /^#[0-9a-f]{6}$/;

/** A finish has a handful of photographs, not a shoot. */
const MAX_COLOR_IMAGES = 8;

const MAX_ASSET_URL_LENGTH = 500;

const ASSET_URL_PATTERN = /^(?:\/[^\s]*|https:\/\/[^\s]+)$/;

const lowerCased = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** One finish of a product, as `POST`/`PATCH /admin/products` carries it. */
export class WriteColorDto implements ColorWriteRequest {
  // The handle a variant points at, so it is slugified on the way in for the
  // same reason a category's is: an admin typing "Sky Blue" means `sky-blue`.
  @Transform(slugified)
  @IsString()
  @Length(1, MAX_SLUG_LENGTH)
  @Matches(SLUG_PATTERN, {
    message: 'colour slug must be lowercase words joined by single hyphens',
  })
  slug!: string;

  // Both languages required. A colour name is shopper-facing text under the
  // swatch, and CLAUDE.md does not allow one of them to be missing.
  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  nameRu!: string;

  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  nameEn!: string;

  @Transform(lowerCased)
  @IsString()
  @Matches(HEX_PATTERN, { message: 'hex must be #rrggbb' })
  hex!: string;

  @IsArray()
  @ArrayMaxSize(MAX_COLOR_IMAGES)
  @IsString({ each: true })
  @Length(1, MAX_ASSET_URL_LENGTH, { each: true })
  @Matches(ASSET_URL_PATTERN, {
    each: true,
    message:
      'each colour image must be an absolute path on this shop or an https:// URL',
  })
  images!: string[];
}
