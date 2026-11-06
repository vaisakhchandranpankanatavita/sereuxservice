const BASE = process.env.API ?? 'http://localhost:4000/api';
let failed = 0;

async function call(method: string, path: string, opts: { token?: string; body?: unknown; cookie?: string } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* empty body */ }
  return { status: res.status, json, cookie: res.headers.get('set-cookie')?.split(';')[0] };
}

function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ->  ' + JSON.stringify(detail)}`);
}

const run = Date.now().toString(36);
const email = `smoke_${run}@example.com`;
const day = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
const booking = { serviceId: 1, providerId: 1, day, slot: '11:00', name: 'Smoke Test', phone: '9876543210', address: '12 Test Street' };

async function main() {
  let r = await call('GET', '/services');
  check('catalog: lists 8 services', r.status === 200 && r.json.length === 8, r.status);

  r = await call('POST', '/auth/register', { body: { name: 'Smoke Test', email, phone: '9876543210', password: 'short' } });
  check('auth: rejects weak password', r.status === 400, r.status);

  r = await call('POST', '/auth/register', { body: { name: 'Smoke Test', email, phone: '9876543210', password: 'Passw0rd!x' } });
  check('auth: register', r.status === 201 && !!r.json.accessToken && !r.json.refreshToken && !!r.cookie, r);
  const token = r.json.accessToken as string;
  const refreshCookie = r.cookie!;

  r = await call('POST', '/auth/register', { body: { name: 'Dup', email: email.toUpperCase(), phone: '9876543210', password: 'Passw0rd!x' } });
  check('auth: duplicate email (case-insensitive) rejected', r.status === 409, r.status);

  r = await call('POST', '/auth/login', { body: { email, password: 'wrong-password' } });
  check('auth: bad password -> 401', r.status === 401, r.status);

  r = await call('GET', '/auth/me', { token });
  check('auth: /me returns user', r.status === 200 && r.json.email === email, r);

  r = await call('GET', '/auth/me');
  check('auth: /me without token -> 401', r.status === 401, r.status);

  r = await call('PATCH', '/auth/me', { token, body: { name: 'Smoke Renamed', phone: '9123456780' } });
  check('auth: update profile', r.status === 200 && r.json.name === 'Smoke Renamed' && r.json.phone === '9123456780' && r.json.email === email, r);
  r = await call('PATCH', '/auth/me', { token, body: { name: 'X', phone: 'abc', role: 'ADMIN' } });
  check('auth: profile update rejects bad input and role escalation', r.status === 400, r.status);

  r = await call('POST', '/auth/refresh', { cookie: refreshCookie });
  check('auth: refresh rotates token', r.status === 200 && !!r.json.accessToken && !!r.cookie && r.cookie !== refreshCookie, r);
  const reused = await call('POST', '/auth/refresh', { cookie: refreshCookie });
  check('auth: old refresh token cannot be reused', reused.status === 401, reused.status);

  r = await call('POST', '/bookings', { body: booking });
  check('booking: requires auth', r.status === 401, r.status);

  r = await call('POST', '/bookings', { token, body: { ...booking, day: new Date().toISOString().slice(0, 10) } });
  check('booking: rejects same-day/past date', r.status === 400, r.status);

  r = await call('POST', '/bookings', { token, body: { ...booking, providerId: 2 } });
  check('booking: rejects pro who does not offer service', r.status === 400, r.status);

  r = await call('POST', '/bookings', { token, body: booking });
  check('booking: create', r.status === 201 && r.json.status === 'REQUESTED' && /^FX/.test(r.json.id), r);
  const bookingId = r.json?.id as string;

  r = await call('POST', '/bookings', { token, body: booking });
  check('booking: same pro+slot double-booking -> 409', r.status === 409, r.status);

  r = await call('GET', `/services/1/availability?day=${day}&providerId=1`);
  const slot11 = r.json?.slots?.find((s: any) => s.slot === '11:00');
  check('availability: taken slot reported unavailable', slot11?.available === false, r.json);

  r = await call('PATCH', `/bookings/${bookingId}`, { token, body: { slot: '13:00' } });
  check('booking: reschedule', r.status === 200 && r.json.slot === '13:00', r);

  r = await call('PATCH', `/bookings/${bookingId}/status`, { token, body: { status: 'CONFIRMED' } });
  check('booking: customer cannot change status (role guard) -> 403', r.status === 403, r.status);

  r = await call('POST', '/reviews', { token, body: { kind: 'service', target: 1, bookingId, rating: 5, text: 'Great' } });
  check('review: blocked until booking is DONE', r.status === 400, r.status);

  r = await call('PATCH', `/bookings/${bookingId}`, { token, body: { status: 'CANCELLED' } });
  check('booking: cancel', r.status === 200 && r.json.status === 'CANCELLED', r);

  r = await call('POST', '/bookings', { token, body: { ...booking, slot: '13:00' } });
  check('booking: cancelled slot can be rebooked', r.status === 201, r);

  r = await call('GET', '/bookings', { token });
  check('booking: list returns own bookings', r.status === 200 && r.json.length === 2, r.json?.length);

  const other = await call('POST', '/auth/register', { body: { name: 'Other User', email: `other_${run}@example.com`, phone: '9876543211', password: 'Passw0rd!x' } });
  r = await call('GET', `/bookings/${bookingId}`, { token: other.json.accessToken });
  check("booking: other user can't read it -> 404", r.status === 404, r.status);
  r = await call('PATCH', `/bookings/${bookingId}`, { token: other.json.accessToken, body: { status: 'CANCELLED' } });
  check("booking: other user can't modify it -> 404", r.status === 404, r.status);

  r = await call('GET', '/notifications', { token });
  check('notifications: created by booking events', r.status === 200 && r.json.length >= 2, r.json?.length);

  r = await call('POST', '/orders', { token, body: { name: 'Smoke', phone: '9876543210', address: '1 Road', city: 'Kochi', pin: '682001', items: [{ productId: 1, qty: 2 }, { productId: 3, qty: 1 }], coupon: 'fixzy10' } });
  const expectedSubtotal = 350 * 2 + 1649;
  check('order: server-priced total with coupon', r.status === 201 && r.json.subtotal === expectedSubtotal && r.json.discount === Math.round(expectedSubtotal * 0.1) && r.json.total === expectedSubtotal - r.json.discount, r.json);
  check('order: defaults to pay on delivery', r.json.paymentMethod === 'COD', r.json.paymentMethod);
  const codOrderId = r.json.id as string;

  r = await call('POST', '/orders', { token, body: { name: 'Smoke', phone: '9876543210', address: '1 Road', city: 'Kochi', pin: '682001', items: [{ productId: 1, qty: 1 }], paymentMethod: 'ONLINE' } });
  check('order: can be placed for online payment', r.status === 201 && r.json.paymentMethod === 'ONLINE', r.json);
  const onlineOrderId = r.json.id as string;

  r = await call('POST', `/payments/orders/${codOrderId}`, { token });
  check('payment: refuses to start for a COD order', r.status === 400, r.status);

  r = await call('POST', `/payments/orders/${onlineOrderId}`, { token });
  check('payment: 503 when Razorpay keys are not configured (pay-on-delivery still works)', r.status === 503, r.status);

  r = await call('POST', `/payments/orders/${onlineOrderId}/verify`, { token, body: { razorpay_order_id: 'x', razorpay_payment_id: 'y', razorpay_signature: 'z' } });
  check('payment: verify 404s without a payment attempt on record', r.status === 404, r.status);

  r = await call('POST', `/payments/orders/${onlineOrderId}`, { token: other.json.accessToken });
  check("payment: another user can't start payment on this order -> 404", r.status === 404, r.status);

  r = await call('POST', '/orders', { token, body: { name: 'Smoke', phone: '9876543210', address: '1 Road', city: 'Kochi', pin: '682001', items: [{ productId: 1, qty: 1 }], coupon: 'BOGUS' } });
  check('order: invalid coupon rejected', r.status === 400, r.status);

  r = await call('POST', '/orders', { token, body: { name: 'Smoke', phone: '9876543210', address: '1 Road', city: 'Kochi', pin: '682001', items: [{ productId: 999, qty: 1 }] } });
  check('order: unknown product rejected', r.status === 400, r.status);

  r = await call('POST', '/orders', { token, body: { name: 'Smoke', phone: '9876543210', address: '1 Road', city: 'Kochi', pin: '682001', items: [{ productId: 1, qty: 1, price: 1 }] } });
  check('order: client-supplied price field rejected', r.status === 400, r.status);

  r = await call('POST', '/reviews', { token, body: { kind: 'product', target: 1, rating: 4, text: 'Bright' } });
  check('review: product review allowed after ordering it', r.status === 201, r);
  r = await call('POST', '/reviews', { token, body: { kind: 'product', target: 5, rating: 4 } });
  check("review: can't review a product never ordered", r.status === 400, r.status);

  r = await call('PUT', '/wishlist/3', { token });
  check('wishlist: add', r.status === 204, r.status);
  r = await call('GET', '/wishlist', { token });
  check('wishlist: list', r.status === 200 && r.json.length === 1 && r.json[0].id === 3, r.json);

  r = await call('POST', '/contact', { body: { name: 'Visitor', email: 'v@example.com', message: 'Hello, this is a message.' } });
  check('contact: public submit', r.status === 201, r.status);

  r = await call('POST', '/auth/logout', { cookie: refreshCookie });
  check('auth: logout', r.status === 204, r.status);

  await proFlow();

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
}

/* Exercises the provider app's API: linking a login to a provider profile (admin), the request pool,
   accept/decline races, the status flow, releasing a confirmed job, and earnings/profile.
   Needs ADMIN_EMAIL/ADMIN_PASSWORD for an existing admin (see `npm run admin:create`); skipped otherwise. */
async function proFlow() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.log('SKIP  pro flow (set ADMIN_EMAIL/ADMIN_PASSWORD to run it)');
    return;
  }

  let r = await call('POST', '/auth/login', { body: { email: adminEmail, password: adminPassword } });
  check('pro: admin login', r.status === 200 && !!r.json.accessToken, r.status);
  const adminToken = r.json.accessToken as string;

  const run2 = Date.now().toString(36) + '2';
  const customerEmail = `smokecust_${run2}@example.com`;
  r = await call('POST', '/auth/register', { body: { name: 'Pro Flow Customer', email: customerEmail, phone: '9876500000', password: 'Passw0rd!x' } });
  const customerToken = r.json.accessToken as string;

  const proAEmail = `smokepro_a_${run2}@example.com`;
  const proBEmail = `smokepro_b_${run2}@example.com`;
  const proA = await call('POST', '/auth/register', { body: { name: 'Pro A', email: proAEmail, phone: '9876500001', password: 'Passw0rd!x' } });
  const proB = await call('POST', '/auth/register', { body: { name: 'Pro B', email: proBEmail, phone: '9876500002', password: 'Passw0rd!x' } });

  r = await call('GET', '/pro/me', { token: proA.json.accessToken });
  check('pro: plain CUSTOMER login is forbidden from /pro/me before linking', r.status === 403, r.status);

  r = await call('POST', '/admin/providers', { token: adminToken, body: { name: 'Smoke Pro A', years: 2, response: '20 min', verified: true, serviceIds: [1] } });
  check('pro: admin creates provider profile', r.status === 201, r);
  const providerId = r.json.id as number;

  r = await call('POST', '/admin/providers', { token: adminToken, body: { name: 'Smoke Pro B', years: 1, response: '30 min', verified: true, serviceIds: [1] } });
  const providerBId = r.json.id as number;

  r = await call('PATCH', `/admin/providers/${providerId}/link`, { token: adminToken, body: { email: proAEmail } });
  check('pro: admin links login to provider', r.status === 200 && r.json.userId, r);

  r = await call('PATCH', `/admin/providers/${providerBId}/link`, { token: adminToken, body: { email: proBEmail } });
  check('pro: admin links second login to a different provider', r.status === 200 && r.json.userId, r);

  r = await call('PATCH', `/admin/providers/${providerId}/link`, { token: adminToken, body: { email: proBEmail } });
  check("pro: can't link a login that's already linked to another provider -> 409", r.status === 409, r.status);

  r = await call('PATCH', `/admin/providers/${providerId}/link`, { token: adminToken, body: { email: 'no-such-account@example.com' } });
  check('pro: linking an unregistered email -> 404', r.status === 404, r.status);

  // Role is baked into the access token at issuance, so a pro must get a fresh token after being linked/promoted.
  const proALogin = await call('POST', '/auth/login', { body: { email: proAEmail, password: 'Passw0rd!x' } });
  const proBLogin = await call('POST', '/auth/login', { body: { email: proBEmail, password: 'Passw0rd!x' } });
  const proAToken = proALogin.json.accessToken as string;
  const proBToken = proBLogin.json.accessToken as string;

  r = await call('GET', '/pro/me', { token: proAToken });
  check('pro: linked login reaches /pro/me', r.status === 200 && r.json.id === providerId, r);
  r = await call('GET', '/pro/me', { token: proBToken });
  check('pro: pro B reaches its own provider profile', r.status === 200 && r.json.id === providerBId, r);

  r = await call('PATCH', '/pro/online', { token: proAToken, body: { online: true } });
  check('pro: go online', r.status === 200 && r.json.online === true, r);

  const day2 = new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10);
  r = await call('POST', '/bookings', { token: customerToken, body: { serviceId: 1, day: day2, slot: '15:00', name: 'Pro Flow Customer', phone: '9876500000', address: '9 Flow Street' } });
  check('pro: customer books unassigned', r.status === 201, r);
  const jobId = r.json.id as string;

  r = await call('GET', '/pro/requests', { token: proAToken });
  check('pro: open request appears in pool', r.status === 200 && r.json.some((b: any) => b.id === jobId), r.status);

  r = await call('POST', `/pro/bookings/${jobId}/accept`, { token: proAToken });
  check('pro: accept assigns and confirms', r.status === 201 || (r.status === 200 && r.json.status === 'CONFIRMED'), r);

  r = await call('PATCH', `/bookings/${jobId}/status`, { token: proBToken });
  check('pro: another pro cannot drive the status (not assigned) -> 403', r.status === 403 || r.status === 400, r.status);

  r = await call('POST', `/pro/bookings/${jobId}/release`, { token: proAToken, body: { reason: 'te' } });
  check('pro: release rejects a too-short reason', r.status === 400, r.status);

  r = await call('POST', `/pro/bookings/${jobId}/release`, { token: proAToken, body: { reason: 'Vehicle broke down' } });
  check('pro: release puts the job back in the pool', r.status === 201 && r.json.status === 'REQUESTED' && r.json.providerId === null, r.json);

  r = await call('POST', `/pro/bookings/${jobId}/accept`, { token: proAToken });
  check('pro: re-accept after release', r.status === 200 || r.status === 201, r.status);

  for (const status of ['ON_THE_WAY', 'IN_PROGRESS', 'DONE']) {
    r = await call('PATCH', `/bookings/${jobId}/status`, { token: proAToken, body: { status } });
    check(`pro: status -> ${status}`, r.status === 200 && r.json.status === status, r.json);
  }

  r = await call('POST', `/pro/bookings/${jobId}/release`, { token: proAToken, body: { reason: 'Too late to release' } });
  check('pro: cannot release a job that is already done', r.status === 400, r.status);

  r = await call('GET', '/pro/earnings', { token: proAToken });
  check('pro: earnings reflects the completed job', r.status === 200 && r.json.jobs >= 1 && r.json.lifetime >= 1, r.json);

  r = await call('PATCH', '/pro/profile', { token: proAToken, body: { bio: 'Quick and tidy.', response: '15 min' } });
  check('pro: update profile', r.status === 200 && r.json.bio === 'Quick and tidy.' && r.json.response === '15 min', r.json);
}

main().catch((e) => { console.error(e); process.exit(1); });
