import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import type { AdminOrderDto, Paginated } from '@imix/types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FindAdminOrdersQueryDto } from '../orders/dto/find-admin-orders-query.dto';
import { UpdateOrderStatusDto } from '../orders/dto/update-order-status.dto';
import { OrdersService } from '../orders/orders.service';

/**
 * The order book.
 *
 * The logic lives in `OrdersService` rather than here or in a parallel admin
 * service: orders own their own rules, and the one thing that must never differ
 * between what a shopper sees on the confirmation page and what an admin sees in
 * the list is the amount and the currency beside it.
 */
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  findMany(
    @Query() query: FindAdminOrdersQueryDto,
  ): Promise<Paginated<AdminOrderDto>> {
    return this.orders.findForAdmin(query);
  }

  /**
   * Moves one order along. The locale rides in the query string because the
   * answer carries the order's lines, and those are written per language.
   */
  @Patch(':id')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Query() query: FindAdminOrdersQueryDto,
  ): Promise<AdminOrderDto> {
    return this.orders.updateStatus(id, dto.status, query.locale);
  }
}
