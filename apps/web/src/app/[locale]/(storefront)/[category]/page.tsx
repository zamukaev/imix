import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@imix/types';
import { ProductCard } from '@/components/product-card';
import { getCategories, getProducts } from '@/lib/api';
import { getRequestContext } from '@/lib/request-context';

const CATALOGUE_PAGE_SIZE = 24;
/** Cards in the first grid row are above the fold on a desktop viewport. */
const ABOVE_THE_FOLD_CARDS = 3;

type CategoryPageProps = {
  params: Promise<{ category: string; locale: Locale }>;
};

async function findCategory(slug: string, locale: Locale) {
  const categories = await getCategories({ locale });
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: slug, locale } = await params;
  const [t, category] = await Promise.all([
    getTranslations({ locale, namespace: 'metadata' }),
    findCategory(slug, locale),
  ]);

  if (!category) {
    return { title: t('notFound') };
  }

  return {
    title: category.name,
    description: t('categoryDescription', { category: category.name }),
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const context = await getRequestContext();
  const [t, category] = await Promise.all([
    getTranslations('catalogue'),
    findCategory(slug, context.locale),
  ]);

  if (!category) {
    notFound();
  }

  const products = await getProducts(context, {
    category: slug,
    pageSize: CATALOGUE_PAGE_SIZE,
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-12">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{category.name}</h1>
        <p className="text-ink-muted mt-3 text-sm">
          {t('productCount', { count: products.total })}
        </p>
      </header>

      {products.items.length === 0 ? (
        <p className="text-ink-muted">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {products.items.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              priority={index < ABOVE_THE_FOLD_CARDS}
            />
          ))}
        </div>
      )}
    </main>
  );
}
