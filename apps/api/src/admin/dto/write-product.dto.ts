import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { CreateProductRequest, ProductWriteRequest } from '@imix/types';
import {
  MAX_NAME_LENGTH,
  MAX_SLUG_LENGTH,
  OptionalText,
  SLUG_PATTERN,
  emptyToNull,
  slugified,
  trimmed,
} from './write-category.dto';
import { WriteColorDto } from './write-color.dto';
import { WriteVariantDto } from './write-variant.dto';

const CUID_PATTERN = /^[a-z0-9]{20,32}$/;

const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_BRAND_LENGTH = 60;
const MAX_ASSET_URL_LENGTH = 500;

/** One line under a name on a model card. Longer than this is a description. */
const MAX_TAGLINE_LENGTH = 120;

/** A gallery, not an archive. */
const MAX_IMAGES = 10;

/** One product cannot reasonably have more configurations than this. */
const MAX_VARIANTS = 40;

/** A swatch row that does not fit on a phone has stopped being a control. */
const MAX_COLORS = 12;

/**
 * Either a path this shop serves (`/products/x.jpg`) or an absolute http(s) URL
 * at whichever CDN the upload provider hands back. Anything else — a `javascript:`
 * URL above all — has no business in an `src` attribute on the storefront.
 */
const ASSET_URL_PATTERN = /^(?:\/[^\s]*|https:\/\/[^\s]+)$/;

const assetUrlMessage =
  'must be an absolute path on this shop or an https:// URL';

/** Body of `PATCH /admin/products/:id` — the product itself, not its variants. */
export class WriteProductDto implements ProductWriteRequest {
  @Transform(slugified)
  @IsString()
  @Length(1, MAX_SLUG_LENGTH)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase words joined by single hyphens',
  })
  slug!: string;

  // Four fields, two languages, none of them optional: a product described in
  // Russian alone is a product that is broken in half the shop.
  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  nameRu!: string;

  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  nameEn!: string;

  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_DESCRIPTION_LENGTH)
  descriptionRu!: string;

  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_DESCRIPTION_LENGTH)
  descriptionEn!: string;

  // Optional, but optional in *both* languages: a tagline written only in
  // Russian would leave the English model card a line shorter than its
  // neighbours. Nothing enforces the pair — the card simply drops the line.
  @OptionalText(MAX_TAGLINE_LENGTH)
  taglineRu?: string | null;

  @OptionalText(MAX_TAGLINE_LENGTH)
  taglineEn?: string | null;

  // Not translated — a manufacturer's name is the same in both catalogues.
  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_BRAND_LENGTH)
  brand!: string;

  @IsString()
  @Matches(CUID_PATTERN, { message: 'categoryId must be a valid id' })
  categoryId!: string;

  // Checked against the chosen category in the service: a pattern cannot know
  // whether this group belongs to that category, and one that does not would
  // put a model under a tab its page never renders.
  @Transform(emptyToNull)
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(CUID_PATTERN, { message: 'groupId must be a valid id' })
  groupId?: string | null;

  @IsArray()
  @ArrayMaxSize(MAX_IMAGES)
  @IsString({ each: true })
  @Length(1, MAX_ASSET_URL_LENGTH, { each: true })
  @Matches(ASSET_URL_PATTERN, { each: true, message: `each image ${assetUrlMessage}` })
  images!: string[];

  // The rail cutout. Same asset rule as an image, same "null means none".
  @Transform(emptyToNull)
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  @Length(1, MAX_ASSET_URL_LENGTH)
  @Matches(ASSET_URL_PATTERN, { message: `navImageUrl ${assetUrlMessage}` })
  navImageUrl?: string | null;

  @Transform(emptyToNull)
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  @Length(1, MAX_ASSET_URL_LENGTH)
  @Matches(ASSET_URL_PATTERN, { message: `model3dUrl ${assetUrlMessage}` })
  model3dUrl?: string | null;

  @IsBoolean()
  featured!: boolean;

  /**
   * The product's finishes, in the order sent — that order becomes `position`,
   * so the swatch row reads left to right the way the admin arranged it.
   *
   * The whole list every time. A colour missing from it is deleted, which is how
   * the variant list already behaves and keeps one product edit to one request.
   * Optional so a `PATCH` that only touches, say, `featured` does not have to
   * restate the colours; absent means "leave them alone", `[]` means "remove
   * them all".
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_COLORS)
  @ValidateNested({ each: true })
  @Type(() => WriteColorDto)
  colors?: WriteColorDto[];
}

/**
 * Body of `POST /admin/products`.
 *
 * The variants come with it rather than in a second request: a product's prices
 * are derived from them, so one created without any would sit in the catalogue
 * priced at zero until somebody remembered to come back.
 */
export class CreateProductDto extends WriteProductDto implements CreateProductRequest {
  @IsArray()
  @ArrayNotEmpty({ message: 'a product needs at least one variant' })
  @ArrayMaxSize(MAX_VARIANTS)
  @ValidateNested({ each: true })
  @Type(() => WriteVariantDto)
  variants!: WriteVariantDto[];
}
