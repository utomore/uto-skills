import { checkout, paidCents } from '../app/checkout';
import { refund, returnedCents } from '../app/refund';
import { HttpReq, HttpRes } from '../app/wire';

export function checkoutHandler(req: HttpReq): HttpRes {
  const r = checkout(req.body);
  const paid = paidCents(r);
  return paid < 0 ? { status: 422, body: r.reason } : { status: 200, body: String(paid) };
}

export function refundHandler(req: HttpReq): HttpRes {
  const r = refund(req.body);
  const back = returnedCents(r);
  return back < 0 ? { status: 422, body: r.reason } : { status: 200, body: String(back) };
}
