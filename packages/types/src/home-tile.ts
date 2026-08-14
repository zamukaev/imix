import type { LocalisedQuery } from './common';

/**
 * The home page as content rather than code — one row per tile, edited in the
 * admin and rendered in order by the storefront.
 */

/**
 * Ground the tile is drawn on. Mirrors `TileSurface` in the Prisma schema.
 *
 * A list rather than a bare union because the admin has to offer all three in a
 * dropdown, and the API has to reject a fourth.
 */
export const HOME_TILE_SURFACES = ['LIGHT', 'WHITE', 'DARK'] as const;

export type HomeTileSurface = (typeof HOME_TILE_SURFACES)[number];

/** A full-bleed tile, or one half of a pair. */
export const HOME_TILE_WIDTHS = ['FULL', 'HALF'] as const;

export type HomeTileWidth = (typeof HOME_TILE_WIDTHS)[number];

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

/**
 * A tile as the admin edits it: every column, both languages, drafts included.
 *
 * The public `HomeTileDto` resolves one language and quietly drops a half-filled
 * action. This one hides nothing — the person arranging the shop window needs to
 * see the label they typed without an href, precisely because the storefront
 * will not render it.
 */
export type AdminHomeTileDto = {
  id: string;
  /** Stable handle the seed names a tile by. Not shown in the URL. */
  key: string;
  position: number;
  published: boolean;
  width: HomeTileWidth;
  surface: HomeTileSurface;
  headlineRu: string;
  headlineEn: string;
  subheadRu: string | null;
  subheadEn: string | null;
  imageUrl: string;
  imageAltRu: string | null;
  imageAltEn: string | null;
  primaryLabelRu: string | null;
  primaryLabelEn: string | null;
  primaryHref: string | null;
  secondaryLabelRu: string | null;
  secondaryLabelEn: string | null;
  secondaryHref: string | null;
};

/**
 * Body of `POST /admin/home-tiles` and `PATCH /admin/home-tiles/:id`.
 *
 * No `position`: a new tile lands at the end and moves with `POST
 * /admin/home-tiles/:id/move`. Two ways to set an order would eventually
 * disagree, and typing a number is the worse of them.
 */
export type HomeTileWriteRequest = {
  key: string;
  published: boolean;
  width: HomeTileWidth;
  surface: HomeTileSurface;
  headlineRu: string;
  headlineEn: string;
  subheadRu?: string | null;
  subheadEn?: string | null;
  imageUrl: string;
  imageAltRu?: string | null;
  imageAltEn?: string | null;
  primaryLabelRu?: string | null;
  primaryLabelEn?: string | null;
  primaryHref?: string | null;
  secondaryLabelRu?: string | null;
  secondaryLabelEn?: string | null;
  secondaryHref?: string | null;
};

export const TILE_MOVE_DIRECTIONS = ['UP', 'DOWN'] as const;

export type TileMoveDirection = (typeof TILE_MOVE_DIRECTIONS)[number];

/** Body of `POST /admin/home-tiles/:id/move`. */
export type MoveHomeTileRequest = {
  direction: TileMoveDirection;
};
