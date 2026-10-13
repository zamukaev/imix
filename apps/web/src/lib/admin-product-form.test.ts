import { describe, expect, it } from 'vitest';
import type { AdminVariantDto } from '@imix/types';
import {
  colorProblems,
  emptyProductDraft,
  emptyVariantDraft,
  toCreateProductRequest,
  toProductRequest,
  toVariantRequest,
  variantDraftFrom,
  type ColorDraft,
  type ProductDraft,
  type VariantDraft,
} from './admin-product-form';

const CATEGORY_ID = 'c'.repeat(25);

function variant(overrides: Partial<VariantDraft> = {}): VariantDraft {
  return {
    ...emptyVariantDraft(),
    sku: 'IP17P-256-BLK',
    labelRu: '256 ГБ · Чёрный титан',
    labelEn: '256GB · Black Titanium',
    priceRub: '149990',
    priceUsd: '1099',
    stock: '5',
    ...overrides,
  };
}

function product(overrides: Partial<ProductDraft> = {}): ProductDraft {
  return {
    ...emptyProductDraft(CATEGORY_ID),
    slug: 'iphone-17-pro',
    nameRu: 'iPhone 17 Pro',
    nameEn: 'iPhone 17 Pro',
    descriptionRu: 'Описание.',
    descriptionEn: 'Description.',
    ...overrides,
  };
}

describe('toVariantRequest', () => {
  it('converts both prices from major to minor units', () => {
    const result = toVariantRequest(variant());

    expect(result.ok && result.value.priceRub).toBe(14_999_000);
    expect(result.ok && result.value.priceUsd).toBe(109_900);
  });

  it('upper-cases the SKU and trims the labels', () => {
    const result = toVariantRequest(
      variant({ sku: ' ip17p-256-blk ', labelRu: '  256 ГБ  ' }),
    );

    expect(result.ok && result.value.sku).toBe('IP17P-256-BLK');
    expect(result.ok && result.value.labelRu).toBe('256 ГБ');
  });

  it('turns a blank colour into null rather than an empty string', () => {
    // "Not set" and "set to nothing" are different, and only one of them is
    // representable in the column.
    const result = toVariantRequest(variant({ colorSlug: '   ', config: '128 ГБ' }));

    expect(result.ok && result.value.colorSlug).toBeNull();
    expect(result.ok && result.value.config).toBe('128 ГБ');
  });

  it('reads a blank stock as none in stock', () => {
    const result = toVariantRequest(variant({ stock: '' }));

    expect(result.ok && result.value.stock).toBe(0);
  });

  it.each([
    ['a missing SKU', { sku: '' }, 'sku'],
    ['a missing Russian label', { labelRu: '  ' }, 'labelRu'],
    ['a missing English label', { labelEn: '' }, 'labelEn'],
  ] as const)('flags %s as required', (_label, overrides, field) => {
    const result = toVariantRequest(variant(overrides));

    expect(!result.ok && result.fields[field]).toBe('required');
  });

  it.each([
    ['the rouble price', 'priceRub'],
    ['the dollar price', 'priceUsd'],
  ] as const)('requires %s', (_label, field) => {
    const result = toVariantRequest(variant({ [field]: '' }));

    // The rule the whole slice exists for: one price list is not enough, because
    // there is no rate to derive the other from.
    expect(!result.ok && result.fields[field]).toBe('required');
  });

  it('tells a malformed amount apart from a missing one', () => {
    const result = toVariantRequest(variant({ priceRub: 'дорого' }));

    expect(!result.ok && result.fields.priceRub).toBe('amount');
  });

  it('rejects a fractional stock', () => {
    const result = toVariantRequest(variant({ stock: '1.5' }));

    expect(!result.ok && result.fields.stock).toBe('amount');
  });
});

describe('variantDraftFrom', () => {
  it('round-trips a variant out of the API and back into one', () => {
    const dto: AdminVariantDto = {
      id: 'v'.repeat(25),
      sku: 'IP17P-256-BLK',
      labelRu: '256 ГБ',
      labelEn: '256GB',
      colorId: null,
      config: '256 ГБ',
      priceRub: 14_999_000,
      priceUsd: 109_900,
      stock: 5,
      sold: true,
    };

    const result = toVariantRequest(variantDraftFrom(dto));

    expect(result.ok && result.value).toEqual({
      sku: dto.sku,
      labelRu: dto.labelRu,
      labelEn: dto.labelEn,
      colorSlug: null,
      config: dto.config,
      priceRub: dto.priceRub,
      priceUsd: dto.priceUsd,
      stock: dto.stock,
    });
    // Carried through so the form knows not to offer a delete button.
    expect(variantDraftFrom(dto).sold).toBe(true);
  });
});

describe('toProductRequest', () => {
  it('lower-cases the slug and keeps both languages', () => {
    const result = toProductRequest(product({ slug: ' iPhone-17-Pro ' }));

    expect(result.ok && result.value.slug).toBe('iphone-17-pro');
    expect(result.ok && result.value.nameEn).toBe('iPhone 17 Pro');
  });

  it.each([
    ['nameRu'],
    ['nameEn'],
    ['descriptionRu'],
    ['descriptionEn'],
    ['slug'],
    ['brand'],
  ] as const)('requires %s', (field) => {
    const result = toProductRequest(product({ [field]: '' }));

    expect(!result.ok && result.fields[field]).toBe('required');
  });

  it('turns a blank 3D model URL into null', () => {
    const result = toProductRequest(product({ model3dUrl: '' }));

    expect(result.ok && result.value.model3dUrl).toBeNull();
  });
});

describe('toCreateProductRequest', () => {
  it('sends the product and its variants together', () => {
    const result = toCreateProductRequest(product(), [variant()]);

    expect(result.ok && result.value.variants).toHaveLength(1);
    expect(result.ok && result.value.nameRu).toBe('iPhone 17 Pro');
  });

  it('points at the row that is wrong, not just at "a variant"', () => {
    const result = toCreateProductRequest(product(), [
      variant(),
      variant({ sku: 'X-2', labelEn: '' }),
    ]);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.variants[1]?.labelEn).toBe('required');
    expect(!result.ok && result.variants[0]).toBeUndefined();
  });

  it('reports product and variant problems in the same pass', () => {
    const result = toCreateProductRequest(product({ nameEn: '' }), [
      variant({ priceUsd: '' }),
    ]);

    expect(!result.ok && result.fields.nameEn).toBe('required');
    expect(!result.ok && result.variants[0]?.priceUsd).toBe('required');
  });
});

describe('colorProblems', () => {
  const colour = (patch: Partial<ColorDraft> = {}): ColorDraft => ({
    slug: 'lavender',
    nameRu: 'Лавандовый',
    nameEn: 'Lavender',
    hex: '#e6dcf0',
    images: [],
    ...patch,
  });

  it('accepts a complete colour', () => {
    expect(colorProblems([colour()]).size).toBe(0);
  });

  it('points at the row that is wrong, not just "a colour"', () => {
    const problems = colorProblems([colour(), colour({ nameEn: '  ' })]);

    expect(problems.get(0)).toBeUndefined();
    expect(problems.get(1)).toEqual({ nameEn: 'required' });
  });

  it.each([
    ['three-digit shorthand', '#abc'],
    ['a missing hash', 'e6dcf0'],
    ['a colour name', 'lavender'],
    ['nothing at all', ''],
  ])('rejects %s as a swatch', (_case, hex) => {
    expect(colorProblems([colour({ hex })]).get(0)).toEqual({ hex: 'hex' });
  });

  it('accepts an uppercase hex, which the request then lower-cases', () => {
    expect(colorProblems([colour({ hex: '#E6DCF0' })]).size).toBe(0);
  });

  it('requires both languages — a swatch labelled in one is half a shop', () => {
    expect(colorProblems([colour({ nameRu: '' })]).get(0)).toEqual({ nameRu: 'required' });
  });
});
