import type { HomeTileDto } from '@imix/types';

/**
 * Turning the API's flat tile list into rows.
 *
 * The API deliberately does not know about pairs (see ARCHITECTURE.md §2):
 * pairing is a layout decision. Two adjacent `HALF` tiles become one row of two;
 * anything else is a row of one.
 */

export type HomeRow =
  | { kind: 'full'; tile: HomeTileDto }
  | { kind: 'pair'; left: HomeTileDto; right: HomeTileDto };

/**
 * A `HALF` with no neighbour to pair with is rendered full width rather than
 * dropped — a half-finished edit in the admin should degrade, not make a tile
 * disappear from the shop window.
 */
export function toHomeRows(tiles: readonly HomeTileDto[]): HomeRow[] {
  const rows: HomeRow[] = [];

  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index];

    if (!tile) {
      continue;
    }

    const next = tiles[index + 1];

    if (tile.width === 'HALF' && next?.width === 'HALF') {
      rows.push({ kind: 'pair', left: tile, right: next });
      index += 1;
      continue;
    }

    rows.push({ kind: 'full', tile });
  }

  return rows;
}
