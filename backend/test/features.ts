/* E2E for coupon rules, payout requests and review moderation/replies.
   Needs: ADMIN_EMAIL/ADMIN_PASSWORD (existing admin), DATABASE_URL, API (default http://localhost:4000/api). */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.API ?? 'http://localhost:4000/api';
const prisma = new PrismaClient();
let failed = 0;

async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* empty */ }
  return { status: res.status, json };
}
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ->  ' + JSON.stringify(detail)}`);
}
const run = Date.now().toString(36);
const iso = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const PNG = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='.repeat(2);
const bk = (day: string, slot = '11:00', coupon?: string) => ({ serviceId: 1, day, slot, name: 'E2E Cust', phone: '9876500111', address: '1 Test Rd', ...(coupon ? { coupon } : {}) });

async function main() {
  let r = await call('POST', '/auth/login', { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
  const admin = r.json.accessToken as string;
  check('admin login', r.status === 200, r.status);

  const reg = async (n: string) => {
    const x = await call('POST', '/auth/register', { body: { name: n, email: `${n.replace(/\s/g, '').toLowerCase()}_${run}@example.com`, phone: '9876500111', password: 'Passw0rd!x' } });
    const me = await call('GET', '/auth/me', { token: x.json.accessToken });
    return { token: x.json.accessToken as string, id: me.json.id as string };
  };
  const c1 = await reg('Coupon One');
  const c2 = await reg('Coupon Two');
  const c3 = await reg('Coupon Three');
  const price = (await call('GET', '/services')).json.find((s: any) => s.id === 1).fromPrice as number;

  /* ---------- Coupons ---------- */
  const code = `E2E${run}`.toUpperCase();
  const cap = Math.floor(price / 4);
  r = await call('POST', '/admin/coupons', { token: admin, body: { code, percent: 50, maxDiscount: cap, minOrder: price + 1, usageLimit: 2, perUserLimit: 1 } });
  check('coupon: create with rules', r.status === 201 && r.json.usageLimit === 2 && r.json.minOrder === price + 1, r);
  r = await call('GET', `/orders/coupon/${code}?amount=${price}`, { token: c1.token });
  check('coupon: preview below minimum rejected', r.status === 400 && /minimum/i.test(r.json.message), r);
  r = await call('PATCH', `/admin/coupons/${code}`, { token: admin, body: { minOrder: null } });
  check('coupon: clearing a rule with null', r.status === 200 && r.json.minOrder === null, r);
  r = await call('GET', `/orders/coupon/${code}?amount=${price}`, { token: c1.token });
  check('coupon: preview applies the cap', r.status === 200 && r.json.discount === cap, r);

  r = await call('POST', '/bookings', { token: c1.token, body: bk(iso(5), '09:00', code) });
  check('coupon: booking gets capped discount', r.status === 201 && r.json.discount === cap && r.json.estimate === price - cap, r);
  r = await call('POST', '/bookings', { token: c1.token, body: bk(iso(6), '09:00', code) });
  check('coupon: same customer cannot reuse (perUserLimit)', r.status === 400 && /already used/i.test(r.json.message), r);
  r = await call('POST', '/bookings', { token: c2.token, body: bk(iso(7), '09:00', code) });
  check('coupon: second customer can use it', r.status === 201, r);
  const c2booking = r.json.id as string;
  r = await call('POST', '/bookings', { token: c3.token, body: bk(iso(8), '09:00', code) });
  check('coupon: total limit reached (usageLimit)', r.status === 400 && /fully redeemed/i.test(r.json.message), r);
  r = await call('PATCH', `/bookings/${c2booking}`, { token: c2.token, body: { status: 'CANCELLED', reason: 'e2e' } });
  check('coupon: customer cancels the booking', r.status === 200 && r.json.status === 'CANCELLED', r);
  r = await call('POST', '/bookings', { token: c3.token, body: bk(iso(8), '09:00', code) });
  check('coupon: cancelling a booking frees its use', r.status === 201, r);
  r = await call('GET', '/admin/coupons', { token: admin });
  check('coupon: admin list shows uses', r.json.find((c: any) => c.code === code)?.uses === 2, r.json.find?.((c: any) => c.code === code));
  await call('PATCH', `/admin/coupons/${code}`, { token: admin, body: { expiresAt: new Date(Date.now() - 1000).toISOString() } });
  r = await call('GET', `/orders/coupon/${code}`, { token: c1.token });
  check('coupon: expired code rejected', r.status === 400 && /expired/i.test(r.json.message), r);
  await call('DELETE', `/admin/coupons/${code}`, { token: admin });

  /* ---------- A pro with completed work ---------- */
  const proEmail = `e2epro_${run}@example.com`;
  await call('POST', '/auth/register', { body: { name: 'E2E Pro', email: proEmail, phone: '9876500222', password: 'Passw0rd!x' } });
  r = await call('POST', '/admin/providers', { token: admin, body: { name: 'E2E Pro', years: 3, response: '10 min', verified: true, serviceIds: [1] } });
  const pid = r.json.id as number;
  await call('PATCH', `/admin/providers/${pid}/link`, { token: admin, body: { email: proEmail } });
  const pro = (await call('POST', '/auth/login', { body: { email: proEmail, password: 'Passw0rd!x' } })).json.accessToken as string;
  await call('POST', '/pro/kyc', { token: pro, body: { docType: 'PAN', docNumber: 'ABCDE1234F', docImage: PNG } });
  await call('PATCH', `/admin/kyc/${pid}`, { token: admin, body: { decision: 'APPROVED' } });
  const proUser = await prisma.user.findUnique({ where: { email: proEmail } });
  const commission = (await prisma.provider.findUnique({ where: { id: pid } }))!.commissionPercent;
  const b1 = await prisma.booking.create({ data: { id: `E2E${run}1`.toUpperCase(), userId: c1.id, serviceId: 1, providerId: pid, day: iso(-1), slot: '09:00', name: 'E2E', phone: '9876500111', address: 'x', estimate: 1000, status: 'DONE' } });
  const net = Math.round(1000 * (100 - commission) / 100);

  /* ---------- Payout requests ---------- */
  r = await call('GET', '/pro/earnings', { token: pro });
  check('payout: balance due reflects completed job', r.json.balanceDue === net, r.json);
  r = await call('POST', '/pro/payout-requests', { token: pro, body: { amount: net + 100, details: 'e2e@upi' } });
  check('payout: request above balance rejected', r.status === 400, r);
  r = await call('POST', '/pro/payout-requests', { token: pro, body: { amount: 100, details: 'ab' } });
  check('payout: details too short rejected', r.status === 400, r.status);
  r = await call('POST', '/pro/payout-requests', { token: pro, body: { amount: 200, details: 'e2e@upi' } });
  check('payout: request created', r.status === 201 && r.json.status === 'REQUESTED', r);
  const req1 = r.json.id as string;
  r = await call('POST', '/pro/payout-requests', { token: pro, body: { amount: 100, details: 'e2e@upi' } });
  check('payout: only one open request at a time', r.status === 409, r.status);
  r = await call('POST', '/pro/payout-requests', { token: c1.token, body: { amount: 100, details: 'e2e@upi' } });
  check('payout: customers cannot request', r.status === 403 || r.status === 404, r.status);
  r = await call('GET', '/admin/payout-requests', { token: admin });
  check('payout: admin queue lists it with pro name', r.json.some((x: any) => x.id === req1 && x.name === 'E2E Pro'), r.json?.slice?.(0, 2));
  r = await call('PATCH', `/admin/payout-requests/${req1}`, { token: admin, body: { decision: 'REJECTED' } });
  check('payout: declining needs a reason', r.status === 400, r);
  r = await call('PATCH', `/admin/payout-requests/${req1}`, { token: admin, body: { decision: 'REJECTED', note: 'Bank details unclear' } });
  check('payout: decline', r.status === 200 && r.json.status === 'REJECTED', r);
  r = await call('PATCH', `/admin/payout-requests/${req1}`, { token: admin, body: { decision: 'PAID' } });
  check('payout: already-handled request -> 409', r.status === 409, r);
  r = await call('GET', '/pro/earnings', { token: pro });
  check('payout: decline leaves balance untouched', r.json.balanceDue === net && r.json.paidOut === 0, r.json);
  r = await call('POST', '/pro/payout-requests', { token: pro, body: { amount: 300, details: 'e2e@upi' } });
  const req2 = r.json.id as string;
  check('payout: can request again after a decline', r.status === 201, r);
  r = await call('PATCH', `/admin/payout-requests/${req2}`, { token: admin, body: { decision: 'PAID', note: 'UTR123' } });
  check('payout: mark paid', r.status === 200 && r.json.status === 'PAID', r);
  r = await call('GET', '/pro/earnings', { token: pro });
  check('payout: paid request lands in ledger and reduces balance', r.json.paidOut === 300 && r.json.balanceDue === net - 300, r.json);
  r = await call('GET', '/pro/payouts', { token: pro });
  check('payout: ledger entry visible to pro', r.json.length === 1 && r.json[0].amount === 300, r.json);
  const notes = await prisma.notification.findMany({ where: { userId: proUser!.id } });
  check('payout: pro notified of both decisions', notes.some((n) => /declined/.test(n.text)) && notes.some((n) => /has been sent/.test(n.text)), notes.map((n) => n.text));

  /* ---------- Reviews ---------- */
  r = await call('POST', '/reviews', { token: c1.token, body: { kind: 'service', target: 1, bookingId: b1.id, rating: 5, text: 'Great work' } });
  check('review: customer posts a review', r.status === 201, r);
  const rid = r.json.id as string;
  const rn = await prisma.notification.findMany({ where: { userId: proUser!.id, text: { contains: 'review' } } });
  check('review: pro is notified', rn.length === 1 && rn[0].href === '/reviews', rn);
  r = await call('POST', '/reviews', { token: c1.token, body: { kind: 'service', target: 1, bookingId: b1.id, rating: 4 } });
  check('review: duplicate on same booking -> 409', r.status === 409, r.status);
  r = await call('GET', '/pro/reviews', { token: pro });
  check('review: shows in pro summary', r.json.count === 1 && r.json.items[0].reply === null, r.json);
  r = await call('POST', `/pro/reviews/${rid}/reply`, { token: pro, body: { text: 'Thank you!' } });
  check('review: pro replies', r.status === 201 && r.json.reply === 'Thank you!', r);
  r = await call('GET', '/reviews?kind=service&target=1');
  check('review: reply is public', r.json.find((x: any) => x.id === rid)?.reply === 'Thank you!', r.json?.slice?.(0, 2));
  r = await call('POST', `/pro/reviews/${rid}/reply`, { token: c1.token, body: { text: 'hax' } });
  check("review: customer can't reply", r.status === 403 || r.status === 404, r.status);
  r = await call('POST', `/pro/reviews/${rid}/reply`, { token: pro, body: { text: '   ' } });
  check('review: empty reply removes it', r.status === 201 && r.json.reply === null, r);
  const before = (await call('GET', '/services')).json.find((s: any) => s.id === 1);
  r = await call('PATCH', `/admin/reviews/${rid}`, { token: admin, body: { hidden: true } });
  check('review: admin hides', r.status === 200 && r.json.hidden === true, r);
  r = await call('GET', '/reviews?kind=service&target=1');
  check('review: hidden review gone from public list', !r.json.some((x: any) => x.id === rid), r.json);
  r = await call('GET', '/pro/reviews', { token: pro });
  check('review: hidden review gone from pro summary', r.json.count === 0, r.json);
  const after = (await call('GET', '/services')).json.find((s: any) => s.id === 1);
  check('review: hidden review leaves the service average', after.reviews === before.reviews - 1, { before: before.reviews, after: after.reviews });
  r = await call('GET', '/admin/reviews', { token: admin });
  check('review: admin still sees it, marked hidden', r.json.find((x: any) => x.id === rid)?.hidden === true, r.status);
  r = await call('PATCH', `/admin/reviews/${rid}`, { token: admin, body: { hidden: false } });
  check('review: admin shows it again', r.status === 200, r);

  /* customers can edit their own review; the pro's reply survives */
  await call('POST', `/pro/reviews/${rid}/reply`, { token: pro, body: { text: 'Thanks again' } });
  r = await call('PATCH', `/reviews/${rid}`, { token: c1.token, body: { rating: 3, text: 'Changed my mind' } });
  check('review: customer edits own review', r.status === 200 && r.json.rating === 3 && r.json.text === 'Changed my mind' && r.json.reply === 'Thanks again', r);
  r = await call('PATCH', `/reviews/${rid}`, { token: c2.token, body: { rating: 1 } });
  check("review: someone else can't edit it", r.status === 404, r.status);
  r = await call('PATCH', `/reviews/${rid}`, { token: c1.token, body: { rating: 9 } });
  check('review: edit validates the rating', r.status === 400, r.status);
  r = await call('GET', '/reviews?kind=service&target=1&skip=1000');
  check('review: skip pages past the end', r.status === 200 && r.json.length === 0, r.status);

  /* push opt-out */
  r = await call('GET', '/notification-settings', { token: c1.token });
  check('push: enabled by default', r.status === 200 && r.json.push === true, r);
  r = await call('PUT', '/notification-settings', { token: c1.token, body: { push: false } });
  check('push: can be turned off', r.status === 200 && r.json.push === false, r);
  r = await call('GET', '/notification-settings', { token: c1.token });
  check('push: setting persists', r.json.push === false, r);
  await call('PUT', '/notification-settings', { token: c1.token, body: { push: true } });
  r = await call('PUT', '/notification-settings', { token: c1.token, body: { push: 'no' } });
  check('push: rejects a bad value', r.status === 400, r.status);

  /* product review needs a delivered order */
  r = await call('POST', '/orders', { token: c1.token, body: { name: 'E2E', phone: '9876500111', address: '1 Rd', city: 'Kochi', pin: '682001', items: [{ productId: 2, qty: 1 }] } });
  const oid = r.json.id as string;
  r = await call('POST', '/reviews', { token: c1.token, body: { kind: 'product', target: 2, rating: 4 } });
  check('review: product review blocked before delivery', r.status === 400, r);
  await call('PATCH', `/admin/orders/${oid}/status`, { token: admin, body: { status: 'DELIVERED' } });
  r = await call('POST', '/reviews', { token: c1.token, body: { kind: 'product', target: 2, rating: 4 } });
  check('review: product review allowed once delivered', r.status === 201, r);
  r = await call('POST', '/reviews', { token: c1.token, body: { kind: 'product', target: 2, rating: 3 } });
  check('review: second review of same product -> 409', r.status === 409, r);

  /* clean up what this run created */
  await prisma.review.deleteMany({ where: { userId: { in: [c1.id, c2.id, c3.id] } } });
  await prisma.booking.deleteMany({ where: { OR: [{ userId: { in: [c1.id, c2.id, c3.id] } }, { providerId: pid }] } });
  await prisma.order.deleteMany({ where: { userId: c1.id } });
  await prisma.payoutRequest.deleteMany({ where: { providerId: pid } });
  await prisma.payout.deleteMany({ where: { providerId: pid } });

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
