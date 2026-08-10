import type { Route } from 'next';
import type { HomeTileActions, HomeTileDto, HomeTileSurface } from '@imix/types';
import { ButtonLink } from '@/components/ui/button';
import { Tile, TilePair, TileStack, type TileProps, type TileSurface } from '@/components/ui/tile';
import { getHomeTiles } from '@/lib/api';
import { toHomeRows } from '@/lib/home-tiles';
import { getRequestContext } from '@/lib/request-context';

/**
 * The shop window: a stack of tiles read from the database, not a hard-coded
 * layout. The admin owns the list (Phase 3.5), so rearranging the home page is
 * an edit rather than a deploy.
 */
export default async function HomePage() {
  const { locale } = await getRequestContext();
  const tiles = await getHomeTiles({ locale });
  const rows = toHomeRows(tiles);

  return (
    <TileStack>
      {rows.map((row, index) =>
        row.kind === 'pair' ? (
          <TilePair
            key={row.left.id}
            left={toTileProps(row.left)}
            right={toTileProps(row.right)}
          />
        ) : (
          // Exactly one `h1` per page, on the tile that opens it; its image is
          // the largest thing above the fold, so it must not lazy-load.
          <Tile
            key={row.tile.id}
            {...toTileProps(row.tile, { first: index === 0 })}
          />
        ),
      )}
    </TileStack>
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
 * route. That check belongs on the write side, where a human picks the
 * destination — see the note in ARCHITECTURE.md §2. Until the admin exists,
 * these hrefs are only ever what the seed put there.
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
