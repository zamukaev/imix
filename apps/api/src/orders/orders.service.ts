import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_LOCALE,
  type Locale,
  type Money,
  type OrderDto,
  type OrderItemDto,
} from '@imix/types';
import { Prisma } from '@prisma/client';
import { amount, text } from '../common/localisation';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrderDto,
  CreateOrderItemInputDto,
} from './dto/create-order.dto';

/**
 * Everything an order response needs. Product fields are joined through the
 * variant so a confirmation page renders without extra round trips.
 */
const orderSelect = {
  id: true,
  status: true,
  email: true,
  total: true,
  currency: true,
  createdAt: true,
  shippingName: true,
  shippingAddress: true,
  shippingCity: true,
  shippingZip: true,
  shippingCountry: true,
  items: {
    select: {
      id: true,
      variantId: true,
      quantity: true,
      priceAtPurchase: true,
      variant: {
        select: {
          sku: true,
          labelRu: true,
          labelEn: true,
          product: {
            select: { slug: true, nameRu: true, nameEn: true, images: true },
          },
        },
      },
    },
  },
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

/** A line after the server has priced it — the client never supplies a price. */
type PricedLine = {
  variantId: string;
  quantity: number;
  unitPrice: Money;
};

/**
 * The one refusal a shopper is expected to see and act on, so it is written in
 * their language. Everything else `POST /orders` rejects is a malformed request
 * — those stay in English for whoever is reading the logs.
 */
const OUT_OF_STOCK_MESSAGE: Record<Locale, (labels: string) => string> = {
  ru: (labels) =>
    `Нет в наличии: ${labels}. Измените количество и попробуйте снова.`,
  en: (labels) =>
    `Out of stock: ${labels}. Adjust the quantities and try again.`,
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a PENDING order. The request carries only variant ids, quantities
   * and a currency; prices come from the database, so a tampered cart cannot
   * buy a phone for a kopeck.
   *
   * The currency picks which stored price column is used and is then frozen on
   * the order: switching the storefront to the other currency afterwards must
   * not restate what was charged.
   *
   * Stock is *checked* here but not yet decremented — it is reserved when the
   * payment webhook confirms payment (see `PaymentsService.handleEvent`), so an
   * abandoned checkout never holds inventory hostage.
   */
  async create(
    dto: CreateOrderDto,
    locale: Locale = DEFAULT_LOCALE,
    userId?: string,
  ): Promise<OrderDto> {
    const quantities = mergeQuantities(dto.items);

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: [...quantities.keys()] } },
      select: {
        id: true,
        priceRub: true,
        priceUsd: true,
        stock: true,
        labelRu: true,
        labelEn: true,
      },
    });
    const byId = new Map(variants.map((variant) => [variant.id, variant]));

    const unknown: string[] = [];
    const understocked: string[] = [];
    const lines: PricedLine[] = [];

    for (const [variantId, quantity] of quantities) {
      const variant = byId.get(variantId);

      if (!variant) {
        unknown.push(variantId);
      } else if (variant.stock < quantity) {
        understocked.push(text(locale, { ru: variant.labelRu, en: variant.labelEn }));
      } else {
        lines.push({
          variantId,
          quantity,
          unitPrice: amount(dto.currency, {
            RUB: variant.priceRub,
            USD: variant.priceUsd,
          }),
        });
      }
    }

    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown variant${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`,
      );
    }

    if (understocked.length > 0) {
      throw new ConflictException(
        OUT_OF_STOCK_MESSAGE[locale](understocked.join(', ')),
      );
    }

    const order = await this.prisma.order.create({
      data: {
        // Null for a guest. `email` stays the owner reference either way, so a
        // confirmation link keeps working whether or not anybody signed in.
        userId: userId ?? null,
        email: dto.email,
        total: subtotal(lines),
        currency: dto.currency,
        shippingName: dto.shipping.name,
        shippingAddress: dto.shipping.address,
        shippingCity: dto.shipping.city,
        shippingZip: dto.shipping.zip,
        shippingCountry: dto.shipping.country,
        items: {
          create: lines.map((line) => ({
            variantId: line.variantId,
            quantity: line.quantity,
            priceAtPurchase: line.unitPrice,
          })),
        },
      },
      select: orderSelect,
    });

    return toOrderDto(order, locale);
  }

  /**
   * Every order placed while signed in, newest first. Guest orders the same
   * person made before signing in are not here — they carry no `userId`, and
   * matching on email would hand somebody else's history to anyone who
   * registers with an address they used at checkout.
   */
  async findByUser(
    userId: string,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<OrderDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: orderSelect,
    });

    return orders.map((order) => toOrderDto(order, locale));
  }

  async findById(id: string, locale: Locale = DEFAULT_LOCALE): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: orderSelect,
    });

    if (!order) {
      throw new NotFoundException(`No order with id "${id}"`);
    }

    return toOrderDto(order, locale);
  }
}

/**
 * Collapses repeated variants into one line. A client that sends the same
 * variant twice gets one line with the summed quantity rather than two lines
 * that each pass the stock check on their own.
 */
function mergeQuantities(
  items: readonly CreateOrderItemInputDto[],
): Map<string, number> {
  const quantities = new Map<string, number>();

  for (const item of items) {
    const current = quantities.get(item.variantId) ?? 0;
    quantities.set(item.variantId, current + item.quantity);
  }

  return quantities;
}

function subtotal(lines: readonly PricedLine[]): Money {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

/** Maps a Prisma row onto the public DTO so DB columns never leak by accident. */
function toOrderDto(order: OrderRow, locale: Locale): OrderDto {
  return {
    id: order.id,
    status: order.status,
    email: order.email,
    total: order.total,
    currency: order.currency,
    shipping: {
      name: order.shippingName,
      address: order.shippingAddress,
      city: order.shippingCity,
      zip: order.shippingZip,
      country: order.shippingCountry,
    },
    items: order.items.map((item) => toOrderItemDto(item, locale)),
    createdAt: order.createdAt.toISOString(),
  };
}

/**
 * Product text is resolved at read time, so an order placed in Russian reads
 * back in English for a shopper who switched language. `priceAtPurchase` is not
 * touched: it is the frozen snapshot, in the order's own currency.
 */
function toOrderItemDto(
  item: OrderRow['items'][number],
  locale: Locale,
): OrderItemDto {
  return {
    id: item.id,
    variantId: item.variantId,
    sku: item.variant.sku,
    productSlug: item.variant.product.slug,
    productName: text(locale, {
      ru: item.variant.product.nameRu,
      en: item.variant.product.nameEn,
    }),
    variantLabel: text(locale, {
      ru: item.variant.labelRu,
      en: item.variant.labelEn,
    }),
    image: item.variant.product.images[0] ?? null,
    quantity: item.quantity,
    priceAtPurchase: item.priceAtPurchase,
  };
}
