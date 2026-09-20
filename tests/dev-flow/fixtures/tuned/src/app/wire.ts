import { Money, MoneyList } from '../domain/money';

export type RawBody = string;
export type HttpReq = { readonly path: string; readonly body: RawBody };
export type HttpRes = { readonly status: number; readonly body: string };

export type CheckoutReq = { readonly cartId: string; readonly lines: MoneyList; readonly discount: Money };
export type RefundReq = { readonly orderId: string; readonly lines: MoneyList; readonly fee: Money };
