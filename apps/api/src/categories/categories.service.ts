import { Injectable } from '@nestjs/common';
import { DEFAULT_LOCALE, type CategoryDto, type Locale } from '@imix/types';
import { nameColumn, text } from '../common/localisation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(locale: Locale = DEFAULT_LOCALE): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      // Alphabetical in the language being read — Russian and English orderings
      // are not the same, so sorting on a fixed column would look arbitrary in
      // one of them.
      orderBy: { [nameColumn(locale)]: 'asc' },
      include: { _count: { select: { products: true } } },
    });

    return categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: text(locale, { ru: category.nameRu, en: category.nameEn }),
      productCount: category._count.products,
    }));
  }
}
