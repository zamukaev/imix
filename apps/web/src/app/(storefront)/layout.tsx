import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <footer className="border-line text-ink-muted mt-24 border-t px-6 py-10 text-sm">
        <div className="mx-auto max-w-6xl">
          iMIX — an independent retailer. Devices shown are illustrative.
        </div>
      </footer>
    </div>
  );
}
