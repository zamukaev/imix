import { IsIn } from 'class-validator';
import {
  ORDER_STATUSES,
  type OrderStatus,
  type UpdateOrderStatusRequest,
} from '@imix/types';

/**
 * Body of `PATCH /admin/orders/:id`.
 *
 * Every status is accepted *here* and the service refuses the ones that are not
 * a legal move from where the order actually is. Validating the shape and
 * validating the transition are different jobs: the second one needs to know
 * the current status, which a DTO does not.
 */
export class UpdateOrderStatusDto implements UpdateOrderStatusRequest {
  @IsIn(ORDER_STATUSES, {
    message: `status must be one of: ${ORDER_STATUSES.join(', ')}`,
  })
  status!: OrderStatus;
}
