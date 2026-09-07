import { cents, money, settle, settled, sumLines } from '../src/domain/money';

describe('A-001#LAW-1 結算成功時金額不為負', () => {
  it('holds', () => { expect(cents(settle([money(100, 'TWD')], money(20, 'TWD')))).toBeGreaterThanOrEqual(0); });
});
describe('A-001#LAW-2 折扣是零時等於相加', () => {
  it('holds', () => { expect(cents(settle([money(100, 'TWD')], money(0, 'TWD')))).toBe(cents(sumLines([money(100, 'TWD')]))); });
});
describe('A-001#LAW-3 不拋例外', () => {
  it('holds', () => { expect(settled(settle([], money(0, 'TWD')))).toBe(true); });
});
describe('A-001#EX-1', () => {
  it('holds', () => { expect(cents(settle([money(100, 'TWD'), money(50, 'TWD')], money(20, 'TWD')))).toBe(130); });
});
describe('A-001#EX-2', () => {
  it('holds', () => { expect(cents(settle([money(100, 'TWD')], money(300, 'TWD')))).toBe(-1); });
});
