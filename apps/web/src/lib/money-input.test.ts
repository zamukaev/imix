import { describe, expect, it } from 'vitest';
import { formatMoneyInput, parseMoneyInput } from './money-input';

describe('parseMoneyInput', () => {
  it.each([
    ['149990', 14_999_000],
    ['0', 0],
    ['1', 100],
  ])('reads %s as %i minor units', (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each([
    ['a decimal point', '1999.99', 199_999],
    ['a decimal comma, as a Russian keyboard types it', '1999,99', 199_999],
    ['one decimal place', '1999.5', 199_950],
  ])('handles %s', (_label, input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each([
    ['plain spaces', '149 990'],
    ['a non-breaking space, as pasted from a spreadsheet', '149 990'],
  ])('ignores thousands grouped with %s', (_label, input) => {
    expect(parseMoneyInput(input)).toBe(14_999_000);
  });

  it('does not lose a kopeck to floating point', () => {
    // `19.99 * 100` is 1998.9999999999998. This is why the parser multiplies
    // integers instead.
    expect(parseMoneyInput('19.99')).toBe(1999);
    expect(parseMoneyInput('0.07')).toBe(7);
  });

  it.each([
    ['an empty field', ''],
    ['letters', 'много'],
    ['a negative amount', '-100'],
    ['three decimal places', '10.001'],
    ['two separators', '1.0.0'],
    ['a bare separator', '.'],
    ['a currency symbol', '149990 ₽'],
  ])('refuses %s', (_label, input) => {
    // Null rather than 0: an unparseable price has to stop the submission, and
    // 0 is a price somebody might have meant.
    expect(parseMoneyInput(input)).toBeNull();
  });
});

describe('formatMoneyInput', () => {
  it.each([
    [14_999_000, '149990'],
    [0, '0'],
    [199_999, '1999.99'],
    [199_950, '1999.50'],
    [7, '0.07'],
  ])('renders %i as %s', (amount, expected) => {
    expect(formatMoneyInput(amount)).toBe(expected);
  });

  it('round-trips every amount the form can produce', () => {
    for (const amount of [0, 1, 7, 99, 100, 1999, 199_950, 14_999_000]) {
      expect(parseMoneyInput(formatMoneyInput(amount))).toBe(amount);
    }
  });
});
