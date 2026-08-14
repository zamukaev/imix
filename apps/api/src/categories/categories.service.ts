import { Injectable } from '@nestjs/common';
import { DEFAULT_LOCALE, type CategoryDto, type Locale } from '@imix/types';
import { text } from '../common/localisation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(locale: Locale = DEFAULT_LOCALE): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      // The shop's own order, not the alphabet's. These are product lines, and
      // "Mac, iPad, iPhone, Watch, AirPods" is a sequence a reader recognises
      // where an alphabetical one reads as an accident — it also happens to be
      // the same in both languages, which an alphabetical sort would not be.
      orderBy: [{ position: 'asc' }, { slug: 'asc' }],
      include: {
        _count: { select: { products: true } },
        groups: {
          select: { slug: true, nameRu: true, nameEn: true },
          orderBy: [{ position: 'asc' }, { slug: 'asc' }],
        },
      },
    });

    return categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: text(locale, { ru: category.nameRu, en: category.nameEn }),
      productCount: category._count.products,
      groups: category.groups.map((group) => ({
        slug: group.slug,
        name: text(locale, { ru: group.nameRu, en: group.nameEn }),
      })),
    }));
  }
}
