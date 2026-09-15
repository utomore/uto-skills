export type Money = { readonly cents: number; readonly currency: string };
export type MoneyList = Money[];
export type MoneyError = 'currency-mismatch' | 'negative-total';
export type Settlement = { readonly total: Money | null; readonly error: MoneyError | null };

export function money(cents: number, currency: string): Money {
  return { cents, currency };
}

export function sumLines(lines: MoneyList): Settlement {
  if (lines.length === 0) return { total: money(0, 'TWD'), error: null };
  const currency = lines[0].currency;
  for (const l of lines) {
    if (l.currency !== currency) return { total: null, error: 'currency-mismatch' };
  }
  return { total: money(lines.reduce((n, l) => n + l.cents, 0), currency), error: null };
}

export function subtract(s: Settlement, d: Money): Settlement {
  if (s.total === null) return s;
  if (s.total.currency !== d.currency) return { total: null, error: 'currency-mismatch' };
  const left = s.total.cents - d.cents;
  if (left < 0) return { total: null, error: 'negative-total' };
  return { total: money(left, s.total.currency), error: null };
}

export function settle(lines: MoneyList, discount: Money): Settlement {
  return subtract(sumLines(lines), discount);
}

export function settled(s: Settlement): boolean {
  return s.total !== null;
}

export function cents(s: Settlement): number {
  return s.total === null ? -1 : s.total.cents;
}
