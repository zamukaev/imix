import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductGallery } from '@/components/product-gallery';
import { ProductPurchasePanel } from '@/components/product-purchase-panel';
import { getProductOrNull, getProducts } from '@/lib/api';

const PRERENDER_LIMIT = 60;

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const products = await getProducts({ pageSize: PRERENDER_LIMIT }).catch(() => null);
  return (products?.items ?? []).map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductOrNull(slug);

  if (!product) {
    return { title: 'Not found' };
  }

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: `${product.name} · iMIX`,
      description: product.description,
      images: product.images,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductOrNull(slug);

  if (!product) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <nav aria-label="Breadcrumb" className="text-ink-muted mb-10 text-sm">
        <Link
          href={`/${product.category.slug}` as Route}
          className="hover:text-ink transition-colors"
        >
          {product.category.name}
        </Link>
        <span className="mx-2">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="space-y-8 lg:pt-4">
          <header className="space-y-2">
            <p className="text-ink-muted text-xs tracking-widest uppercase">{product.brand}</p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance">{product.name}</h1>
          </header>

          <p className="text-ink-muted max-w-prose leading-relaxed">{product.description}</p>

          <ProductPurchasePanel variants={product.variants} />
        </div>
      </div>
    </main>
  );
}
