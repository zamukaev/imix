import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { HomeTileForm } from '@/components/admin/home-tile-form';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { requireAdminApi } from '@/lib/admin-page';
import { getAdminHomeTiles } from '@/lib/api';

type EditTilePageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: EditTilePageProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'admin' });

  return { title: t('editTile') };
}

export default async function EditHomeTilePage({ params }: EditTilePageProps) {
  const { locale: requested, id } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const [t, auth] = await Promise.all([
    getTranslations('admin'),
    requireAdminApi(locale),
  ]);

  // There is no `GET /admin/home-tiles/:id`, and adding one for a page that
  // shows a list of eight would be an endpoint per screen. The list is one
  // query either way.
  const tile = (await getAdminHomeTiles(auth)).find((entry) => entry.id === id);

  if (!tile) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/admin/home-tiles" className="text-ink-muted text-sm hover:underline">
        ← {t('homeTiles')}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{tile.headlineRu}</h1>
      <p className="text-ink-muted text-sm">{tile.headlineEn}</p>

      <div className="mt-10">
        <HomeTileForm key={tile.id} tile={tile} />
      </div>
    </main>
  );
}
