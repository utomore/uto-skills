import { refund, returnedCents } from '../src/app/refund';

describe('F-002#LAW-1 退回的錢等於結算金額', () => { it('holds', () => { expect(returnedCents(refund('o1|100,50|30'))).toBe(120); }); });
describe('F-002#LAW-2 不拋例外', () => { it('holds', () => { expect(returnedCents(refund('???'))).toBeDefined(); }); });
describe('F-002#EX-1', () => { it('holds', () => { expect(returnedCents(refund('o1|100,50|30'))).toBe(120); }); });
describe('F-002#EX-2', () => { it('holds', () => { expect(returnedCents(refund('o1|10|30'))).toBe(-1); }); });
