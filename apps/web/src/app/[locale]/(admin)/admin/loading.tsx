import { getTranslations } from 'next-intl/server';
import { LoadingScreen, Skeleton } from '@/components/ui/skeleton';

const PLACEHOLDER_ROWS = 5;

/**
 * Covers every admin screen. They are all a heading over a list or a grid of
 * cards, so one shape stands in for all of them without pretending to know which
 * one is loading.
 */
export default async function AdminLoading() {
  const t = await getTranslations('loading');

  return (
    <LoadingScreen label={t('admin')}>
      <main className="mx-auto max-w-6xl px-6 py-12">
        <Skeleton className="h-9 w-56 rounded-lg" />
        <div className="mt-10 space-y-4">
          {Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => (
            <Skeleton key={index} className="rounded-card h-20 w-full" />
          ))}
        </div>
      </main>
    </LoadingScreen>
  );
}
