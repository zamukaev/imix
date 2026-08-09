import { describe, expect, it } from 'vitest';
import {
  MAX_LINE_QUANTITY,
  addLine,
  cartItemCount,
  cartSubtotal,
  removeLine,
  setLineQuantity,
  type CartLine,
  type CartLineInput,
} from './cart';

function makeInput(overrides: Partial<CartLineInput> = {}): CartLineInput {
  return {
    variantId: 'variant-1',
    productSlug: 'lumen-slate-14',
    productName: 'Lumen Slate 14',
    brand: 'Lumen',
    variantLabel: '256 GB · Graphite',
    unitPrice: 119900,
    image: '/products/lumen-slate-14-1.svg',
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
