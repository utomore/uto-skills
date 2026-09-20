import { checkout, paidCents } from '../src/app/checkout';
import { cents, money, settle, settled, sumLines } from '../src/domain/money';

describe('F-001#LAW-1 訂單付的錢等於結算金額', () => { it('holds', () => { expect(paidCents(checkout('c1|100,50|20'))).toBe(130); }); });
describe('F-001#LAW-2 不拋例外', () => { it('holds', () => { expect(paidCents(checkout('!!!'))).toBeDefined(); }); });
describe('F-001#LAW-3 成單時不為負', () => { it('holds', () => { expect(paidCents(checkout('c1|100|20'))).toBeGreaterThanOrEqual(0); }); });
describe('F-001#LAW-4 結算成功時金額不為負', () => {
  it('holds', () => { expect(cents(settle([money(100, 'TWD')], money(20, 'TWD')))).toBeGreaterThanOrEqual(0); });
});
describe('F-001#LAW-5 扣掉的金額是零時等於相加', () => {
  it('holds', () => { expect(cents(settle([money(100, 'TWD')], money(0, 'TWD')))).toBe(cents(sumLines([money(100, 'TWD')]))); });
});
describe('F-001#LAW-6 結算不拋例外', () => {
  it('holds', () => { expect(settled(settle([], money(0, 'TWD')))).toBe(true); });
});
describe('F-001#EX-1', () => { it('holds', () => { expect(paidCents(checkout('c1|100,50|20'))).toBe(130); }); });
describe('F-001#EX-2', () => { it('holds', () => { expect(paidCents(checkout('c1|100|300'))).toBe(-1); }); });
describe('F-001#EX-3', () => { it('holds', () => { expect(paidCents(checkout(''))).toBe(0); }); });
describe('F-001#EX-4', () => {
  it('holds', () => { expect(cents(settle([money(100, 'TWD'), money(50, 'TWD')], money(20, 'TWD')))).toBe(130); });
});
describe('F-001#EX-5', () => {
  it('holds', () => { expect(cents(settle([money(100, 'TWD')], money(300, 'TWD')))).toBe(-1); });
});
