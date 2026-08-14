import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { AdminProductDto } from '@imix/types';
import { ProductForm } from '@/components/admin/product-form';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { requireAdminApi } from '@/lib/admin-page';
import { ApiRequestError, getAdminCategories, getAdminProduct } from '@/lib/api';
import type { Authorization } from '@/lib/api';

type EditProductPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

const NOT_FOUND = 404;

export async function generateMetadata({
  params,
}: EditProductPageProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'admin' });

  return { title: t('editProduct') };
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { locale: requested, id } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const [t, auth] = await Promise.all([
    getTranslations('admin'),
    requireAdminApi(locale),
  ]);
  const [product, categories] = await Promise.all([
    loadProduct(id, auth),
    getAdminCategories(auth),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/admin/products" className="text-ink-muted text-sm hover:underline">
        ← {t('products')}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{product.nameRu}</h1>
      <p className="text-ink-muted text-sm">{product.nameEn}</p>

      <div className="mt-10">
        {/* Keyed on the product so navigating between two edit pages restates the
            form rather than carrying the previous product's draft across. */}
        <ProductForm key={product.id} categories={categories} product={product} />
      </div>
    </main>
  );
}

async function loadProduct(id: string, auth: Authorization): Promise<AdminProductDto> {
  try {
    return await getAdminProduct(id, auth);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === NOT_FOUND) {
      // Somebody deleted it in another tab, or the id was typed by hand.
      notFound();
    }

    throw error;
  }
}
