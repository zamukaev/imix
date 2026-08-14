import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsString, Length, Matches } from 'class-validator';
import {
  HOME_TILE_SURFACES,
  HOME_TILE_WIDTHS,
  TILE_MOVE_DIRECTIONS,
  type HomeTileSurface,
  type HomeTileWidth,
  type HomeTileWriteRequest,
  type MoveHomeTileRequest,
  type TileMoveDirection,
} from '@imix/types';
import { OptionalText, SLUG_PATTERN, slugified, trimmed } from './write-category.dto';

const MAX_KEY_LENGTH = 60;
const MAX_HEADLINE_LENGTH = 120;
const MAX_SUBHEAD_LENGTH = 240;
const MAX_LABEL_LENGTH = 40;
const MAX_URL_LENGTH = 500;

/**
 * Same rule as a product image: a path this shop serves, or an https:// URL at
 * the asset provider. Never `javascript:`, never plain http.
 */
const IMAGE_URL_PATTERN = /^(?:\/[^\s]*|https:\/\/[^\s]+)$/;

export class WriteHomeTileDto implements HomeTileWriteRequest {
  /**
   * The stable handle. Slug-shaped for the same reason a category's is: it ends
   * up in a seed file and in migrations, where a space is a nuisance forever.
   */
  @Transform(slugified)
  @IsString()
  @Length(1, MAX_KEY_LENGTH)
  @Matches(SLUG_PATTERN, {
    message: 'key must be lowercase words joined by single hyphens',
  })
  key!: string;

  @IsBoolean()
  published!: boolean;

  @IsIn(HOME_TILE_WIDTHS, {
    message: `width must be one of: ${HOME_TILE_WIDTHS.join(', ')}`,
  })
  width!: HomeTileWidth;

  @IsIn(HOME_TILE_SURFACES, {
    message: `surface must be one of: ${HOME_TILE_SURFACES.join(', ')}`,
  })
  surface!: HomeTileSurface;

  // Both languages, both required. A tile with one headline is a hole in the
  // shop window of the other language.
  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_HEADLINE_LENGTH)
  headlineRu!: string;

  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_HEADLINE_LENGTH)
  headlineEn!: string;

  @OptionalText(MAX_SUBHEAD_LENGTH)
  subheadRu?: string | null;

  @OptionalText(MAX_SUBHEAD_LENGTH)
  subheadEn?: string | null;

  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_URL_LENGTH)
  @Matches(IMAGE_URL_PATTERN, {
    message: 'imageUrl must be a path on this shop or an https:// URL',
  })
  imageUrl!: string;

  // Null is not a missing alt, it is a *decorative* image — the common case,
  // because the headline already names the device.
  @OptionalText(MAX_SUBHEAD_LENGTH)
  imageAltRu?: string | null;

  @OptionalText(MAX_SUBHEAD_LENGTH)
  imageAltEn?: string | null;

  @OptionalText(MAX_LABEL_LENGTH)
  primaryLabelRu?: string | null;

  @OptionalText(MAX_LABEL_LENGTH)
  primaryLabelEn?: string | null;

  // The path itself is checked against the real catalogue in the service — a
  // pattern cannot know whether `/phones` is a page this shop has.
  @OptionalText(MAX_URL_LENGTH)
  primaryHref?: string | null;

  @OptionalText(MAX_LABEL_LENGTH)
  secondaryLabelRu?: string | null;

  @OptionalText(MAX_LABEL_LENGTH)
  secondaryLabelEn?: string | null;

  @OptionalText(MAX_URL_LENGTH)
  secondaryHref?: string | null;
}

export class MoveHomeTileDto implements MoveHomeTileRequest {
  @IsIn(TILE_MOVE_DIRECTIONS, {
    message: `direction must be one of: ${TILE_MOVE_DIRECTIONS.join(', ')}`,
  })
  direction!: TileMoveDirection;
}
