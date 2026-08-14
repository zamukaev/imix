import { getTranslations } from 'next-intl/server';
import { LoadingScreen, Skeleton } from '@/components/ui/skeleton';

/** As many cards as the carousel shows before it is scrolled. */
const PLACEHOLDER_CARDS = 3;

/** Chips in the model rail, at the width the rail shows before it scrolls. */
const PLACEHOLDER_CHIPS = 5;

export default async function CategoryLoading() {
  const t = await getTranslations('loading');

  return (
    <LoadingScreen label={t('catalogue')}>
      {/* The two bands of the real page, so the surfaces do not swap under the
          visitor when the content lands. */}
      <main>
        <section className="bg-surface">
          <div className="mx-auto max-w-6xl px-6 pt-section pb-16">
            <Skeleton className="h-16 w-72 rounded-lg" />

            <div className="mt-12 flex gap-8 sm:gap-10">
              {Array.from({ length: PLACEHOLDER_CHIPS }, (_, index) => (
                <div key={index} className="flex w-20 shrink-0 flex-col items-center gap-2">
                  <Skeleton className="rounded-card h-14 w-14" />
                  <Skeleton className="h-3 w-14 rounded" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-surface-alt">
          <div className="mx-auto max-w-6xl px-6 py-section">
            <Skeleton className="h-10 w-56 rounded-lg" />
            {/* The tab bar, where the category has one. */}
            <Skeleton className="rounded-pill mt-12 h-13 w-80" />

            <div className="mt-12 flex gap-6 overflow-hidden">
              {Array.from({ length: PLACEHOLDER_CARDS }, (_, index) => (
                <div
                  key={index}
                  className="w-model-card flex shrink-0 flex-col items-center"
                >
                  {/* The same well the card's photograph occupies, so nothing
                      shifts when the carousel replaces this. */}
                  <Skeleton className="rounded-card aspect-square w-full" />
                  <Skeleton className="mt-10 h-7 w-40 rounded" />
                  <Skeleton className="mt-4 h-4 w-52 rounded" />
                  <Skeleton className="mt-6 h-4 w-24 rounded" />
                  <Skeleton className="rounded-pill mt-10 h-12 w-32" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </LoadingScreen>
  );
}
