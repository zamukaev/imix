import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import { getCategories, getProducts } from '@/lib/api';

const CATALOGUE_PAGE_SIZE = 24;
/** Cards in the first grid row are above the fold on a desktop viewport. */
const ABOVE_THE_FOLD_CARDS = 3;

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

/** Pre-renders the known categories; new ones still resolve on demand. */
export async function generateStaticParams() {
  const categories = await getCategories().catch(() => []);
  return categories.map((category) => ({ category: category.slug }));
}

async function findCategory(slug: string) {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await findCategory(slug);

  if (!category) {
    return { title: 'Not found' };
  }

  return {
    title: category.name,
    description: `${category.name} available at iMIX.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const category = await findCategory(slug);

  if (!category) {
    notFound();
  }

  const products = await getProducts({ category: slug, pageSize: CATALOGUE_PAGE_SIZE });

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-12">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{category.name}</h1>
        <p className="text-ink-muted mt-3 text-sm">
          {products.total} {products.total === 1 ? 'product' : 'products'}
        </p>
      </header>

      {products.items.length === 0 ? (
        <p className="text-ink-muted">Nothing in this category yet. Check back soon.</p>
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
