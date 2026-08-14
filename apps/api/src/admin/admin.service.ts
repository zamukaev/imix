import { Injectable } from '@nestjs/common';
import {
  CURRENCIES,
  type AdminRevenueDto,
  type AdminStatsDto,
  type OrderStatus,
} from '@imix/types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The statuses whose money the shop has actually taken.
 *
 * PENDING is a checkout somebody may still abandon, FAILED and CANCELLED are
 * money that never moved. Counting any of them as revenue would make the
 * dashboard disagree with the bank.
 */
const REVENUE_STATUSES: readonly OrderStatus[] = ['PAID', 'SHIPPED'];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The numbers behind the admin dashboard.
   *
   * Deliberately not localised and not priced in one currency: this is not a
   * shopper-facing read. Text does not appear at all, and money appears once
   * per currency it was charged in.
   */
  async stats(): Promise<AdminStatsDto> {
    const [
      categories,
      products,
      variants,
      outOfStockVariants,
      orders,
      statusGroups,
      revenueGroups,
    ] = await Promise.all([
      this.prisma.category.count(),
      this.prisma.product.count(),
      this.prisma.productVariant.count(),
      this.prisma.productVariant.count({ where: { stock: 0 } }),
      this.prisma.order.count(),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.groupBy({
        by: ['currency'],
        where: { status: { in: [...REVENUE_STATUSES] } },
        _sum: { total: true },
        _count: { _all: true },
      }),
    ]);

    const counted = new Map(
      statusGroups.map((group) => [group.status, group._count._all]),
    );
    const earned = new Map(
      revenueGroups.map((group) => [
        group.currency,
        { total: group._sum.total ?? 0, orders: group._count._all },
      ]),
    );

    return {
      catalogue: { categories, products, variants, outOfStockVariants },
      orders: {
        total: orders,
        // Written out rather than folded from `ORDER_STATUSES`: every status is
        // zero-filled ("nothing has shipped yet" is a fact worth stating, not a
        // gap to leave), and spelling them out means adding one to the enum
        // fails to compile here instead of silently reporting nothing.
        byStatus: {
          PENDING: counted.get('PENDING') ?? 0,
          PAID: counted.get('PAID') ?? 0,
          FAILED: counted.get('FAILED') ?? 0,
          SHIPPED: counted.get('SHIPPED') ?? 0,
          CANCELLED: counted.get('CANCELLED') ?? 0,
        },
      },
      revenue: CURRENCIES.map(
        (currency): AdminRevenueDto => ({
          currency,
          ...(earned.get(currency) ?? { total: 0, orders: 0 }),
        }),
      ),
    };
  }
}
