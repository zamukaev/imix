import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { SiteHeader } from '@/components/site-header';
import { Logo } from '@/components/ui/logo';
import { MAIN_CONTENT_ID } from '@/lib/main-content';

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const [t, tNav] = await Promise.all([
    getTranslations('footer'),
    getTranslations('nav'),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      {/*
        Six categories, two switchers and a cart link sit above every page. A
        keyboard visitor should not have to walk past all of them on each one —
        so the first thing in the tab order is a way past them. Hidden until it
        is focused, which is the only time it is of any use.
      */}
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="bg-surface text-ink border-line rounded-pill focus:ring-ink/15 sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-20 focus:border focus:px-4 focus:py-2 focus:ring-4"
      >
        {tNav('skipToContent')}
      </a>

      <SiteHeader />
      <div className="flex-1">{children}</div>
      <footer className="border-line text-ink-muted mt-24 border-t px-6 py-10 text-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          {/*
            The full signature, where there is room for the second line.
            `self-start` because the column would otherwise stretch it wide.
          */}
          <Logo variant="lockup" className="h-12 w-auto self-start" />
          <p>{t('note')}</p>
        </div>
      </footer>
    </div>
  );
}
