import { describe, expect, it } from 'vitest';
import type { ProductColorDto, ProductVariantDto } from '@imix/types';
import {
  imagesForColor,
  initialColorId,
  shouldShowColorPicker,
  variantsForColor,
} from './product-colors';

function color(id: string, images: string[] = []): ProductColorDto {
  return { id, slug: id, name: id, hex: '#aabbcc', images };
}

function variant(id: string, colorId: string | null, stock = 5): ProductVariantDto {
  return {
    id,
    sku: id.toUpperCase(),
    label: id,
    colorId,
    config: '256 GB',
    price: 14999000,
    stock,
  };
}

describe('initialColorId', () => {
  it('opens on the first colour that can be bought', () => {
    const colors = [color('lavender'), color('sage')];
    const variants = [variant('a', 'lavender', 0), variant('b', 'sage', 3)];

    expect(initialColorId(colors, variants)).toBe('sage');
  });

  it('falls back to the first colour when everything is sold out', () => {
    const colors = [color('lavender'), color('sage')];
    const variants = [variant('a', 'lavender', 0), variant('b', 'sage', 0)];

    expect(initialColorId(colors, variants)).toBe('lavender');
  });

  it('has no selection for a product sold in one finish', () => {
    expect(initialColorId([], [variant('a', null)])).toBeNull();
  });
});

describe('imagesForColor', () => {
  it('shows the colour’s own photographs', () => {
    const lavender = color('lavender', ['/lavender-1.jpg', '/lavender-2.jpg']);

    expect(imagesForColor(lavender, ['/product.jpg'])).toEqual([
      '/lavender-1.jpg',
      '/lavender-2.jpg',
    ]);
  });

  it('falls back to the product’s when the colour has none', () => {
    // The common case: one photograph per product, swatches added before the
    // per-finish shots exist.
    expect(imagesForColor(color('lavender'), ['/product.jpg'])).toEqual(['/product.jpg']);
  });

  it('falls back for a colour that is not there at all', () => {
    expect(imagesForColor(undefined, ['/product.jpg'])).toEqual(['/product.jpg']);
  });
});

describe('variantsForColor', () => {
  const variants = [
    variant('a', 'lavender'),
    variant('b', 'lavender'),
    variant('c', 'sage'),
  ];

  it('keeps only the variants of the chosen finish', () => {
    expect(variantsForColor(variants, 'lavender').map((one) => one.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('keeps everything for a product with no colours', () => {
    expect(variantsForColor(variants, null)).toHaveLength(3);
  });

  it('keeps everything rather than emptying the picker on inconsistent data', () => {
    expect(variantsForColor(variants, 'a-colour-nothing-claims')).toHaveLength(3);
  });
});

describe('shouldShowColorPicker', () => {
  it('is hidden for a single finish, because that is not a choice', () => {
    expect(shouldShowColorPicker([color('lavender')])).toBe(false);
    expect(shouldShowColorPicker([])).toBe(false);
  });

  it('is shown once there are two', () => {
    expect(shouldShowColorPicker([color('lavender'), color('sage')])).toBe(true);
  });
});
