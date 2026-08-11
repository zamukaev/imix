import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@imix/types';
import { AuthForm } from '@/components/auth-form';

type RegisterPageProps = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({
  params,
}: RegisterPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return {
    title: t('signUpTitle'),
    robots: { index: false },
  };
}

export default async function RegisterPage() {
  const t = await getTranslations('auth');

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {t('signUpTitle')}
      </h1>
      <p className="text-ink-muted mt-3 mb-10 text-sm">{t('signUpLead')}</p>

      <AuthForm mode="register" />
    </main>
  );
}
