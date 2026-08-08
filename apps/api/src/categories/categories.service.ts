import { Injectable } from '@nestjs/common';
import type { CategoryDto } from '@imix/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });

    return categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      productCount: category._count.products,
    }));
  }
}
