import type { Metadata, Route } from 'next';
import { getTranslations } from 'next-intl/server';
import type {
  HomeTileActions,
  HomeTileDto,
  HomeTileSurface,
  Locale,
} from '@imix/types';
import { getPathname } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/button';
import { Reveal } from '@/components/ui/reveal';
import { Tile, TilePair, TileStack, type TileProps, type TileSurface } from '@/components/ui/tile';
import { getHomeTiles } from '@/lib/api';
import { toHomeRows } from '@/lib/home-tiles';
import { MAIN_CONTENT_ID } from '@/lib/main-content';
import { alternatesFor } from '@/lib/seo';
import { getRequestContext } from '@/lib/request-context';

type HomePageProps = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    // No `title` — the root layout's default is already "iMIX", and a template
    // would make the home page read "iMIX · iMIX".
    alternates: alternatesFor('/', locale),
    openGraph: {
      type: 'website',
      title: t('titleDefault'),
      description: t('description'),
      url: getPathname({ href: '/', locale }),
    },
  };
}

/**
 * The shop window: a stack of tiles read from the database, not a hard-coded
 * layout. The admin owns the list (Phase 3.5), so rearranging the home page is
 * an edit rather than a deploy.
 */
export default async function HomePage() {
  const { locale } = await getRequestContext();
  const [tiles, t] = await Promise.all([
    getHomeTiles({ locale }),
    getTranslations('home'),
  ]);
  const rows = toHomeRows(tiles);

  // Every tile unpublished, or none created yet. A blank page would read as a
  // broken deploy, so the shop says what it is and offers the way in it still
  // has — the catalogue does not depend on the shop window.
  if (rows.length === 0) {
    return (
      <main
        id={MAIN_CONTENT_ID}
        className="mx-auto flex max-w-xl flex-col items-center px-6 py-32 text-center"
      >
        <h1 className="text-headline font-semibold">{t('emptyTitle')}</h1>
        <p className="text-ink-muted mt-4">{t('emptyLead')}</p>
        <ButtonLink href="/iphone" className="mt-10">
          {t('emptyAction')}
        </ButtonLink>
      </main>
    );
  }

  return (
    // The tile stack is the page's content, so it belongs in a landmark — and
    // the skip link needs somewhere to land here as much as anywhere else.
    <main id={MAIN_CONTENT_ID}>
      <TileStack>
        {rows.map((row, index) =>
          row.kind === 'pair' ? (
            <Reveal key={row.left.id}>
              <TilePair left={toTileProps(row.left)} right={toTileProps(row.right)} />
            </Reveal>
          ) : (
            // Exactly one `h1` per page, on the tile that opens it; its image is
            // the largest thing above the fold, so it must not lazy-load — and
            // `Reveal` leaves anything already on screen alone, so the first
            // tile is never hidden and faded in.
            <Reveal key={row.tile.id}>
              <Tile {...toTileProps(row.tile, { first: index === 0 })} />
            </Reveal>
          ),
        )}
      </TileStack>
    </main>
  );
}

const SURFACES: Record<HomeTileSurface, TileSurface> = {
  LIGHT: 'light',
  WHITE: 'white',
  DARK: 'dark',
};

function toTileProps(
  tile: HomeTileDto,
  { first = false }: { first?: boolean } = {},
): TileProps {
  return {
    headline: tile.headline,
    subhead: tile.subhead ?? undefined,
    surface: SURFACES[tile.surface],
    as: first ? 'h1' : 'h2',
    media: { src: tile.image.src, alt: tile.image.alt, priority: first },
    actions: toActions(tile.actions),
  };
}

/**
 * The API's action tuple maps one-to-one onto the primitive's, so the "one
 * primary, one ghost, never a third" rule needs no checking here — it is
 * already impossible to express.
 *
 * The `as Route` casts are the one place typed routes cannot help: an href out
 * of the database is a runtime string, and no amount of typing makes it a known
 * route. The check that matters happens where a human picks the destination —
 * `StorefrontHrefService` resolves every tile link against the real catalogue on
 * write, so nothing reaching here points at a page this shop does not have.
 */
function toActions(actions: HomeTileActions): TileProps['actions'] {
  const [primary, secondary] = actions;

  if (primary && secondary) {
    return [
      <ButtonLink key="primary" href={primary.href as Route}>
        {primary.label}
      </ButtonLink>,
      <ButtonLink key="secondary" href={secondary.href as Route} variant="ghost">
        {secondary.label}
      </ButtonLink>,
    ];
  }

  if (primary) {
    return [
      <ButtonLink key="primary" href={primary.href as Route}>
        {primary.label}
      </ButtonLink>,
    ];
  }

  return undefined;
}
