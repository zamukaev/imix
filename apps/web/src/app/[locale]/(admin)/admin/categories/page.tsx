import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { CategoryManager } from '@/components/admin/category-manager';
import { routing } from '@/i18n/routing';
import { requireAdminApi } from '@/lib/admin-page';
import { getAdminCategories } from '@/lib/api';

type CategoriesPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: CategoriesPageProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'admin' });

  return { title: t('categories') };
}

export default async function AdminCategoriesPage({ params }: CategoriesPageProps) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const [t, auth] = await Promise.all([
    getTranslations('admin'),
    requireAdminApi(locale),
  ]);
  const categories = await getAdminCategories(auth);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t('categories')}</h1>
      <p className="text-ink-muted mt-2 text-sm">{t('categoriesNote')}</p>

      <div className="mt-10">
        <CategoryManager categories={categories} />
      </div>
    </main>
  );
}
