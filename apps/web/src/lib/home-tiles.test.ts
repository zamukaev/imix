import { describe, expect, it } from 'vitest';
import type { HomeTileDto, HomeTileWidth } from '@imix/types';
import { toHomeRows } from './home-tiles';

function tile(id: string, width: HomeTileWidth): HomeTileDto {
  return {
    id,
    width,
    surface: 'LIGHT',
    headline: id,
    subhead: null,
    image: { src: `/home/${id}.jpg`, alt: '' },
    actions: [],
  };
}

describe('toHomeRows', () => {
  it('keeps a full tile as its own row', () => {
    expect(toHomeRows([tile('a', 'FULL')])).toEqual([
      { kind: 'full', tile: tile('a', 'FULL') },
    ]);
  });

  it('pairs two adjacent halves', () => {
    const rows = toHomeRows([tile('a', 'HALF'), tile('b', 'HALF')]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'pair' });
  });

  it('pairs halves two at a time, not greedily', () => {
    const rows = toHomeRows([
      tile('a', 'HALF'),
      tile('b', 'HALF'),
      tile('c', 'HALF'),
      tile('d', 'HALF'),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.kind === 'pair')).toBe(true);
  });

  it('renders a lone trailing half full width rather than dropping it', () => {
    const rows = toHomeRows([tile('a', 'HALF')]);

    expect(rows).toEqual([{ kind: 'full', tile: tile('a', 'HALF') }]);
  });

  it('renders an odd half at the end of a run full width', () => {
    const rows = toHomeRows([
      tile('a', 'HALF'),
      tile('b', 'HALF'),
      tile('c', 'HALF'),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ kind: 'full', tile: tile('c', 'HALF') });
  });

  it('does not pair across a full tile', () => {
    const rows = toHomeRows([
      tile('a', 'HALF'),
      tile('b', 'FULL'),
      tile('c', 'HALF'),
    ]);

    expect(rows.map((row) => row.kind)).toEqual(['full', 'full', 'full']);
  });

  it('keeps the source order', () => {
    const rows = toHomeRows([
      tile('a', 'FULL'),
      tile('b', 'HALF'),
      tile('c', 'HALF'),
      tile('d', 'FULL'),
    ]);

    expect(rows.map((row) => (row.kind === 'full' ? row.tile.id : row.left.id))).toEqual(
      ['a', 'b', 'd'],
    );
  });

  it('maps an empty list to no rows', () => {
    expect(toHomeRows([])).toEqual([]);
  });
});
