import { describe, expect, it } from 'vitest';
import {
  EMPTY_SHIPPING_FORM,
  buildOrderRequest,
  parseShippingForm,
  readShippingForm,
  toOrderItems,
  type ShippingFormRaw,
  type ValidationMessages,
} from './checkout';
import type { CartLine } from './cart';

/**
 * The schema is built from translated messages, so the tests supply their own.
 * Identifiable strings rather than real copy: an assertion about *which* field
 * failed should not break when the Russian wording is polished.
 */
const MESSAGES: ValidationMessages = {
  email: 'invalid-email',
  name: 'invalid-name',
  nameTooLong: 'name-too-long',
  address: 'invalid-address',
  addressTooLong: 'address-too-long',
  city: 'invalid-city',
  cityTooLong: 'city-too-long',
  zip: 'invalid-zip',
  zipTooLong: 'zip-too-long',
  country: 'invalid-country',
};

const parse = (raw: ShippingFormRaw) => parseShippingForm(raw, MESSAGES);

function makeRaw(overrides: Partial<ShippingFormRaw> = {}): ShippingFormRaw {
  return {
    email: 'mila@example.com',
    name: 'Мила Орлова',
    address: 'ул. Тверская, 14',
    city: 'Москва',
    zip: '125009',
    country: 'RU',
    ...overrides,
  };
}

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
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
    quantity: 1,
    ...overrides,
  };
}

describe('readShippingForm', () => {
  it('reads every field off the form', () => {
    const formData = new FormData();
    for (const [field, value] of Object.entries(makeRaw())) {
      formData.set(field, value);
    }

    expect(readShippingForm(formData)).toEqual(makeRaw());
  });

  it('reads absent fields as empty strings rather than dropping them', () => {
    expect(readShippingForm(new FormData())).toEqual({
      email: '',
      name: '',
      address: '',
      city: '',
      zip: '',
      country: '',
    });
  });
});

describe('parseShippingForm', () => {
  it('accepts a complete address', () => {
    const result = parse(makeRaw());

    expect(result).toEqual({ ok: true, values: makeRaw() });
  });

  it('trims surrounding whitespace', () => {
    const result = parse(makeRaw({ name: '  Мила Орлова  ' }));

    expect(result.ok && result.values.name).toBe('Мила Орлова');
  });

  it.each([
    ['email', 'not-an-email'],
    ['name', ''],
    ['address', ''],
    ['city', '   '],
    ['zip', ''],
    ['country', 'Россия'],
  ])('reports %s when it is invalid', (field, value) => {
    const result = parse(makeRaw({ [field]: value }));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors).toHaveProperty(field);
  });

  it('reports every invalid field at once', () => {
    const result = parse({
      email: 'nope',
      name: '',
      address: '',
      city: '',
      zip: '',
      country: 'XX',
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && Object.keys(result.fieldErrors).sort()).toEqual([
      'address',
      'city',
      'country',
      'email',
      'name',
      'zip',
    ]);
  });

  it('rejects the blank starting form', () => {
    expect(parse(EMPTY_SHIPPING_FORM).ok).toBe(false);
  });
});

describe('toOrderItems', () => {
  it('sends identity and amount only, never a price', () => {
    const items = toOrderItems([makeLine({ quantity: 2 })]);

    expect(items).toEqual([{ variantId: 'variant-1', quantity: 2 }]);
  });

  it('keeps one entry per cart line', () => {
    const items = toOrderItems([
      makeLine({ variantId: 'variant-1' }),
      makeLine({ variantId: 'variant-2', quantity: 3 }),
    ]);

    expect(items).toEqual([
      { variantId: 'variant-1', quantity: 1 },
      { variantId: 'variant-2', quantity: 3 },
    ]);
  });

  it('maps an empty cart to an empty list', () => {
    expect(toOrderItems([])).toEqual([]);
  });
});

describe('buildOrderRequest', () => {
  it('assembles the request the API expects', () => {
    const parsed = parse(makeRaw());
    if (!parsed.ok) throw new Error('fixture should be valid');

    expect(
      buildOrderRequest(parsed.values, [makeLine({ quantity: 2 })], 'RUB'),
    ).toEqual({
      email: 'mila@example.com',
      currency: 'RUB',
      shipping: {
        name: 'Мила Орлова',
        address: 'ул. Тверская, 14',
        city: 'Москва',
        zip: '125009',
        country: 'RU',
      },
      items: [{ variantId: 'variant-1', quantity: 2 }],
    });
  });

  it('carries no totals — pricing is the server’s job', () => {
    const parsed = parse(makeRaw());
    if (!parsed.ok) throw new Error('fixture should be valid');

    const request = buildOrderRequest(parsed.values, [makeLine()], 'RUB');

    expect(request).not.toHaveProperty('total');
    expect(request.items[0]).not.toHaveProperty('unitPrice');
  });
});

describe('buildOrderRequest currency', () => {
  it('sends the currency the shopper was browsing in', () => {
    const parsed = parse(makeRaw());
    if (!parsed.ok) throw new Error('fixture should be valid');

    expect(buildOrderRequest(parsed.values, [makeLine()], 'USD').currency).toBe('USD');
  });

  it('takes the currency from the argument, not from the cart lines', () => {
    const parsed = parse(makeRaw());
    if (!parsed.ok) throw new Error('fixture should be valid');

    // A cart line still tagged RUB must not quietly override what is charged —
    // the caller passes the active currency and the server prices from it.
    const request = buildOrderRequest(
      parsed.values,
      [makeLine({ currency: 'RUB' })],
      'USD',
    );

    expect(request.currency).toBe('USD');
  });
});
