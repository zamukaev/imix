import { z } from 'zod';
import type { CreateOrderItemDto, CreateOrderRequest, Currency } from '@imix/types';
import type { CartLine } from './cart';

/**
 * Checkout domain logic — form parsing and the cart → order mapping — kept free
 * of React so it can be tested on its own, like `cart.ts`.
 */

/**
 * Where iMIX ships today: Russia and its neighbours. Widening this list is the
 * only change needed to grow — the names are rendered with `Intl.DisplayNames`
 * in the active language, so there is no name table to keep in step.
 */
export const SHIPPING_COUNTRY_CODES = ['RU', 'BY', 'KZ', 'AM', 'KG'] as const;

export type ShippingCountry = (typeof SHIPPING_COUNTRY_CODES)[number];

const MAX_NAME_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 200;
const MAX_CITY_LENGTH = 100;
const MAX_ZIP_LENGTH = 16;

/** The messages the schema needs, keyed the same as the `validation` namespace. */
export type ValidationMessages = {
  email: string;
  name: string;
  nameTooLong: string;
  address: string;
  addressTooLong: string;
  city: string;
  cityTooLong: string;
  zip: string;
  zipTooLong: string;
  country: string;
};

/**
 * Mirrors the API's `CreateOrderDto`. Validating here is a courtesy to the
 * shopper — the server validates again and is the one that decides.
 *
 * Built per call rather than once at module scope because the messages are
 * translated, and a schema frozen at import time would be frozen in one
 * language.
 */
export function createShippingFormSchema(messages: ValidationMessages) {
  return z.object({
    email: z.email(messages.email),
    name: z
      .string()
      .trim()
      .min(1, messages.name)
      .max(MAX_NAME_LENGTH, messages.nameTooLong),
    address: z
      .string()
      .trim()
      .min(1, messages.address)
      .max(MAX_ADDRESS_LENGTH, messages.addressTooLong),
    city: z
      .string()
      .trim()
      .min(1, messages.city)
      .max(MAX_CITY_LENGTH, messages.cityTooLong),
    zip: z
      .string()
      .trim()
      .min(1, messages.zip)
      .max(MAX_ZIP_LENGTH, messages.zipTooLong),
    country: z.enum(SHIPPING_COUNTRY_CODES, messages.country),
  });
}

export type ShippingFormValues = z.infer<ReturnType<typeof createShippingFormSchema>>;

export type ShippingFieldErrors = Partial<Record<keyof ShippingFormValues, string>>;

/** The raw strings as typed, kept so a rejected form can be re-rendered filled in. */
export type ShippingFormRaw = Record<keyof ShippingFormValues, string>;

/** Starting point for the form — `country` is pre-selected, the rest is blank. */
export const EMPTY_SHIPPING_FORM: ShippingFormRaw = {
  email: '',
  name: '',
  address: '',
  city: '',
  zip: '',
  country: 'RU',
};

export type ShippingFormResult =
  { ok: true; values: ShippingFormValues } | { ok: false; fieldErrors: ShippingFieldErrors };

/**
 * The field names, independent of any one schema instance — the shape does not
 * change between languages, only the messages do.
 */
const FORM_FIELDS = [
  'email',
  'name',
  'address',
  'city',
  'zip',
  'country',
] as const satisfies readonly (keyof ShippingFormValues)[];

function isFormField(key: PropertyKey): key is keyof ShippingFormValues {
  return FORM_FIELDS.some((field) => field === key);
}

/** Lifts a `FormData` entry to a string; files and absent fields read as empty. */
function readField(formData: FormData, field: keyof ShippingFormValues): string {
  const value = formData.get(field);

  return typeof value === 'string' ? value : '';
}

export function readShippingForm(formData: FormData): ShippingFormRaw {
  return {
    email: readField(formData, 'email'),
    name: readField(formData, 'name'),
    address: readField(formData, 'address'),
    city: readField(formData, 'city'),
    zip: readField(formData, 'zip'),
    country: readField(formData, 'country'),
  };
}

/**
 * Validates the shipping form. Only the first problem per field is kept — a
 * field shows one message at a time, so collecting more would be noise.
 */
export function parseShippingForm(
  raw: ShippingFormRaw,
  messages: ValidationMessages,
): ShippingFormResult {
  const result = createShippingFormSchema(messages).safeParse(raw);

  if (result.success) {
    return { ok: true, values: result.data };
  }

  const fieldErrors: ShippingFieldErrors = {};

  for (const issue of result.error.issues) {
    const [field] = issue.path;

    if (field !== undefined && isFormField(field) && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return { ok: false, fieldErrors };
}

/**
 * Reduces cart lines to what the API accepts: identity and amount. Prices,
 * names and images stay behind — the server prices the order from its own data.
 */
export function toOrderItems(lines: readonly CartLine[]): CreateOrderItemDto[] {
  return lines.map((line) => ({
    variantId: line.variantId,
    quantity: line.quantity,
  }));
}

export function buildOrderRequest(
  values: ShippingFormValues,
  lines: readonly CartLine[],
  currency: Currency,
): CreateOrderRequest {
  return {
    email: values.email,
    currency,
    shipping: {
      name: values.name,
      address: values.address,
      city: values.city,
      zip: values.zip,
      country: values.country,
    },
    items: toOrderItems(lines),
  };
}
