import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { HomeTileForm } from '@/components/admin/home-tile-form';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { requireAdminApi } from '@/lib/admin-page';

type NewTilePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: NewTilePageProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'admin' });

  return { title: t('newTile') };
}

export default async function NewHomeTilePage({ params }: NewTilePageProps) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const [t] = await Promise.all([getTranslations('admin'), requireAdminApi(locale)]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/admin/home-tiles" className="text-ink-muted text-sm hover:underline">
        ← {t('homeTiles')}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('newTile')}</h1>

      <div className="mt-10">
        <HomeTileForm />
      </div>
    </main>
  );
}
