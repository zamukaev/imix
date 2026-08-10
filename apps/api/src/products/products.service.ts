import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  type Currency,
  type Locale,
  type Paginated,
  type ProductDetailDto,
  type ProductListItemDto,
  type ProductVariantDto,
} from '@imix/types';
import { Prisma } from '@prisma/client';
import { amount, priceColumn, text } from '../common/localisation';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  FindProductsQueryDto,
} from './dto/find-products-query.dto';

/**
 * Columns a catalogue grid needs — deliberately not the descriptions.
 *
 * Both translations and both prices are selected and one of each is chosen in
 * the mappers below. The alternative, building the column list per request,
 * would trade a few bytes on the wire for a `Prisma.ProductSelect` that no
 * longer type-checks.
 */
const listSelect = {
  id: true,
  slug: true,
  nameRu: true,
  nameEn: true,
  brand: true,
  basePriceRub: true,
  basePriceUsd: true,
  images: true,
  featured: true,
  category: { select: { slug: true, nameRu: true, nameEn: true } },
} satisfies Prisma.ProductSelect;

const variantSelect = {
  id: true,
  sku: true,
  labelRu: true,
  labelEn: true,
  color: true,
  config: true,
  priceRub: true,
  priceUsd: true,
  stock: true,
} satisfies Prisma.ProductVariantSelect;

type ProductListRow = Prisma.ProductGetPayload<{ select: typeof listSelect }>;
type ProductVariantRow = Prisma.ProductVariantGetPayload<{
  select: typeof variantSelect;
}>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    query: FindProductsQueryDto,
  ): Promise<Paginated<ProductListItemDto>> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const locale = query.locale ?? DEFAULT_LOCALE;
    const currency = query.currency ?? DEFAULT_CURRENCY;

    const where: Prisma.ProductWhereInput = {
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.featured === undefined ? {} : { featured: query.featured }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: listSelect,
        orderBy: [{ featured: 'desc' }, { createdAt: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((item) => toListItem(item, locale, currency)),
      page,
      pageSize,
      total,
    };
  }

  async findBySlug(
    slug: string,
    locale: Locale = DEFAULT_LOCALE,
    currency: Currency = DEFAULT_CURRENCY,
  ): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: {
        ...listSelect,
        descriptionRu: true,
        descriptionEn: true,
        model3dUrl: true,
        variants: {
          select: variantSelect,
          // Cheapest first *in the currency being shown* — the two price lists
          // are set by hand and need not rank variants identically.
          orderBy: { [priceColumn(currency)]: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`No product with slug "${slug}"`);
    }

    return {
      ...toListItem(product, locale, currency),
      description: text(locale, {
        ru: product.descriptionRu,
        en: product.descriptionEn,
      }),
      model3dUrl: product.model3dUrl,
      variants: product.variants.map((variant) =>
        toVariant(variant, locale, currency),
      ),
    };
  }
}

/** Maps a Prisma row onto the public DTO so DB columns never leak by accident. */
function toListItem(
  product: ProductListRow,
  locale: Locale,
  currency: Currency,
): ProductListItemDto {
  return {
    id: product.id,
    slug: product.slug,
    name: text(locale, { ru: product.nameRu, en: product.nameEn }),
    brand: product.brand,
    basePrice: amount(currency, {
      RUB: product.basePriceRub,
      USD: product.basePriceUsd,
    }),
    currency,
    images: product.images,
    featured: product.featured,
    category: {
      slug: product.category.slug,
      name: text(locale, {
        ru: product.category.nameRu,
        en: product.category.nameEn,
      }),
    },
  };
}

function toVariant(
  variant: ProductVariantRow,
  locale: Locale,
  currency: Currency,
): ProductVariantDto {
  return {
    id: variant.id,
    sku: variant.sku,
    label: text(locale, { ru: variant.labelRu, en: variant.labelEn }),
    color: variant.color,
    config: variant.config,
    price: amount(currency, { RUB: variant.priceRub, USD: variant.priceUsd }),
    stock: variant.stock,
  };
}
