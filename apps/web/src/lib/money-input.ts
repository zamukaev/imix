import type { Money } from '@imix/types';

/**
 * Turning what an admin types into what the API stores.
 *
 * The API speaks integer minor units — 14999000 is 149 990 ₽ — because that is
 * the only representation money can survive arithmetic in. Nobody types that.
 * So the form works in major units and converts here, in one place, with tests:
 * a form that quietly dropped two zeroes would put a phone on sale for 1 499 ₽.
 */
const MINOR_UNITS_PER_MAJOR = 100;

const MINOR_UNIT_DIGITS = 2;

/**
 * A number with at most two decimal places, written with either separator.
 *
 * The comma is not a nicety: a Russian keyboard's numeric comma is what a
 * Russian admin will type, and rejecting it would read as a broken field.
 */
const AMOUNT_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;

/**
 * Parses a major-unit amount into minor units, or `null` if it is not one.
 *
 * `null` rather than 0 or NaN: an unparseable price has to stop the submission,
 * and 0 is a price somebody might have meant.
 */
export function parseMoneyInput(input: string): Money | null {
  // Spaces are how both locales group thousands, and a paste from a spreadsheet
  // brings non-breaking ones. `\s` already covers those — it includes U+00A0 and
  // U+202F — so this needs no character class of its own.
  const cleaned = input.replace(/\s/g, '');

  if (!AMOUNT_PATTERN.test(cleaned)) {
    return null;
  }

  const [major = '0', minor = ''] = cleaned.replace(',', '.').split('.');

  // Multiplied as integers rather than `Number(x) * 100`: 19.99 * 100 is
  // 1998.9999999999998 in binary floating point, and rounding that is a habit
  // this codebase does not want to acquire.
  return (
    Number(major) * MINOR_UNITS_PER_MAJOR +
    Number(minor.padEnd(MINOR_UNIT_DIGITS, '0'))
  );
}

/**
 * The inverse, for filling the form from the database. Trailing zeroes are
 * dropped — "149990" reads as a price, "149990.00" reads as a spreadsheet.
 */
export function formatMoneyInput(amount: Money): string {
  const major = Math.trunc(amount / MINOR_UNITS_PER_MAJOR);
  const minor = Math.abs(amount % MINOR_UNITS_PER_MAJOR);

  if (minor === 0) {
    return String(major);
  }

  return `${major}.${String(minor).padStart(MINOR_UNIT_DIGITS, '0')}`;
}
