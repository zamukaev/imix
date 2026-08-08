import type { Money } from '@imix/types';

const MINOR_UNITS_PER_MAJOR = 100;
const LOCALE = 'de-DE';
const CURRENCY = 'EUR';

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
});

/** Renders integer minor units as currency. `119900` → "1.199,00 €". */
export function formatMoney(amount: Money): string {
  return currencyFormatter.format(amount / MINOR_UNITS_PER_MAJOR);
}

/** "from 1.199,00 €" — the cheapest variant is what a catalogue tile advertises. */
export function formatPriceFrom(amount: Money): string {
  return `from ${formatMoney(amount)}`;
}
