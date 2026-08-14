import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { MAX_PRODUCT_PAGE_SIZE, type ProductListQuery } from '@imix/types';
import { PricedQueryDto } from '../../common/dto/localised-query.dto';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 12;
/** The API's own cap, shared with anyone who has to page through the lot. */
export const MAX_PAGE_SIZE = MAX_PRODUCT_PAGE_SIZE;

/** Slugs are lowercase, digits and single hyphens — anything else is rejected. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Query string of `GET /products`. The global ValidationPipe runs with
 * `whitelist` and `forbidNonWhitelisted`, so anything not declared here is a
 * 400 rather than silently ignored.
 */
export class FindProductsQueryDto
  extends PricedQueryDto
  implements ProductListQuery
{
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'category must be a slug like "phones"' })
  category?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'featured must be "true" or "false"' })
  featured?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number = DEFAULT_PAGE_SIZE;
}
