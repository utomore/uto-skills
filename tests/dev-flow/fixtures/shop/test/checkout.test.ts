import { checkout, paidCents } from '../src/app/checkout';

describe('F-001#LAW-1 訂單付的錢等於結算金額', () => { it('holds', () => { expect(paidCents(checkout('c1|100,50|20'))).toBe(130); }); });
describe('F-001#LAW-2 不拋例外', () => { it('holds', () => { expect(paidCents(checkout('!!!'))).toBeDefined(); }); });
describe('F-001#LAW-3 成單時不為負', () => { it('holds', () => { expect(paidCents(checkout('c1|100|20'))).toBeGreaterThanOrEqual(0); }); });
describe('F-001#EX-1', () => { it('holds', () => { expect(paidCents(checkout('c1|100,50|20'))).toBe(130); }); });
describe('F-001#EX-2', () => { it('holds', () => { expect(paidCents(checkout('c1|100|300'))).toBe(-1); }); });
describe('F-001#EX-3', () => { it('holds', () => { expect(paidCents(checkout(''))).toBe(0); }); });
