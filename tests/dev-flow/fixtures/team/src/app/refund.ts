import { Money, MoneyList, Settlement, cents, money, settle, settled } from '../domain/money';
import { RawBody, RefundReq } from './wire';

export type Refund = { readonly orderId: string; readonly returned: Money };
export type RefundResult = { readonly refund: Refund | null; readonly reason: string };

export function parseRefund(raw: RawBody): RefundReq {
  const parts = raw.split('|');
  const orderId = parts[0] || 'anon';
  const lines: MoneyList = (parts[1] || '')
    .split(',')
    .filter((s) => s.length > 0)
    .map((s) => money(Math.max(0, Number(s) | 0), 'TWD'));
  return { orderId, lines, fee: money(Math.max(0, Number(parts[2] || 0) | 0), 'TWD') };
}

export function refundLines(r: RefundReq): MoneyList {
  return r.lines;
}

export function refundFee(r: RefundReq): Money {
  return r.fee;
}

export function toRefund(r: RefundReq, s: Settlement): RefundResult {
  if (!settled(s)) return { refund: null, reason: s.error || 'unknown' };
  return { refund: { orderId: r.orderId, returned: { cents: cents(s), currency: 'TWD' } }, reason: 'ok' };
}

export function returnedCents(r: RefundResult): number {
  return r.refund === null ? -1 : r.refund.returned.cents;
}

export function refund(raw: RawBody): RefundResult {
  const req = parseRefund(raw);
  return toRefund(req, settle(refundLines(req), refundFee(req)));
}
