import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { AccessTokenPayload, OrderDto } from '@imix/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
} from '../auth/guards/jwt-auth.guard';
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
   *
   * Guarded *optionally*: guest checkout is a first-class flow and stays exactly
   * as it was. A signed-in shopper additionally gets `userId` on the order, so
   * it can later show up under their account.
   */
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  create(
    @Body() dto: CreateOrderDto,
    @Query() query: LocalisedQueryDto,
    @CurrentUser() user?: AccessTokenPayload,
  ): Promise<OrderDto> {
    return this.orders.create(dto, query.locale, user?.sub);
  }

  /**
   * The signed-in shopper's own orders, newest first. Declared before `:id` so
   * the literal path wins — otherwise "me" would be read as an order id.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(
    @Query() query: LocalisedQueryDto,
    @CurrentUser() user?: AccessTokenPayload,
  ): Promise<OrderDto[]> {
    // Always set behind JwtAuthGuard; the optional type is what lets the same
    // decorator also serve a public route.
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }

    return this.orders.findByUser(user.sub, query.locale);
  }

  /**
   * Reading an order needs only its id, which is an unguessable cuid handed to
   * the buyer at checkout. It stays that way on purpose: the confirmation link
   * has to work for a guest, who by definition has no session.
   */
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query() query: LocalisedQueryDto,
  ): Promise<OrderDto> {
    return this.orders.findById(id, query.locale);
  }
}
