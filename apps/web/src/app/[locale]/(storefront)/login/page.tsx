import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@imix/types';
import { AuthForm } from '@/components/auth-form';
import { MAIN_CONTENT_ID } from '@/lib/main-content';

type LoginPageProps = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({ params }: LoginPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return {
    title: t('signInTitle'),
    // A sign-in form is not a landing page and has nothing to rank for.
    robots: { index: false },
  };
}

export default async function LoginPage() {
  const t = await getTranslations('auth');

  return (
    <main id={MAIN_CONTENT_ID} className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {t('signInTitle')}
      </h1>
      <p className="text-ink-muted mt-3 mb-10 text-sm">{t('signInLead')}</p>

      <AuthForm mode="login" />
    </main>
  );
}
