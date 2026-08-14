'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

type AdminErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * The admin's own failure screen.
 *
 * Separate from the storefront's because the audience is: this reader can act on
 * "the API is not answering", where a shopper cannot. Still no stack trace — the
 * digest is the handle into the server log.
 */
export default function AdminError({ error, reset }: AdminErrorProps) {
  const t = useTranslations('errors');
  const tAdmin = useTranslations('admin');

  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-ink-muted mt-4 text-sm">{t('adminDescription')}</p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button type="button" onClick={reset}>
          {t('retry')}
        </Button>
        <Link href="/admin" className="text-ink-muted hover:text-ink text-sm">
          {tAdmin('dashboardTitle')}
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
