import type { Metadata, Route } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@imix/types';
import { CategoryModelNav } from '@/components/category-model-nav';
import { ModelCarousel } from '@/components/model-carousel';
import { ModelCard } from '@/components/ui/model-card';
import { getPathname } from '@/i18n/navigation';
import { getCategories, getProducts } from '@/lib/api';
import { alternatesFor } from '@/lib/seo';
import { getRequestContext } from '@/lib/request-context';
import { MAIN_CONTENT_ID } from '@/lib/main-content';

const CATALOGUE_PAGE_SIZE = 24;
/** Cards visible before the carousel is scrolled, on a desktop viewport. */
const ABOVE_THE_FOLD_CARDS = 3;

type CategoryPageProps = {
  params: Promise<{ category: string; locale: Locale }>;
};

async function findCategory(slug: string, locale: Locale) {
  const categories = await getCategories({ locale });
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: slug, locale } = await params;
  const [t, category] = await Promise.all([
    getTranslations({ locale, namespace: 'metadata' }),
    findCategory(slug, locale),
  ]);

  if (!category) {
    return { title: t('notFound') };
  }

  const description = t('categoryDescription', { category: category.name });

  return {
    title: category.name,
    description,
    // The slug is brand-neutral and locale-independent (`/phones` in both), so
    // the two renderings are one page in two languages.
    alternates: alternatesFor(`/${slug}` as Route, locale),
    openGraph: {
      type: 'website',
      title: t('titleTemplate', { page: category.name }),
      description,
      url: getPathname({ href: `/${slug}` as Route, locale }),
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const context = await getRequestContext();
  const [t, category] = await Promise.all([
    getTranslations('catalogue'),
    findCategory(slug, context.locale),
  ]);

  if (!category) {
    notFound();
  }

  const products = await getProducts(context, {
    category: slug,
    pageSize: CATALOGUE_PAGE_SIZE,
  });

  if (products.items.length === 0) {
    return (
      <main id={MAIN_CONTENT_ID} className="mx-auto max-w-6xl px-6 py-section">
        <h1 className="text-headline lg:text-display max-w-headline font-semibold">
          {category.name}
        </h1>
        <p className="text-ink-muted mt-6">{t('empty')}</p>
      </main>
    );
  }

  return (
    <main id={MAIN_CONTENT_ID}>
      {/*
        Two bands rather than one page: white for the name and the model rail,
        the alt surface for the models themselves. That is the tile stack's
        alternating-surface rule (§5.1) applied to a page that is not a stack —
        it is what removes the need for a border between the two.
      */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-6 pt-section pb-16">
          <h1 className="text-headline lg:text-display max-w-headline font-semibold">
            {category.name}
          </h1>

          <CategoryModelNav products={products.items} />
        </div>
      </section>

      {/*
        The band is padded, not its contents: the carousel runs the full width
        of the screen and puts its own tabs and arrows back in the content
        column. Wrapping it in `max-w-page` here would clip the bleed it exists
        for.
      */}
      <section className="bg-surface-alt py-section">
        <div className="mx-auto max-w-page px-page-gutter">
          <h2 className="text-headline mb-12 font-semibold">{t('allModels')}</h2>
        </div>

        {/*
          The cards are rendered here, on the server, and handed to the client
          shell as nodes. The carousel owns tabs and scroll position; the card
          markup never reaches the browser as JavaScript.
        */}
        <ModelCarousel
          // `?? []` because the storefront and the API deploy separately: an
          // API that predates tabs answers without the field, and a category
          // page is not worth crashing over a tab bar.
          groups={category.groups ?? []}
          slides={products.items.map((product, index) => ({
            id: product.id,
            group: product.group?.slug ?? null,
            card: (
              <ModelCard
                product={product}
                priority={index < ABOVE_THE_FOLD_CARDS}
              />
            ),
          }))}
        />
      </section>
    </main>
  );
}
