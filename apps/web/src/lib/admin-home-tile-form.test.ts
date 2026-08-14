import { describe, expect, it } from 'vitest';
import type { AdminHomeTileDto } from '@imix/types';
import {
  emptyHomeTileDraft,
  homeTileDraftFrom,
  toHomeTileRequest,
  type HomeTileDraft,
} from './admin-home-tile-form';

function draft(overrides: Partial<HomeTileDraft> = {}): HomeTileDraft {
  return {
    ...emptyHomeTileDraft(),
    key: 'hero-iphone',
    headlineRu: 'iPhone 17 Pro',
    headlineEn: 'iPhone 17 Pro',
    imageUrl: '/home/hero.jpg',
    ...overrides,
  };
}

describe('toHomeTileRequest', () => {
  it('accepts a tile with no actions', () => {
    const result = toHomeTileRequest(draft());

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.primaryHref).toBeNull();
  });

  it('lower-cases the key and trims the copy', () => {
    const result = toHomeTileRequest(
      draft({ key: '  Hero-IPhone  ', headlineRu: '  iPhone  ' }),
    );

    expect(result.ok && result.value.key).toBe('hero-iphone');
    expect(result.ok && result.value.headlineRu).toBe('iPhone');
  });

  it('turns a blank subhead into null rather than an empty string', () => {
    // Null is "no subhead". An empty string would render as an empty line.
    const result = toHomeTileRequest(draft({ subheadRu: '   ' }));

    expect(result.ok && result.value.subheadRu).toBeNull();
  });

  it('starts a new tile unpublished', () => {
    // The shop window changes when somebody decides it does, not when they
    // start typing.
    expect(emptyHomeTileDraft().published).toBe(false);
  });

  it.each([
    ['the key', 'key'],
    ['the Russian headline', 'headlineRu'],
    ['the English headline', 'headlineEn'],
    ['the image', 'imageUrl'],
  ] as const)('requires %s', (_label, field) => {
    const result = toHomeTileRequest(draft({ [field]: '' }));

    expect(!result.ok && result.fields[field]).toBe('required');
  });

  describe('an action is all or nothing', () => {
    it('accepts a complete primary action', () => {
      const result = toHomeTileRequest(
        draft({
          primaryLabelRu: 'Купить',
          primaryLabelEn: 'Buy',
          primaryHref: '/phones',
        }),
      );

      expect(result.ok).toBe(true);
    });

    it('points at the missing link, not at the labels that are there', () => {
      const result = toHomeTileRequest(
        draft({ primaryLabelRu: 'Купить', primaryLabelEn: 'Buy' }),
      );

      expect(!result.ok && result.fields.primaryHref).toBe('required');
      expect(!result.ok && result.fields.primaryLabelRu).toBeUndefined();
    });

    it('points at the untranslated label', () => {
      const result = toHomeTileRequest(
        draft({ primaryLabelRu: 'Купить', primaryHref: '/phones' }),
      );

      expect(!result.ok && result.fields.primaryLabelEn).toBe('required');
    });

    it('judges the two actions independently', () => {
      const result = toHomeTileRequest(
        draft({
          primaryLabelRu: 'Купить',
          primaryLabelEn: 'Buy',
          primaryHref: '/phones',
          secondaryHref: '/cart',
        }),
      );

      expect(!result.ok && result.fields.secondaryLabelRu).toBe('required');
      expect(!result.ok && result.fields.primaryHref).toBeUndefined();
    });
  });
});

describe('homeTileDraftFrom', () => {
  it('round-trips a tile out of the API and back into one', () => {
    const tile: AdminHomeTileDto = {
      id: 't'.repeat(25),
      key: 'hero-iphone',
      position: 10,
      published: true,
      width: 'HALF',
      surface: 'DARK',
      headlineRu: 'Заголовок',
      headlineEn: 'Headline',
      subheadRu: null,
      subheadEn: 'Sub',
      imageUrl: '/home/hero.jpg',
      imageAltRu: null,
      imageAltEn: null,
      primaryLabelRu: 'Купить',
      primaryLabelEn: 'Buy',
      primaryHref: '/phones',
      secondaryLabelRu: null,
      secondaryLabelEn: null,
      secondaryHref: null,
    };

    const result = toHomeTileRequest(homeTileDraftFrom(tile));

    expect(result.ok && result.value).toEqual({
      key: tile.key,
      published: true,
      width: 'HALF',
      surface: 'DARK',
      headlineRu: tile.headlineRu,
      headlineEn: tile.headlineEn,
      subheadRu: null,
      subheadEn: 'Sub',
      imageUrl: tile.imageUrl,
      imageAltRu: null,
      imageAltEn: null,
      primaryLabelRu: 'Купить',
      primaryLabelEn: 'Buy',
      primaryHref: '/phones',
      secondaryLabelRu: null,
      secondaryLabelEn: null,
      secondaryHref: null,
    });
  });
});
