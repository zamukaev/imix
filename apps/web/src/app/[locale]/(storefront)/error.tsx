'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

type StorefrontErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * What a shopper sees when the API is unreachable or a page throws.
 *
 * `reset()` re-renders the segment, which is the right first move: the most
 * likely cause is a request that failed once, and asking somebody to reload the
 * whole page for that is asking them to do the browser's job.
 *
 * The error itself is never shown. A stack trace tells a shopper nothing and can
 * leak the shape of the system; `digest` is what ties this screen to a line in
 * the server log.
 */
export default function StorefrontError({ error, reset }: StorefrontErrorProps) {
  const t = useTranslations('errors');

  useEffect(() => {
    // Nothing is reported anywhere yet — when a Sentry (or equivalent) lands,
    // this is the one place the storefront's own failures pass through.
  }, [error]);

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t('title')}
      </h1>
      <p className="text-ink-muted mt-4">{t('description')}</p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          {t('retry')}
        </Button>
        <Link href="/" className="text-ink-muted hover:text-ink text-sm">
          {t('backHome')}
        </Link>
      </div>

      {error.digest ? (
        <p className="text-ink-muted mt-10 text-xs">
          {t('reference', { digest: error.digest })}
        </p>
      ) : null}
    </main>
  );
}
