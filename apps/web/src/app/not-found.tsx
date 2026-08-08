import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-6">
      <p className="text-ink-muted text-sm tracking-widest uppercase">404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">We can&rsquo;t find that page.</h1>
      <p className="text-ink-muted mt-4">
        The product or category may have been renamed or removed.
      </p>
      <Link href="/" className="text-brand mt-8 text-sm hover:underline">
        Back to the catalogue
      </Link>
    </main>
  );
}
