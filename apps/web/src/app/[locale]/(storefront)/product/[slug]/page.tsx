import type { Metadata, Route } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@imix/types';
import { ProductGallery } from '@/components/product-gallery';
import { ProductPurchasePanel } from '@/components/product-purchase-panel';
import { Link } from '@/i18n/navigation';
import { getProductOrNull } from '@/lib/api';
import { getRequestContext } from '@/lib/request-context';

type ProductPageProps = {
  params: Promise<{ slug: string; locale: Locale }>;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const context = await getRequestContext();
  const [t, product] = await Promise.all([
    getTranslations({ locale, namespace: 'metadata' }),
    getProductOrNull(slug, context),
  ]);

  if (!product) {
    return { title: t('notFound') };
  }

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: t('titleTemplate', { page: product.name }),
      description: product.description,
      images: product.images,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const context = await getRequestContext();
  const [t, product] = await Promise.all([
    getTranslations('product'),
    getProductOrNull(slug, context),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <nav aria-label={t('breadcrumb')} className="text-ink-muted mb-10 text-sm">
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

          <ProductPurchasePanel
            productSlug={product.slug}
            productName={product.name}
            brand={product.brand}
            currency={product.currency}
            image={product.images[0] ?? null}
            variants={product.variants}
          />
        </div>
      </div>
    </main>
  );
}
