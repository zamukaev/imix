import { getTranslations } from 'next-intl/server';
import { LoadingScreen, Skeleton } from '@/components/ui/skeleton';

const PLACEHOLDER_THUMBNAILS = 3;
const PLACEHOLDER_VARIANTS = 3;

export default async function ProductLoading() {
  const t = await getTranslations('loading');

  return (
    <LoadingScreen label={t('product')}>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <Skeleton className="h-3 w-48 rounded" />

        <div className="mt-8 grid gap-12 lg:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="rounded-card aspect-square w-full" />
            <div className="flex gap-3">
              {Array.from({ length: PLACEHOLDER_THUMBNAILS }, (_, index) => (
                <Skeleton key={index} className="size-20 rounded-xl" />
              ))}
            </div>
          </div>

          <div>
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="mt-3 h-10 w-72 rounded-lg" />
            <Skeleton className="mt-6 h-4 w-full rounded" />
            <Skeleton className="mt-2 h-4 w-5/6 rounded" />

            <div className="mt-10 space-y-3">
              {Array.from({ length: PLACEHOLDER_VARIANTS }, (_, index) => (
                <Skeleton key={index} className="rounded-card h-16 w-full" />
              ))}
            </div>

            <Skeleton className="rounded-pill mt-8 h-12 w-full" />
          </div>
        </div>
      </main>
    </LoadingScreen>
  );
}
