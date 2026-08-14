import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AdminCategoryDto,
  AdminProductDto,
  AdminProductListItemDto,
  AdminVariantDto,
} from '@imix/types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WriteCategoryDto } from './dto/write-category.dto';
import { CreateProductDto, WriteProductDto } from './dto/write-product.dto';
import { PatchVariantDto, WriteVariantDto } from './dto/write-variant.dto';

/** Prisma's codes for the three failures this service turns into real answers. */
const UNIQUE_VIOLATION = 'P2002';
const FOREIGN_KEY_VIOLATION = 'P2003';
const RECORD_NOT_FOUND = 'P2025';

const categorySelect = {
  id: true,
  slug: true,
  nameRu: true,
  nameEn: true,
} satisfies Prisma.CategorySelect;

const groupSelect = {
  id: true,
  slug: true,
  nameRu: true,
  nameEn: true,
} satisfies Prisma.ProductGroupSelect;

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
  _count: { select: { orderItems: true } },
} satisfies Prisma.ProductVariantSelect;

const productListSelect = {
  id: true,
  slug: true,
  nameRu: true,
  nameEn: true,
  brand: true,
  featured: true,
  basePriceRub: true,
  basePriceUsd: true,
  images: true,
  category: { select: categorySelect },
  variants: { select: { stock: true } },
} satisfies Prisma.ProductSelect;

const productDetailSelect = {
  ...productListSelect,
  descriptionRu: true,
  descriptionEn: true,
  taglineRu: true,
  taglineEn: true,
  navImageUrl: true,
  groupId: true,
  model3dUrl: true,
  variants: { select: variantSelect, orderBy: { priceRub: 'asc' } },
} satisfies Prisma.ProductSelect;

type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;
type VariantRow = Prisma.ProductVariantGetPayload<{ select: typeof variantSelect }>;
type ProductListRow = Prisma.ProductGetPayload<{ select: typeof productListSelect }>;
type ProductDetailRow = Prisma.ProductGetPayload<{ select: typeof productDetailSelect }>;

/**
 * The write side of the catalogue.
 *
 * Separate from `ProductsService` on purpose: that one resolves one language and
 * one currency for a shopper, this one hands the whole row to the person editing
 * it. Sharing a mapper between them would mean one of the two lying.
 */
@Injectable()
export class AdminCatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- categories

  async listCategories(): Promise<AdminCategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: { slug: 'asc' },
      select: {
        ...categorySelect,
        _count: { select: { products: true } },
        groups: { select: groupSelect, orderBy: [{ position: 'asc' }, { slug: 'asc' }] },
      },
    });

    return categories.map((category) => ({
      ...toCategoryRef(category),
      productCount: category._count.products,
      groups: category.groups,
    }));
  }

  async createCategory(dto: WriteCategoryDto): Promise<AdminCategoryDto> {
    const category = await this.guarded(
      () => this.prisma.category.create({ data: { ...dto }, select: categorySelect }),
      { slug: `A category with the slug "${dto.slug}" already exists.` },
    );

    // A category is created without tabs; they are added afterwards.
    return { ...toCategoryRef(category), productCount: 0, groups: [] };
  }

  async updateCategory(id: string, dto: WriteCategoryDto): Promise<AdminCategoryDto> {
    const category = await this.guarded(
      () =>
        this.prisma.category.update({
          where: { id },
          data: { ...dto },
          select: {
            ...categorySelect,
            _count: { select: { products: true } },
            groups: { select: groupSelect, orderBy: [{ position: 'asc' }, { slug: 'asc' }] },
          },
        }),
      { slug: `A category with the slug "${dto.slug}" already exists.` },
      `No category with id "${id}"`,
    );

    return {
      ...toCategoryRef(category),
      productCount: category._count.products,
      groups: category.groups,
    };
  }

  async deleteCategory(id: string): Promise<void> {
    const products = await this.prisma.product.count({ where: { categoryId: id } });

    // Checked rather than left to the foreign key, so the answer names the thing
    // to do about it instead of quoting a constraint.
    if (products > 0) {
      throw new ConflictException(
        `This category still holds ${products} product(s). Move or delete them first.`,
      );
    }

    await this.guarded(
      () => this.prisma.category.delete({ where: { id } }),
      {},
      `No category with id "${id}"`,
    );
  }

  // ------------------------------------------------------------------ products

  async listProducts(): Promise<AdminProductListItemDto[]> {
    const products = await this.prisma.product.findMany({
      // Newest first: the admin list is a worklist, and the thing just added is
      // the thing most likely to need another look.
      orderBy: { createdAt: 'desc' },
      select: productListSelect,
    });

    return products.map(toProductListItem);
  }

  /**
   * A product may only be filed under a tab of its own category.
   *
   * The foreign key alone would accept a group from any category, and the model
   * would then sit under a tab its page never renders — invisible everywhere
   * except the one place nobody looks. Checked here rather than in the DTO
   * because it is a question about two rows, not about a string.
   */
  private async assertGroupBelongsToCategory({
    groupId,
    categoryId,
  }: Pick<WriteProductDto, 'groupId' | 'categoryId'>): Promise<void> {
    if (!groupId) {
      return;
    }

    const group = await this.prisma.productGroup.findUnique({
      where: { id: groupId },
      select: { categoryId: true },
    });

    if (!group || group.categoryId !== categoryId) {
      throw new BadRequestException(
        'That tab belongs to a different category.',
      );
    }
  }

  async findProduct(id: string): Promise<AdminProductDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: productDetailSelect,
    });

    if (!product) {
      throw new NotFoundException(`No product with id "${id}"`);
    }

    return toProductDetail(product);
  }

  async createProduct(dto: CreateProductDto): Promise<AdminProductDto> {
    const { variants, ...product } = dto;

    assertUniqueSkus(variants);
    await this.assertGroupBelongsToCategory(product);

    const created = await this.guarded(
      () =>
        this.prisma.product.create({
          data: {
            ...product,
            ...clearedWhenAbsent(product),
            ...basePrices(variants),
            variants: { create: variants.map(toVariantData) },
          },
          select: productDetailSelect,
        }),
      {
        slug: `A product with the slug "${dto.slug}" already exists.`,
        sku: 'One of these SKUs is already used by another product.',
      },
    );

    return toProductDetail(created);
  }

  async updateProduct(id: string, dto: WriteProductDto): Promise<AdminProductDto> {
    await this.assertGroupBelongsToCategory(dto);

    const updated = await this.guarded(
      () =>
        this.prisma.product.update({
          where: { id },
          data: { ...dto, ...clearedWhenAbsent(dto) },
          select: productDetailSelect,
        }),
      { slug: `A product with the slug "${dto.slug}" already exists.` },
      `No product with id "${id}"`,
    );

    return toProductDetail(updated);
  }

  /**
   * Deletes a product and its variants.
   *
   * Refused as soon as one variant has been ordered: `OrderItem` points at the
   * variant, and an order whose lines lost their variant is an order nobody can
   * read back. Retiring such a product means taking its stock to zero, which is
   * what `featured` and stock are for.
   */
  async deleteProduct(id: string): Promise<void> {
    const sold = await this.prisma.orderItem.count({
      where: { variant: { productId: id } },
    });

    if (sold > 0) {
      throw new ConflictException(
        'This product has been ordered and cannot be deleted. Set its stock to zero instead.',
      );
    }

    await this.guarded(
      () =>
        this.prisma.$transaction([
          this.prisma.productVariant.deleteMany({ where: { productId: id } }),
          this.prisma.product.delete({ where: { id } }),
        ]),
      {},
      `No product with id "${id}"`,
    );
  }

  // ------------------------------------------------------------------ variants

  async addVariant(productId: string, dto: WriteVariantDto): Promise<AdminProductDto> {
    await this.findProduct(productId);

    await this.guarded(
      () =>
        this.prisma.productVariant.create({
          data: { ...toVariantData(dto), productId },
        }),
      { sku: `The SKU "${dto.sku}" is already used.` },
    );

    return this.resyncBasePrices(productId);
  }

  async updateVariant(id: string, dto: PatchVariantDto): Promise<AdminProductDto> {
    const variant = await this.guarded(
      () =>
        this.prisma.productVariant.update({
          where: { id },
          data: { ...dto },
          select: { productId: true },
        }),
      { sku: dto.sku ? `The SKU "${dto.sku}" is already used.` : undefined },
      `No variant with id "${id}"`,
    );

    return this.resyncBasePrices(variant.productId);
  }

  /**
   * Removes a variant, unless it is the product's last one or somebody has
   * bought it. Both refusals protect something the reader of an order or a
   * catalogue page would otherwise find missing.
   */
  async deleteVariant(id: string): Promise<AdminProductDto> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      select: { productId: true, _count: { select: { orderItems: true } } },
    });

    if (!variant) {
      throw new NotFoundException(`No variant with id "${id}"`);
    }

    if (variant._count.orderItems > 0) {
      throw new ConflictException(
        'This variant has been ordered and cannot be deleted. Set its stock to zero instead.',
      );
    }

    const remaining = await this.prisma.productVariant.count({
      where: { productId: variant.productId },
    });

    if (remaining <= 1) {
      throw new ConflictException(
        'A product needs at least one variant. Delete the product instead.',
      );
    }

    await this.prisma.productVariant.delete({ where: { id } });

    return this.resyncBasePrices(variant.productId);
  }

  /**
   * Rewrites the denormalised "from" prices after any change to the variants.
   *
   * The catalogue grid prints these, so leaving them behind would show a price
   * the variant picker no longer offers. Each currency takes its own minimum:
   * the two price lists are set by hand and need not agree on which variant is
   * the cheapest one.
   */
  private async resyncBasePrices(productId: string): Promise<AdminProductDto> {
    const variants = await this.prisma.productVariant.findMany({
      where: { productId },
      select: { priceRub: true, priceUsd: true },
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: basePrices(variants),
    });

    return this.findProduct(productId);
  }

  /**
   * Runs a write and translates Prisma's constraint failures into answers.
   *
   * `conflicts` maps a column named in a unique-constraint error to the sentence
   * worth showing; `missing` is the message for an update or delete whose row is
   * not there.
   */
  private async guarded<T>(
    write: () => Promise<T>,
    conflicts: Record<string, string | undefined>,
    missing?: string,
  ): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
        throw error;
      }

      if (error.code === RECORD_NOT_FOUND && missing) {
        throw new NotFoundException(missing);
      }

      if (error.code === UNIQUE_VIOLATION) {
        const fields = targetFields(error);
        const explained = fields
          .map((field) => conflicts[field])
          .find((message) => message !== undefined);

        throw new ConflictException(
          explained ?? `Something with this ${fields.join(', ') || 'value'} already exists.`,
        );
      }

      if (error.code === FOREIGN_KEY_VIOLATION) {
        // The only foreign key an admin can point at the wrong thing.
        throw new BadRequestException('That category does not exist.');
      }

      throw error;
    }
  }
}

/** Prisma reports the offending columns in `meta.target`, shape depending on the driver. */
function targetFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.filter((field): field is string => typeof field === 'string');
  }

  return typeof target === 'string' ? [target] : [];
}

function assertUniqueSkus(variants: readonly WriteVariantDto[]): void {
  const seen = new Set<string>();

  for (const variant of variants) {
    if (seen.has(variant.sku)) {
      // Caught here rather than left to the unique index, because the index
      // would report a clash with "another product" for a duplicate inside this
      // very request.
      throw new BadRequestException(`The SKU "${variant.sku}" is listed twice.`);
    }

    seen.add(variant.sku);
  }
}

/** The cheapest variant in each currency, independently. */
function basePrices(variants: readonly { priceRub: number; priceUsd: number }[]): {
  basePriceRub: number;
  basePriceUsd: number;
} {
  return {
    basePriceRub: Math.min(...variants.map((variant) => variant.priceRub)),
    basePriceUsd: Math.min(...variants.map((variant) => variant.priceUsd)),
  };
}

function toVariantData(dto: WriteVariantDto): Prisma.ProductVariantCreateWithoutProductInput {
  return {
    sku: dto.sku,
    labelRu: dto.labelRu,
    labelEn: dto.labelEn,
    color: dto.color ?? null,
    config: dto.config ?? null,
    priceRub: dto.priceRub,
    priceUsd: dto.priceUsd,
    stock: dto.stock,
  };
}

function toCategoryRef(category: CategoryRow) {
  return {
    id: category.id,
    slug: category.slug,
    nameRu: category.nameRu,
    nameEn: category.nameEn,
  };
}

function toProductListItem(product: ProductListRow): AdminProductListItemDto {
  return {
    id: product.id,
    slug: product.slug,
    nameRu: product.nameRu,
    nameEn: product.nameEn,
    brand: product.brand,
    featured: product.featured,
    category: toCategoryRef(product.category),
    basePriceRub: product.basePriceRub,
    basePriceUsd: product.basePriceUsd,
    images: product.images,
    variantCount: product.variants.length,
    stock: product.variants.reduce((total, variant) => total + variant.stock, 0),
  };
}

function toProductDetail(product: ProductDetailRow): AdminProductDto {
  return {
    ...toProductListItem({ ...product, variants: product.variants }),
    descriptionRu: product.descriptionRu,
    descriptionEn: product.descriptionEn,
    taglineRu: product.taglineRu,
    taglineEn: product.taglineEn,
    navImageUrl: product.navImageUrl,
    groupId: product.groupId,
    model3dUrl: product.model3dUrl,
    variants: product.variants.map(toVariant),
  };
}

/**
 * The nullable columns of a product write, normalised to explicit `null`.
 *
 * A field the form left out arrives `undefined`, which Prisma reads as "leave
 * it alone" — so clearing a tagline would silently keep the old one. Listing
 * them here rather than at each call site keeps the create and the update
 * agreeing on which columns behave that way.
 */
function clearedWhenAbsent(dto: WriteProductDto) {
  return {
    taglineRu: dto.taglineRu ?? null,
    taglineEn: dto.taglineEn ?? null,
    navImageUrl: dto.navImageUrl ?? null,
    groupId: dto.groupId ?? null,
    model3dUrl: dto.model3dUrl ?? null,
  };
}

function toVariant(variant: VariantRow): AdminVariantDto {
  return {
    id: variant.id,
    sku: variant.sku,
    labelRu: variant.labelRu,
    labelEn: variant.labelEn,
    color: variant.color,
    config: variant.config,
    priceRub: variant.priceRub,
    priceUsd: variant.priceUsd,
    stock: variant.stock,
    sold: variant._count.orderItems > 0,
  };
}
