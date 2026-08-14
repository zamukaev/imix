import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ORDER_STATUSES, type AdminOrderListQuery, type OrderStatus } from '@imix/types';
import { LocalisedQueryDto } from '../../common/dto/localised-query.dto';

export const DEFAULT_ADMIN_PAGE = 1;

/** A screenful of orders. The admin scans this list, it does not read it. */
export const DEFAULT_ADMIN_PAGE_SIZE = 25;

const MAX_ADMIN_PAGE_SIZE = 100;

/**
 * Accepted query string of `GET /admin/orders`.
 *
 * The locale is inherited because the lines carry product names, and those are
 * stored per language — an order book in the wrong one is unreadable.
 */
export class FindAdminOrdersQueryDto
  extends LocalisedQueryDto
  implements AdminOrderListQuery
{
  @IsOptional()
  @IsIn(ORDER_STATUSES, {
    message: `status must be one of: ${ORDER_STATUSES.join(', ')}`,
  })
  status?: OrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ADMIN_PAGE_SIZE)
  pageSize?: number;
}
