import { getTranslations } from 'next-intl/server';
import { LoadingScreen, Skeleton } from '@/components/ui/skeleton';

/** Enough rows to fill the fold without promising a history this long. */
const PLACEHOLDER_ORDERS = 3;

export default async function AccountLoading() {
  const t = await getTranslations('loading');

  return (
    <LoadingScreen label={t('account')}>
      <main className="mx-auto max-w-3xl px-page-gutter py-section">
        <Skeleton className="h-10 w-48 rounded-lg" />

        <div className="mt-16">
          <Skeleton className="h-7 w-40 rounded" />
          <div className="border-line mt-8 grid gap-x-8 gap-y-6 border-t pt-8 sm:grid-cols-[10rem_1fr]">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="contents">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-5 w-56 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-section">
          <Skeleton className="h-7 w-32 rounded" />
          <div className="mt-8 flex flex-col gap-4">
            {Array.from({ length: PLACEHOLDER_ORDERS }, (_, index) => (
              // The card's own height, so the list does not jump when it lands.
              <Skeleton key={index} className="rounded-card h-36 w-full" />
            ))}
          </div>
        </div>
      </main>
    </LoadingScreen>
  );
}
