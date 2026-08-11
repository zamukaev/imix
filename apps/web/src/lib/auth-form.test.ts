import { describe, expect, it } from 'vitest';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@imix/types';
import {
  EMPTY_AUTH_FORM,
  parseAuthForm,
  readAuthForm,
  type AuthFormRaw,
  type AuthValidationMessages,
} from './auth-form';

/**
 * The schemas are built from translated messages, so the tests supply their
 * own. Identifiable strings rather than real copy: an assertion about *which*
 * rule failed should not break when the Russian wording is polished.
 */
const MESSAGES: AuthValidationMessages = {
  email: 'invalid-email',
  password: 'missing-password',
  passwordTooShort: 'password-too-short',
  passwordTooLong: 'password-too-long',
  nameTooLong: 'name-too-long',
};

function makeRaw(overrides: Partial<AuthFormRaw> = {}): AuthFormRaw {
  return {
    email: 'mila@example.com',
    password: 'correct-horse-battery',
    name: 'Мила',
    ...overrides,
  };
}

const login = (raw: AuthFormRaw) => parseAuthForm(raw, 'login', MESSAGES);
const register = (raw: AuthFormRaw) => parseAuthForm(raw, 'register', MESSAGES);

describe('readAuthForm', () => {
  it('reads the three fields as strings', () => {
    const formData = new FormData();
    formData.set('email', 'mila@example.com');
    formData.set('password', 'correct-horse-battery');
    formData.set('name', 'Мила');

    expect(readAuthForm(formData)).toEqual(makeRaw());
  });

  it('reads an absent field as empty rather than undefined', () => {
    expect(readAuthForm(new FormData())).toEqual(EMPTY_AUTH_FORM);
  });
});

describe('parseAuthForm', () => {
  it('accepts a filled-in sign-up', () => {
    const result = register(makeRaw());

    expect(result.ok).toBe(true);
  });

  it('lower-cases and trims the address, matching what the API stores', () => {
    const result = register(makeRaw({ email: '  Mila@Example.COM  ' }));

    expect(result.ok && result.values.email).toBe('mila@example.com');
  });

  it('leaves the password exactly as typed', () => {
    // Spaces at either end are part of a password somebody may have chosen on
    // purpose; trimming them would lock them out of the account they created.
    const padded = '  spaced password  ';
    const result = register(makeRaw({ password: padded }));

    expect(result.ok && result.values.password).toBe(padded);
  });

  it('trims the name', () => {
    const result = register(makeRaw({ name: '  Мила  ' }));

    expect(result.ok && result.values.name).toBe('Мила');
  });

  it('accepts a sign-up with no name', () => {
    const result = register(makeRaw({ name: '' }));

    expect(result.ok).toBe(true);
  });

  it.each([
    ['no @ at all', 'not-an-email'],
    ['nothing before the @', '@example.com'],
    ['an empty field', ''],
  ])('rejects an address with %s', (_label, email) => {
    const result = login(makeRaw({ email }));

    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors.email).toBe('invalid-email');
  });

  it('rejects a sign-up password below the shared minimum', () => {
    const result = register(makeRaw({ password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1) }));

    expect(!result.ok && result.fieldErrors.password).toBe('password-too-short');
  });

  it('rejects a sign-up password above the shared maximum', () => {
    const result = register(makeRaw({ password: 'a'.repeat(MAX_PASSWORD_LENGTH + 1) }));

    expect(!result.ok && result.fieldErrors.password).toBe('password-too-long');
  });

  it('lets a short password through on sign-in', () => {
    // On sign-in a short password is simply a wrong one. Enforcing the minimum
    // here would tell whoever is guessing what the policy is, and would lock
    // out anyone whose account predates a future change to it.
    const result = login(makeRaw({ password: 'short' }));

    expect(result.ok).toBe(true);
  });

  it('still requires a password on sign-in', () => {
    const result = login(makeRaw({ password: '' }));

    expect(!result.ok && result.fieldErrors.password).toBe('missing-password');
  });

  it('keeps one message per field', () => {
    const result = register(makeRaw({ email: 'nope', password: 'x' }));

    expect(!result.ok && result.fieldErrors).toEqual({
      email: 'invalid-email',
      password: 'password-too-short',
    });
  });
});
