import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { ProductForm } from '@/components/admin/product-form';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { requireAdminApi } from '@/lib/admin-page';
import { getAdminCategories } from '@/lib/api';

type NewProductPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: NewProductPageProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'admin' });

  return { title: t('newProduct') };
}

export default async function NewProductPage({ params }: NewProductPageProps) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const [t, auth] = await Promise.all([
    getTranslations('admin'),
    requireAdminApi(locale),
  ]);
  const categories = await getAdminCategories(auth);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/admin/products" className="text-ink-muted text-sm hover:underline">
        ← {t('products')}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('newProduct')}</h1>

      {categories.length === 0 ? (
        // A product needs a category, so there is nothing useful to render.
        <p className="text-ink-muted mt-12">
          {t('noCategoriesYet')}{' '}
          <Link href="/admin/categories" className="text-brand hover:underline">
            {t('categories')}
          </Link>
        </p>
      ) : (
        <div className="mt-10">
          <ProductForm categories={categories} />
        </div>
      )}
    </main>
  );
}
