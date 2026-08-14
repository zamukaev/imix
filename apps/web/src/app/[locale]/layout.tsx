import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { LOCALES, type Locale } from '@imix/types';
import { CurrencyProvider } from '@/components/currency-provider';
import { routing } from '@/i18n/routing';
import { getRequestContext } from '@/lib/request-context';
import { siteUrl } from '@/lib/seo';
import '../globals.css';

/**
 * Both scripts come from one family, so a Russian headline and an English one
 * are set in the same face — see the `--font-sans` token. Self-hosted by
 * `next/font`, so there is no request to a font CDN at runtime.
 */
const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const { locale: requested } = await params;
  // Metadata is generated before the render below can 404, so the fallback here
  // is what keeps a bad locale from throwing instead of rendering the 404 page.
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    // Every relative URL in the tree below — canonicals, `hreflang`, OpenGraph
    // images — is resolved against this. Without it Next guesses from the
    // request, which is right in development and wrong behind any proxy.
    metadataBase: siteUrl,
    title: {
      default: t('titleDefault'),
      template: t('titleTemplate', { page: '%s' }),
    },
    description: t('description'),
    openGraph: {
      type: 'website',
      siteName: t('titleDefault'),
      // Tells a crawler which language this rendering is in; the alternates on
      // each page tell it where the others are.
      locale: OG_LOCALES[locale],
      alternateLocale: LOCALES.filter((other) => other !== locale).map(
        (other) => OG_LOCALES[other],
      ),
    },
  };
}

/** OpenGraph wants a full territory tag, not the bare language code. */
const OG_LOCALES: Record<Locale, string> = {
  ru: 'ru_RU',
  en: 'en_US',
};

/**
 * Note on rendering: reading the currency cookie here makes every page below
 * dynamic. That is deliberate — a price is not something to serve from a cache
 * that does not know which currency the shopper picked. Phase 4 can win the
 * static rendering back with PPR, keeping the priced parts dynamic.
 */
export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  // A locale outside the routing config is a 404 rather than a silent fallback:
  // `/de/phones` is not a page this shop has.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const { currency } = await getRequestContext();

  return (
    <html lang={locale} className={inter.variable}>
      <body>
        <NextIntlClientProvider>
          <CurrencyProvider currency={currency}>{children}</CurrencyProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
