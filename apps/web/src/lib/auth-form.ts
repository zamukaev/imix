import { z } from 'zod';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@imix/types';

/**
 * Sign-in and sign-up form logic, kept free of React so it can be tested on its
 * own — the same split as `checkout.ts`.
 *
 * Validating here is a courtesy: it saves a round trip and puts the message
 * next to the field. The API validates again and is the one that decides.
 */

const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 120;

/** The messages the schemas need, keyed the same as the `validation` namespace. */
export type AuthValidationMessages = {
  email: string;
  password: string;
  passwordTooShort: string;
  passwordTooLong: string;
  nameTooLong: string;
};

/**
 * Built per call rather than once at module scope: the messages are translated,
 * and a schema frozen at import time would be frozen in one language.
 */
export function createLoginFormSchema(messages: AuthValidationMessages) {
  return z.object({
    email: z.email(messages.email).max(MAX_EMAIL_LENGTH, messages.email),
    // Only "say something": on sign-in a short password is a wrong one, and a
    // length rule here would advertise the policy to whoever is guessing.
    password: z.string().min(1, messages.password),
  });
}

export function createRegisterFormSchema(messages: AuthValidationMessages) {
  return z.object({
    email: z.email(messages.email).max(MAX_EMAIL_LENGTH, messages.email),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, messages.passwordTooShort)
      .max(MAX_PASSWORD_LENGTH, messages.passwordTooLong),
    // Optional: a shop needs an address to ship to, not a name to sign up.
    name: z.string().trim().max(MAX_NAME_LENGTH, messages.nameTooLong),
  });
}

export type LoginFormValues = z.infer<ReturnType<typeof createLoginFormSchema>>;
export type RegisterFormValues = z.infer<ReturnType<typeof createRegisterFormSchema>>;

/** Everything either form can hold — one raw shape keeps the page state simple. */
export type AuthFormRaw = {
  email: string;
  password: string;
  name: string;
};

export type AuthFieldErrors = Partial<Record<keyof AuthFormRaw, string>>;

export const EMPTY_AUTH_FORM: AuthFormRaw = { email: '', password: '', name: '' };

export type AuthFormResult =
  | { ok: true; values: AuthFormRaw }
  | { ok: false; fieldErrors: AuthFieldErrors };

const FORM_FIELDS = ['email', 'password', 'name'] as const satisfies readonly (keyof AuthFormRaw)[];

function isFormField(key: PropertyKey): key is keyof AuthFormRaw {
  return FORM_FIELDS.some((field) => field === key);
}

/** Lifts a `FormData` entry to a string; files and absent fields read as empty. */
function readField(formData: FormData, field: keyof AuthFormRaw): string {
  const value = formData.get(field);

  return typeof value === 'string' ? value : '';
}

export function readAuthForm(formData: FormData): AuthFormRaw {
  return {
    email: readField(formData, 'email'),
    password: readField(formData, 'password'),
    name: readField(formData, 'name'),
  };
}

/**
 * Validates one of the two forms. Only the first problem per field is kept — a
 * field shows one message at a time, so collecting more would be noise.
 *
 * The email is lower-cased and the name trimmed on the way out, matching what
 * the API stores. Passwords are passed through untouched: leading and trailing
 * spaces are part of a password somebody may have typed on purpose.
 */
export function parseAuthForm(
  raw: AuthFormRaw,
  mode: 'login' | 'register',
  messages: AuthValidationMessages,
): AuthFormResult {
  const schema =
    mode === 'login'
      ? createLoginFormSchema(messages)
      : createRegisterFormSchema(messages);

  // Normalised *before* validating, in that order, because the API does the
  // same: its DTOs run `@Transform` and then the validators. Checking the raw
  // value first would reject "  Mila@Example.COM  " here and accept it there.
  const values: AuthFormRaw = {
    email: raw.email.trim().toLowerCase(),
    password: raw.password,
    name: raw.name.trim(),
  };
  const result = schema.safeParse(values);

  if (result.success) {
    return { ok: true, values };
  }

  const fieldErrors: AuthFieldErrors = {};

  for (const issue of result.error.issues) {
    const [field] = issue.path;

    if (field !== undefined && isFormField(field) && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return { ok: false, fieldErrors };
}
