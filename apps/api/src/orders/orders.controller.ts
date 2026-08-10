import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { OrderDto } from '@imix/types';
import { LocalisedQueryDto } from '../common/dto/localised-query.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * The currency lives in the body — it is part of what is being bought. The
   * locale stays in the query string: it only decides which language the
   * response is written in.
   */
  @Post()
  create(
    @Body() dto: CreateOrderDto,
    @Query() query: LocalisedQueryDto,
  ): Promise<OrderDto> {
    return this.orders.create(dto, query.locale);
  }

  /**
   * Reading an order needs only its id, which is an unguessable cuid handed to
   * the buyer at checkout — the confirmation page has no session to
   * authenticate against yet. When auth lands, this gets a guard that also
   * accepts the owning user.
   */
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query() query: LocalisedQueryDto,
  ): Promise<OrderDto> {
    return this.orders.findById(id, query.locale);
  }
}
