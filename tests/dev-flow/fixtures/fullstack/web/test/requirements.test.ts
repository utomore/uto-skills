import { checkout, paidCents, parseCheckout, reqDiscount, reqLines } from '../src/app/checkout';
import { parseRefund, refund, refundFee, refundLines, returnedCents } from '../src/app/refund';
import { cents, settle } from '../src/domain/money';

describe('R-1#ACCEPT 結帳與退款都照同一條結算', () => {
  it('holds', () => {
    for (const raw of ['c1|100,50|20', 'o1|100,50|30', '', '!!!']) {
      const c = parseCheckout(raw);
      expect(paidCents(checkout(raw))).toBe(cents(settle(reqLines(c), reqDiscount(c))));
      const r = parseRefund(raw);
      expect(returnedCents(refund(raw))).toBe(cents(settle(refundLines(r), refundFee(r))));
    }
  });
});
