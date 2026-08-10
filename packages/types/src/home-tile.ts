import type { LocalisedQuery } from './common';

/**
 * The home page as content rather than code — one row per tile, edited in the
 * admin and rendered in order by the storefront.
 */

/** Ground the tile is drawn on. Mirrors `TileSurface` in the Prisma schema. */
export type HomeTileSurface = 'LIGHT' | 'WHITE' | 'DARK';

/** A full-bleed tile, or one half of a pair. */
export type HomeTileWidth = 'FULL' | 'HALF';

/** A CTA. Both halves are always present — a half-filled action is dropped. */
export type HomeTileActionDto = {
  label: string;
  /** A path inside this storefront, e.g. `/phones` — never an external URL. */
  href: string;
};

/**
 * Zero, one or two actions, in the order primary then ghost.
 *
 * A tuple rather than an array so it drops straight into the `Tile` primitive,
 * which accepts at most two by the same construction. The rule "one primary and
 * one ghost, never a third" therefore holds from the database column all the
 * way to the rendered button.
 */
export type HomeTileActions =
  | readonly []
  | readonly [HomeTileActionDto]
  | readonly [HomeTileActionDto, HomeTileActionDto];

/** Response element of `GET /home-tiles`, resolved to one language. */
export type HomeTileDto = {
  id: string;
  width: HomeTileWidth;
  surface: HomeTileSurface;
  headline: string;
  subhead: string | null;
  image: {
    src: string;
    /** Empty when the headline already names what is shown — the common case. */
    alt: string;
  };
  actions: HomeTileActions;
};

/**
 * Accepted query string of `GET /home-tiles`. No currency: a tile carries copy
 * and a picture, never a price.
 */
export type HomeTileListQuery = LocalisedQuery;
