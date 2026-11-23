/* E2E for mid-job extra charges. Needs ADMIN_EMAIL/ADMIN_PASSWORD of an existing admin and a running API (API=http://localhost:4000/api). */
const BASE = process.env.API ?? 'http://localhost:4000/api';
let failed = 0;

async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* empty body */ }
  return { status: res.status, json };
}
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ->  ' + JSON.stringify(detail)}`);
}

const run = Date.now().toString(36);
const PNG = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='.repeat(2);
const day = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);

async function main() {
  let r = await call('POST', '/auth/login', { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
  check('admin login', r.status === 200, r);
  const admin = r.json.accessToken as string;

  const reg = async (n: string) => (await call('POST', '/auth/register', { body: { name: n, email: `${n.replace(/\s/g, '').toLowerCase()}_${run}@example.com`, phone: '9876500123', password: 'Passw0rd!x' } })).json.accessToken as string;
  const cust = await reg('Extra Cust');
  const other = await reg('Other Cust');
  const proEmail = `xpro_${run}@example.com`;
  await call('POST', '/auth/register', { body: { name: 'Extra Pro', email: proEmail, phone: '9876500124', password: 'Passw0rd!x' } });

  r = await call('POST', '/admin/providers', { token: admin, body: { name: 'Extra Pro', years: 3, response: '10 min', verified: true, serviceIds: [1] } });
  const pid = r.json.id as number;
  await call('PATCH', `/admin/providers/${pid}/link`, { token: admin, body: { email: proEmail } });
  const pro = (await call('POST', '/auth/login', { body: { email: proEmail, password: 'Passw0rd!x' } })).json.accessToken as string;
  r = await call('POST', '/pro/kyc', { token: pro, body: { docType: 'PAN', docNumber: 'ABCDE1234F', docImage: PNG } });
  check('pro submits KYC', r.status === 201 || r.status === 200, r);
  r = await call('PATCH', `/admin/kyc/${pid}`, { token: admin, body: { decision: 'APPROVED' } });
  check('admin approves KYC', r.status === 200, r);

  r = await call('POST', '/bookings', { token: cust, body: { serviceId: 1, providerId: pid, day, slot: '11:00', name: 'Extra Cust', phone: '9876500123', address: '1 Extras Road' } });
  const id = r.json.id as string;
  const base = r.json.estimate as number;
  check('booking created', r.status === 201, r);

  r = await call('POST', `/bookings/${id}/extras`, { token: pro, body: { label: 'Too early', amount: 100 } });
  check('extra: rejected before the job is under way', r.status === 400, r);
  r = await call('POST', `/pro/bookings/${id}/accept`, { token: pro });
  check('pro accepts', r.status < 300, r);
  for (const s of ['ON_THE_WAY']) {
    r = await call('PATCH', `/bookings/${id}/status`, { token: pro, body: { status: s } });
    check(`status -> ${s}`, r.status === 200, r);
  }
  // customer reads the start code from their booking, as in the real app
  let otp = (await call('GET', `/bookings/${id}`, { token: cust })).json.otp as string;
  r = await call('PATCH', `/bookings/${id}/status`, { token: pro, body: { status: 'IN_PROGRESS', otp } });
  check('status -> IN_PROGRESS with customer code', r.status === 200, r);

  r = await call('POST', `/bookings/${id}/extras`, { token: cust, body: { label: 'Self add', amount: 100 } });
  check('extra: customer cannot propose -> 403', r.status === 403, r.status);
  r = await call('POST', `/bookings/${id}/extras`, { token: pro, body: { label: 'ab', amount: 100 } });
  check('extra: too-short label rejected', r.status === 400, r.status);
  r = await call('POST', `/bookings/${id}/extras`, { token: pro, body: { label: 'New tap cartridge', amount: 0 } });
  check('extra: zero amount rejected', r.status === 400, r.status);
  r = await call('POST', `/bookings/${id}/extras`, { token: pro, body: { label: 'New tap cartridge', amount: 350 } });
  check('extra: pro proposes (PENDING)', r.status === 201 && r.json.status === 'PENDING', r);
  const e1 = r.json.id as string;
  r = await call('POST', `/bookings/${id}/extras`, { token: pro, body: { label: 'Sealant tape', amount: 80 } });
  const e2 = r.json.id as string;

  r = await call('GET', `/bookings/${id}`, { token: cust });
  check('extra: customer sees both pending extras, total unchanged', r.json.extras?.length === 2 && r.json.estimate === base, r.json);

  r = await call('PATCH', `/bookings/${id}/status`, { token: pro, body: { status: 'DONE', otp: (await call('GET', `/bookings/${id}`, { token: cust })).json.otp } });
  check('extra: job cannot be completed while a charge is pending', r.status === 400, r);

  r = await call('PATCH', `/bookings/${id}/extras/${e1}`, { token: other, body: { status: 'APPROVED' } });
  check("extra: another customer can't answer -> 404", r.status === 404, r.status);
  r = await call('PATCH', `/bookings/${id}/extras/${e1}`, { token: pro, body: { status: 'APPROVED' } });
  check('extra: pro cannot approve their own charge -> 403', r.status === 403, r.status);
  r = await call('PATCH', `/bookings/${id}/extras/${e1}`, { token: cust, body: { status: 'MAYBE' } });
  check('extra: invalid decision rejected', r.status === 400, r.status);

  r = await call('PATCH', `/bookings/${id}/extras/${e1}`, { token: cust, body: { status: 'APPROVED' } });
  check('extra: customer approves', r.status === 200 && r.json.status === 'APPROVED', r);
  r = await call('PATCH', `/bookings/${id}/extras/${e1}`, { token: cust, body: { status: 'REJECTED' } });
  check('extra: cannot change an answered charge -> 409', r.status === 409, r.status);
  r = await call('PATCH', `/bookings/${id}/extras/${e2}`, { token: cust, body: { status: 'REJECTED' } });
  check('extra: customer declines the second', r.status === 200 && r.json.status === 'REJECTED', r);

  r = await call('GET', `/bookings/${id}`, { token: cust });
  check('extra: total = estimate + approved only', r.json.estimate === base + 350, { got: r.json.estimate, want: base + 350 });
  r = await call('GET', '/pro/jobs', { token: pro });
  check('extra: pro job list includes extras', r.json.find((j: any) => j.id === id)?.extras?.length === 2, r.json);

  otp = (await call('GET', `/bookings/${id}`, { token: cust })).json.otp;
  r = await call('PATCH', `/bookings/${id}/status`, { token: pro, body: { status: 'DONE', otp } });
  check('job completes once all extras are answered', r.status === 200 && r.json.status === 'DONE', r);
  r = await call('POST', `/bookings/${id}/extras`, { token: pro, body: { label: 'After the fact', amount: 50 } });
  check('extra: cannot be added after completion', r.status === 400, r.status);

  r = await call('GET', '/pro/earnings', { token: pro });
  const expect = Math.round((base + 350) * 0.8);
  check('earnings include the approved extra (net of 20% commission)', r.json.lifetime === expect, { got: r.json.lifetime, expect });

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
