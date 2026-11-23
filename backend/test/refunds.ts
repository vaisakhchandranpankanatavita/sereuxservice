/* E2E for the cancellation policy and partial refunds.
   Needs: ADMIN_EMAIL/ADMIN_PASSWORD (existing admin), DATABASE_URL, and an API started with
     RAZORPAY_KEY_ID=test RAZORPAY_KEY_SECRET=test RAZORPAY_API_BASE=http://localhost:4999/v1
   so refunds hit the mock Razorpay server this script starts on port 4999. */
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.API ?? 'http://localhost:4000/api';
const prisma = new PrismaClient();
let failed = 0;

const refunds: { payment: string; amount: number }[] = [];
const mock = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const m = req.url?.match(/\/payments\/([^/]+)\/refund/);
    if (m) refunds.push({ payment: m[1], amount: JSON.parse(body || '{}').amount });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ id: 'rfnd_mock' }));
  });
});

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
const PNG = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='.repeat(2);
const iso = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
let slotCounter = 0;

async function main() {
  await new Promise<void>((r) => mock.listen(4999, r));
  let r = await call('POST', '/auth/login', { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
  const admin = r.json.accessToken as string;
  check('admin login', r.status === 200, r);

  const reg = async (n: string) => (await call('POST', '/auth/register', { body: { name: n, email: `${n.replace(/\s/g, '').toLowerCase()}_${run}@example.com`, phone: '9876500777', password: 'Passw0rd!x' } })).json.accessToken as string;
  const cust = await reg('Refund Cust');
  const other = await reg('Refund Other');
  const proEmail = `rpro_${run}@example.com`;
  await call('POST', '/auth/register', { body: { name: 'Refund Pro', email: proEmail, phone: '9876500778', password: 'Passw0rd!x' } });
  r = await call('POST', '/admin/providers', { token: admin, body: { name: 'Refund Pro', years: 3, response: '10 min', verified: true, serviceIds: [1] } });
  const pid = r.json.id as number;
  await call('PATCH', `/admin/providers/${pid}/link`, { token: admin, body: { email: proEmail } });
  const pro = (await call('POST', '/auth/login', { body: { email: proEmail, password: 'Passw0rd!x' } })).json.accessToken as string;
  await call('POST', '/pro/kyc', { token: pro, body: { docType: 'PAN', docNumber: 'ABCDE1234F', docImage: PNG } });
  await call('PATCH', `/admin/kyc/${pid}`, { token: admin, body: { decision: 'APPROVED' } });

  await call('PUT', '/admin/settings/rules.cancelFreeHours', { token: admin, body: { value: 24 } });
  await call('PUT', '/admin/settings/rules.cancelFeePercent', { token: admin, body: { value: 10 } });

  const slots = ['09:00', '11:00', '13:00', '15:00', '17:00'];
  /* Books for `daysAhead`, optionally gets it confirmed by the pro, and optionally records an online payment of ₹estimate. */
  async function make(daysAhead: number, opts: { confirm?: boolean; paid?: boolean; moveToToday?: boolean } = {}) {
    const slot = slots[slotCounter++ % slots.length];
    const day = iso(daysAhead + Math.floor(slotCounter / slots.length));
    const b = (await call('POST', '/bookings', { token: cust, body: { serviceId: 1, providerId: pid, day, slot, name: 'Refund Cust', phone: '9876500777', address: '1 Refund Road' } })).json;
    if (opts.confirm) await call('POST', `/pro/bookings/${b.id}/accept`, { token: pro });
    if (opts.moveToToday) await prisma.booking.update({ where: { id: b.id }, data: { day: iso(0) } });
    if (opts.paid) await prisma.payment.create({ data: { bookingId: b.id, providerOrderId: `order_${b.id}`, providerPaymentId: `pay_${b.id}`, amount: b.estimate * 100, status: 'PAID' } });
    return b as { id: string; estimate: number };
  }

  // 1. Free window: confirmed, 5+ days away, paid -> full refund
  let b = await make(5, { confirm: true, paid: true });
  r = await call('GET', `/bookings/${b.id}/cancellation`, { token: cust });
  check('policy: preview shows no fee in the free window', r.status === 200 && r.json.fee === 0 && r.json.refund === b.estimate && r.json.paid === b.estimate, r);
  r = await call('GET', `/bookings/${b.id}/cancellation`, { token: other });
  check("policy: another customer can't preview -> 404", r.status === 404, r.status);
  refunds.length = 0;
  r = await call('PATCH', `/bookings/${b.id}`, { token: cust, body: { status: 'CANCELLED' } });
  check('free cancel: cancelled with no fee', r.status === 200 && r.json.cancelFee === 0, r);
  check('free cancel: full amount refunded via Razorpay', refunds.length === 1 && refunds[0].amount === b.estimate * 100 && refunds[0].payment === `pay_${b.id}`, refunds);
  let pay = await prisma.payment.findUnique({ where: { bookingId: b.id } });
  check('free cancel: payment REFUNDED with refunded amount recorded', pay?.status === 'REFUNDED' && pay.refundedAmount === b.estimate * 100, pay);
  r = await call('GET', `/bookings/${b.id}/cancellation`, { token: cust });
  check('policy: preview refused once cancelled', r.status === 400, r.status);

  // 2. Not yet confirmed (no pro), even if paid and close: no fee
  b = await make(1, { paid: true, moveToToday: true });
  refunds.length = 0;
  r = await call('PATCH', `/bookings/${b.id}`, { token: cust, body: { status: 'CANCELLED' } });
  check('unconfirmed request: no fee, full refund', r.json.cancelFee === 0 && refunds[0]?.amount === b.estimate * 100, { r: r.json, refunds });

  // 3. Late cancel, paid: fee 10% held back, rest refunded
  b = await make(2, { confirm: true, paid: true, moveToToday: true });
  const fee = Math.round(b.estimate * 0.1);
  r = await call('GET', `/bookings/${b.id}/cancellation`, { token: cust });
  check('policy: preview shows the late fee and the refund after it', r.json.fee === fee && r.json.refund === b.estimate - fee && r.json.percent === 10 && r.json.freeHours === 24, r.json);
  refunds.length = 0;
  r = await call('PATCH', `/bookings/${b.id}`, { token: cust, body: { status: 'CANCELLED', reason: 'Plans changed' } });
  check('late cancel: fee stored on the booking', r.status === 200 && r.json.cancelFee === fee, r.json);
  check('late cancel: only the amount after the fee is refunded', refunds.length === 1 && refunds[0].amount === (b.estimate - fee) * 100, refunds);
  pay = await prisma.payment.findUnique({ where: { bookingId: b.id } });
  check('late cancel: refunded amount recorded', pay?.status === 'REFUNDED' && pay.refundedAmount === (b.estimate - fee) * 100, pay);

  // 4. Late cancel, not paid online: fee recorded, nothing to refund
  b = await make(3, { confirm: true, moveToToday: true });
  refunds.length = 0;
  r = await call('PATCH', `/bookings/${b.id}`, { token: cust, body: { status: 'CANCELLED' } });
  check('late cancel unpaid: fee recorded, no refund attempted', r.json.cancelFee === fee && refunds.length === 0, { r: r.json, refunds });

  // 5. Pro already on the way: fee applies even far ahead
  b = await make(6, { confirm: true });
  await call('PATCH', `/bookings/${b.id}/status`, { token: pro, body: { status: 'ON_THE_WAY' } });
  r = await call('GET', `/bookings/${b.id}/cancellation`, { token: cust });
  check('on the way: fee applies regardless of date', r.json.fee === fee, r.json);

  // 6. Admin changes the policy; it takes effect immediately
  await call('PUT', '/admin/settings/rules.cancelFeePercent', { token: admin, body: { value: 25 } });
  r = await call('GET', `/bookings/${b.id}/cancellation`, { token: cust });
  check('admin policy change applies immediately (25%)', r.json.fee === Math.round(b.estimate * 0.25) && r.json.percent === 25, r.json);
  await call('PUT', '/admin/settings/rules.cancelFeePercent', { token: admin, body: { value: 0 } });
  r = await call('GET', `/bookings/${b.id}/cancellation`, { token: cust });
  check('fee set to 0% means free cancellation', r.json.fee === 0, r.json);
  r = await call('PUT', '/admin/settings/rules.cancelFeePercent', { token: admin, body: { value: 150 } });
  check('invalid policy value (150%) rejected', r.status === 400, r.status);
  await call('PUT', '/admin/settings/rules.cancelFeePercent', { token: admin, body: { value: 10 } });

  // 7. Pro-side cancellation never charges the customer
  b = await make(4, { confirm: true, paid: true, moveToToday: true });
  refunds.length = 0;
  r = await call('PATCH', `/bookings/${b.id}/status`, { token: admin, body: { status: 'CANCELLED' } });
  check('admin cancel: full refund, no customer fee', r.status === 200 && refunds[0]?.amount === b.estimate * 100 && r.json.cancelFee === 0, { r: r.json, refunds });

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  mock.close();
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
