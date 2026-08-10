import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('notFound');

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-6">
      <p className="text-ink-muted text-sm tracking-widest uppercase">{t('code')}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-ink-muted mt-4">{t('lead')}</p>
      <Link href="/" className="text-brand mt-8 text-sm hover:underline">
        {t('back')}
      </Link>
    </main>
  );
}
