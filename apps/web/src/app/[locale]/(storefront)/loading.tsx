import { getTranslations } from 'next-intl/server';
import { LoadingScreen, Skeleton } from '@/components/ui/skeleton';

/** How many tiles to stand in for. The home page has eight; three fill a screen. */
const PLACEHOLDER_TILES = 3;

/**
 * The home page while its tiles are being fetched.
 *
 * Full-height blocks at the tile's own minimum height, so the scrollbar does not
 * jump the moment the real stack arrives.
 */
export default async function HomeLoading() {
  const t = await getTranslations('loading');

  return (
    <LoadingScreen label={t('home')}>
      <div className="flex flex-col gap-gutter">
        {Array.from({ length: PLACEHOLDER_TILES }, (_, index) => (
          <Skeleton key={index} className="min-h-tile w-full" />
        ))}
      </div>
    </LoadingScreen>
  );
}
