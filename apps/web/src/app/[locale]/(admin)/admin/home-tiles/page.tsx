import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { HomeTileList } from '@/components/admin/home-tile-list';
import { ButtonLink } from '@/components/ui/button';
import { routing } from '@/i18n/routing';
import { requireAdminApi } from '@/lib/admin-page';
import { getAdminHomeTiles } from '@/lib/api';

type HomeTilesPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: HomeTilesPageProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'admin' });

  return { title: t('homeTiles') };
}

export default async function AdminHomeTilesPage({ params }: HomeTilesPageProps) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const [t, auth] = await Promise.all([
    getTranslations('admin'),
    requireAdminApi(locale),
  ]);
  const tiles = await getAdminHomeTiles(auth);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{t('homeTiles')}</h1>
        <ButtonLink href="/admin/home-tiles/new" className="ml-auto">
          {t('newTile')}
        </ButtonLink>
      </div>
      <p className="text-ink-muted mt-2 text-sm">{t('homeTilesNote')}</p>

      <div className="mt-8">
        <HomeTileList tiles={tiles} />
      </div>
    </main>
  );
}
