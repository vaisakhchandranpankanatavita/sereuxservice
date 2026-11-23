import { applyCoupon } from '../src/common/coupons';

const base = { code: 'SAVE', percent: 20, active: true, maxDiscount: null, minOrder: null, expiresAt: null, usageLimit: null, perUserLimit: null };
const mk = (c: object, uses = { all: 0, mine: 0 }) => ({
  coupon: { findUnique: async () => ({ ...base, ...c }) },
  booking: { count: async (a: any) => (a.where.userId ? uses.mine : uses.all) },
  order: { count: async () => 0 },
}) as any;
const fails = async (db: any, msg: string, amt = 1000) => { try { await applyCoupon(db, 'save', 'u', amt); } catch (e: any) { return e.message.includes(msg); } return false; };

(async () => {
  const ok: [string, boolean][] = [];
  ok.push(['percent', (await applyCoupon(mk({}), 'save', 'u', 1000)).discount === 200]);
  ok.push(['cap', (await applyCoupon(mk({ maxDiscount: 150 }), 'save', 'u', 1000)).discount === 150]);
  ok.push(['preview no amount', (await applyCoupon(mk({}), 'save', 'u')).discount === 0]);
  ok.push(['inactive', await fails(mk({ active: false }), 'valid')]);
  ok.push(['expired', await fails(mk({ expiresAt: new Date(Date.now() - 1000) }), 'expired')]);
  ok.push(['min order', await fails(mk({ minOrder: 2000 }), 'minimum')]);
  ok.push(['usage limit', await fails(mk({ usageLimit: 5 }, { all: 5, mine: 0 }), 'redeemed')]);
  ok.push(['per user', await fails(mk({ perUserLimit: 1 }, { all: 1, mine: 1 }), 'already used')]);
  ok.push(['under limit ok', (await applyCoupon(mk({ usageLimit: 5, perUserLimit: 2 }, { all: 4, mine: 1 }), 'save', 'u', 1000)).discount === 200]);
  for (const [n, r] of ok) console.log(r ? 'PASS' : 'FAIL', n);
  process.exit(ok.every(([, r]) => r) ? 0 : 1);
})();
