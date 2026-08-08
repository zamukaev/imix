import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Paginated,
  ProductDetailDto,
  ProductListItemDto,
} from '@imix/types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  FindProductsQueryDto,
} from './dto/find-products-query.dto';

/** Columns a catalogue grid needs — deliberately not `description`. */
const listSelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  basePrice: true,
  images: true,
  featured: true,
  category: { select: { slug: true, name: true } },
} satisfies Prisma.ProductSelect;

type ProductListRow = Prisma.ProductGetPayload<{ select: typeof listSelect }>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    query: FindProductsQueryDto,
  ): Promise<Paginated<ProductListItemDto>> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

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

    return { items: items.map(toListItem), page, pageSize, total };
  }

  async findBySlug(slug: string): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: {
        ...listSelect,
        description: true,
        model3dUrl: true,
        variants: {
          select: {
            id: true,
            sku: true,
            label: true,
            color: true,
            config: true,
            price: true,
            stock: true,
          },
          orderBy: { price: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`No product with slug "${slug}"`);
    }

    return {
      ...toListItem(product),
      description: product.description,
      model3dUrl: product.model3dUrl,
      variants: product.variants,
    };
  }
}

/** Maps a Prisma row onto the public DTO so DB columns never leak by accident. */
function toListItem(product: ProductListRow): ProductListItemDto {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    basePrice: product.basePrice,
    images: product.images,
    featured: product.featured,
    category: {
      slug: product.category.slug,
      name: product.category.name,
    },
  };
}
