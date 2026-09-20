import { cents, money, settle, settled } from '../src/domain/money';

describe('INV-1#LAW 任何一條路徑結算出來的金額都不為負', () => {
  it('holds', () => {
    const lines = [[], [money(100, 'TWD')], [money(100, 'TWD'), money(50, 'TWD')], [money(100, 'TWD'), money(50, 'USD')]];
    const discounts = [money(0, 'TWD'), money(20, 'TWD'), money(500, 'TWD'), money(20, 'USD')];
    for (const ls of lines) for (const d of discounts) {
      const s = settle(ls, d);
      if (settled(s)) expect(cents(s)).toBeGreaterThanOrEqual(0);
    }
  });
});
