import { describe, expect, it } from 'vitest';
import {
  MAX_LINE_QUANTITY,
  addLine,
  cartItemCount,
  cartSubtotal,
  isStale,
  removeLine,
  refreshLines,
  setLineQuantity,
  type CartLine,
  type CartLineInput,
  type FreshVariant,
} from './cart';

function makeInput(overrides: Partial<CartLineInput> = {}): CartLineInput {
  return {
    variantId: 'variant-1',
    productSlug: 'iphone-17-pro',
    productName: 'iPhone 17 Pro',
    brand: 'Apple',
    variantLabel: '256 ГБ · Чёрный титан',
    unitPrice: 14999000,
    currency: 'RUB',
    locale: 'ru',
    image: '/products/iphone-17-pro-1.jpg',
    stock: 8,
    ...overrides,
  };
}

describe('addLine', () => {
  it('adds a new variant with the given quantity', () => {
    const lines = addLine([], makeInput(), 2);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ variantId: 'variant-1', quantity: 2 });
  });

  it('tops up the quantity when the variant is already in the cart', () => {
    const lines = addLine(addLine([], makeInput(), 1), makeInput(), 2);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(3);
  });

  it('refreshes denormalised product data on re-add', () => {
    const lines = addLine(
      addLine([], makeInput({ unitPrice: 119900 })),
      makeInput({ unitPrice: 99900 }),
    );

    expect(lines[0]?.unitPrice).toBe(99900);
  });

  it('caps quantity at the variant stock', () => {
    const lines = addLine([], makeInput({ stock: 3 }), 10);

    expect(lines[0]?.quantity).toBe(3);
  });

  it('caps quantity at MAX_LINE_QUANTITY even with abundant stock', () => {
    const lines = addLine([], makeInput({ stock: 999 }), 999);

    expect(lines[0]?.quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('does not add an out-of-stock variant', () => {
    const lines = addLine([], makeInput({ stock: 0 }), 1);

    expect(lines).toHaveLength(0);
  });

  it('keeps other lines untouched', () => {
    const other: CartLine = { ...makeInput({ variantId: 'variant-2' }), quantity: 1 };
    const lines = addLine([other], makeInput(), 1);

    expect(lines).toHaveLength(2);
    expect(lines).toContainEqual(other);
  });
});

describe('setLineQuantity', () => {
  it('sets an absolute quantity', () => {
    const lines = setLineQuantity(addLine([], makeInput()), 'variant-1', 5);

    expect(lines[0]?.quantity).toBe(5);
  });

  it('removes the line when set to zero', () => {
    const lines = setLineQuantity(addLine([], makeInput()), 'variant-1', 0);

    expect(lines).toHaveLength(0);
  });

  it('clamps to the stock ceiling', () => {
    const lines = setLineQuantity(addLine([], makeInput({ stock: 4 })), 'variant-1', 100);

    expect(lines[0]?.quantity).toBe(4);
  });

  it('is a no-op for a variant that is not in the cart', () => {
    const lines = setLineQuantity([], 'variant-1', 3);

    expect(lines).toHaveLength(0);
  });
});

describe('removeLine', () => {
  it('removes only the targeted variant', () => {
    const lines = addLine(addLine([], makeInput()), makeInput({ variantId: 'variant-2' }));

    expect(removeLine(lines, 'variant-1')).toEqual([
      expect.objectContaining({ variantId: 'variant-2' }),
    ]);
  });
});

describe('cartItemCount', () => {
  it('sums quantities across lines', () => {
    const lines = addLine(addLine([], makeInput(), 2), makeInput({ variantId: 'variant-2' }), 3);

    expect(cartItemCount(lines)).toBe(5);
  });

  it('is zero for an empty cart', () => {
    expect(cartItemCount([])).toBe(0);
  });
});

describe('cartSubtotal', () => {
  it('sums unit price times quantity across lines', () => {
    const lines = addLine(
      addLine([], makeInput({ unitPrice: 1000 }), 2),
      makeInput({ variantId: 'variant-2', unitPrice: 500 }),
      3,
    );

    expect(cartSubtotal(lines)).toBe(1000 * 2 + 500 * 3);
  });

  it('is zero for an empty cart', () => {
    expect(cartSubtotal([])).toBe(0);
  });
});

describe('isStale', () => {
  it('is false when the line already matches the active pair', () => {
    const lines = addLine([], makeInput({ currency: 'RUB', locale: 'ru' }));

    expect(isStale(lines, 'ru', 'RUB')).toBe(false);
  });

  it('is true when the currency changed', () => {
    const lines = addLine([], makeInput({ currency: 'USD', locale: 'ru' }));

    expect(isStale(lines, 'ru', 'RUB')).toBe(true);
  });

  it('is true when only the language changed', () => {
    // The prices are fine — the copied names and labels are not.
    const lines = addLine([], makeInput({ currency: 'RUB', locale: 'en' }));

    expect(isStale(lines, 'ru', 'RUB')).toBe(true);
  });

  it('is true when any single line is stale', () => {
    const lines = addLine(
      addLine([], makeInput({ currency: 'RUB', locale: 'ru' })),
      makeInput({ variantId: 'variant-2', currency: 'USD', locale: 'ru' }),
    );

    expect(isStale(lines, 'ru', 'RUB')).toBe(true);
  });

  it('is false for an empty cart', () => {
    expect(isStale([], 'en', 'USD')).toBe(false);
  });
});

describe('refreshLines', () => {
  const fresh = (overrides: Partial<FreshVariant> = {}) =>
    new Map<string, FreshVariant>([
      [
        'variant-1',
        {
          unitPrice: 109900,
          stock: 8,
          productName: 'iPhone 17 Pro',
          variantLabel: '256GB · Black Titanium',
          ...overrides,
        },
      ],
    ]);

  it('restates the price and the currency from the fetched data', () => {
    const lines = addLine([], makeInput({ unitPrice: 14999000, currency: 'RUB' }), 2);

    expect(refreshLines(lines, fresh(), 'en', 'USD')[0]).toMatchObject({
      unitPrice: 109900,
      currency: 'USD',
      quantity: 2,
    });
  });

  it('restates the product text and the language', () => {
    const lines = addLine([], makeInput({ locale: 'ru' }));

    expect(refreshLines(lines, fresh(), 'en', 'USD')[0]).toMatchObject({
      variantLabel: '256GB · Black Titanium',
      locale: 'en',
    });
  });

  it('keeps the fields the API does not restate', () => {
    const lines = addLine([], makeInput());

    expect(refreshLines(lines, fresh(), 'en', 'USD')[0]).toMatchObject({
      productSlug: 'iphone-17-pro',
      brand: 'Apple',
      image: '/products/iphone-17-pro-1.jpg',
    });
  });

  it('drops a line whose variant is no longer in the catalogue', () => {
    const lines = addLine([], makeInput());

    expect(refreshLines(lines, new Map(), 'en', 'USD')).toEqual([]);
  });

  it('clamps a quantity that fresh stock no longer covers', () => {
    const lines = addLine([], makeInput({ stock: 8 }), 5);

    expect(refreshLines(lines, fresh({ stock: 2 }), 'en', 'USD')[0]?.quantity).toBe(2);
  });

  it('drops a line that has sold out entirely', () => {
    const lines = addLine([], makeInput(), 3);

    expect(refreshLines(lines, fresh({ stock: 0 }), 'en', 'USD')).toEqual([]);
  });
});
