import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format integer cents into a localized, currency-symbol string. */
export function formatPrice(cents: number, currency = 'usd') {
  const currencySymbols: Record<string, string> = {
    usd: '$', eur: '€', gbp: '£', cny: '¥', jpy: '¥',
  };
  const value = (cents / 100).toFixed(2);
  const symbol = currencySymbols[currency] ?? moneyUnit(currency);
  return `${symbol}${value}`;
}

function moneyUnit(currency: string): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency.toUpperCase();
  } catch {
    return currency.toUpperCase();
  }
}
