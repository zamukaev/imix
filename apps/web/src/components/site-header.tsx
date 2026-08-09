import type { Route } from 'next';
import Link from 'next/link';
import { CartLink } from '@/components/cart-link';
import { getCategories } from '@/lib/api';

/**
 * Storefront chrome. Server Component — the category nav comes straight from
 * the API, so adding a category in the admin (Phase 3) surfaces it here with
 * no code change.
 */
export async function SiteHeader() {
  const categories = await getCategories().catch(() => []);

  return (
    <header className="border-line bg-surface/80 sticky top-0 z-10 border-b backdrop-blur">
      <nav aria-label="Primary" className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          iMIX
        </Link>

        <ul className="flex flex-1 items-center gap-6 text-sm">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/${category.slug}` as Route}
                className="text-ink-muted hover:text-ink transition-colors"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>

        <CartLink />
      </nav>
    </header>
  );
}
