import type { Route } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/product-card';
import { getCategories, getProducts } from '@/lib/api';

const FEATURED_LIMIT = 4;

export default async function HomePage() {
  const [categories, featured] = await Promise.all([
    getCategories(),
    getProducts({ featured: true, pageSize: FEATURED_LIMIT }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6">
      <section className="py-24 sm:py-32">
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
          Phones and laptops,
          <span className="text-ink-muted block">chosen well.</span>
        </h1>
        <p className="text-ink-muted mt-6 max-w-prose text-lg">
          A short catalogue instead of an endless one. Every device here earns its place — and we
          tell you what it is actually like to live with.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/${category.slug}` as Route}
              className="border-line hover:border-ink rounded-full border px-5 py-2 text-sm transition-colors"
            >
              {category.name}
              <span className="text-ink-muted ml-2">{category.productCount}</span>
            </Link>
          ))}
        </div>
      </section>

      {featured.items.length > 0 && (
        <section className="pb-24">
          <h2 className="mb-8 text-2xl font-medium tracking-tight">Featured</h2>
          <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index === 0} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
