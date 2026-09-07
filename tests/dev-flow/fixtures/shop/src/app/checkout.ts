import { Money, MoneyList, Settlement, cents, money, settle, settled } from '../domain/money';
import { CheckoutReq, RawBody } from './wire';

export type Order = { readonly id: string; readonly paid: Money };
export type CheckoutResult = { readonly order: Order | null; readonly reason: string };

export function parseCheckout(raw: RawBody): CheckoutReq {
  const parts = raw.split('|');
  const cartId = parts[0] || 'anon';
  const lines: MoneyList = (parts[1] || '')
    .split(',')
    .filter((s) => s.length > 0)
    .map((s) => money(Math.max(0, Number(s) | 0), 'TWD'));
  return { cartId, lines, discount: money(Math.max(0, Number(parts[2] || 0) | 0), 'TWD') };
}

export function reqLines(r: CheckoutReq): MoneyList {
  return r.lines;
}

export function reqDiscount(r: CheckoutReq): Money {
  return r.discount;
}

export function toOrder(r: CheckoutReq, s: Settlement): CheckoutResult {
  if (!settled(s)) return { order: null, reason: s.error || 'unknown' };
  return { order: { id: r.cartId, paid: { cents: cents(s), currency: 'TWD' } }, reason: 'ok' };
}

export function paidCents(r: CheckoutResult): number {
  return r.order === null ? -1 : r.order.paid.cents;
}

export function checkout(raw: RawBody): CheckoutResult {
  const req = parseCheckout(raw);
  return toOrder(req, settle(reqLines(req), reqDiscount(req)));
}
