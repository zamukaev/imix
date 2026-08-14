import type { Metadata, Route } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { AdminProductListItemDto } from '@imix/types';
import { ButtonLink } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { requireAdminApi } from '@/lib/admin-page';
import { getAdminProducts } from '@/lib/api';
import { formatMoney } from '@/lib/format';

type ProductsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: ProductsPageProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'admin' });

  return { title: t('products') };
}

/**
 * The product worklist.
 *
 * Both names in one row rather than the active locale's: a missing translation is
 * the most common thing wrong with a catalogue entry, and this is where it should
 * be visible without opening anything.
 */
export default async function AdminProductsPage({ params }: ProductsPageProps) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const [t, auth] = await Promise.all([
    getTranslations('admin'),
    requireAdminApi(locale),
  ]);
  const products = await getAdminProducts(auth);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{t('products')}</h1>
        <ButtonLink href="/admin/products/new" className="ml-auto">
          {t('newProduct')}
        </ButtonLink>
      </div>

      {products.length === 0 ? (
        <p className="text-ink-muted mt-12">{t('noProducts')}</p>
      ) : (
        <div className="border-line bg-surface rounded-card mt-8 overflow-x-auto border">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="text-ink-muted border-line border-b">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('columnProduct')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('category')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('columnFrom')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('variants')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('stock')}
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <Row key={product.id} product={product} locale={locale} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

async function Row({
  product,
  locale,
}: {
  product: AdminProductListItemDto;
  locale: 'ru' | 'en';
}) {
  const t = await getTranslations('admin');

  return (
    <tr className="border-line border-b last:border-0">
      <td className="px-4 py-3">
        <Link
          // The same cast the storefront makes wherever an href is computed
          // rather than written down — typed routes cannot follow a value.
          href={`/admin/products/${product.id}` as Route}
          className="font-medium hover:underline"
        >
          {product.nameRu}
        </Link>
        <span className="text-ink-muted block text-xs">{product.nameEn}</span>
        {product.featured ? (
          <span className="text-brand text-xs">{t('featured')}</span>
        ) : null}
      </td>
      <td className="text-ink-muted px-4 py-3">{product.category.nameRu}</td>
      <td className="px-4 py-3 tabular-nums">
        {/* Both price lists, because there is no rate to derive one from the other. */}
        {formatMoney(product.basePriceRub, locale, 'RUB')}
        <span className="text-ink-muted block text-xs">
          {formatMoney(product.basePriceUsd, locale, 'USD')}
        </span>
      </td>
      <td className="px-4 py-3 tabular-nums">{product.variantCount}</td>
      <td className="px-4 py-3 tabular-nums">
        <span className={product.stock === 0 ? 'text-danger' : undefined}>
          {product.stock}
        </span>
      </td>
    </tr>
  );
}
