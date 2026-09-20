import { checkout, paidCents, parseCheckout, reqDiscount, reqLines } from '../src/app/checkout';
import { parseRefund, refund, refundFee, refundLines, returnedCents } from '../src/app/refund';
import { cents, settle } from '../src/domain/money';

describe('R-1#ACCEPT 結帳照結算金額收錢', () => {
  it('holds', () => {
    for (const raw of ['c1|100,50|20', 'o1|100,50|30', '', '!!!']) {
      const c = parseCheckout(raw);
      expect(paidCents(checkout(raw))).toBe(cents(settle(reqLines(c), reqDiscount(c))));
    }
  });
});

describe('R-3#ACCEPT 退款照同一條結算退錢', () => {
  it('holds', () => {
    for (const raw of ['c1|100,50|20', 'o1|100,50|30', '', '!!!']) {
      const r = parseRefund(raw);
      expect(returnedCents(refund(raw))).toBe(cents(settle(refundLines(r), refundFee(r))));
    }
  });
});
