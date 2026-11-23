import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* Animated "Insights" strip shown at the top of every inner page. Everything is derived from the rows
   the page already loaded, so the numbers always match the table below. */

const PALETTE = ['#8fa874', '#cbd89c', '#e0c785', '#86b3bb', '#d39a84', '#a99fd1', '#b7c0ad'];
const FMT = {
  int: (n) => Math.round(n).toLocaleString('en-IN'),
  money: (n) => `₹${Math.round(n).toLocaleString('en-IN')}`,
  pct: (n) => `${Math.round(n)}%`,
  dec: (n) => n.toFixed(1),
};

export const nice = (s) => String(s ?? '').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
export const pctOf = (a, b) => (b ? (a / b) * 100 : 0);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const countBy = (rows, fn) => {
  const m = new Map();
  rows.forEach((r) => { const k = fn(r); if (k != null && k !== '') m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};
const sumBy = (rows, keyFn, valFn) => {
  const m = new Map();
  rows.forEach((r) => { const k = keyFn(r); if (k != null && k !== '') m.set(k, (m.get(k) ?? 0) + valFn(r)); });
  return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};
export const byDay = (rows, get, days = 14) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    out.push({ key: d.toDateString(), label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: 0 });
  }
  const at = new Map(out.map((o, i) => [o.key, i]));
  rows.forEach((r) => { const t = get(r); if (!t) return; const k = new Date(t).toDateString(); if (at.has(k)) out[at.get(k)].value += 1; });
  return out;
};
const peak = (trend) => trend.reduce((a, b) => (b.value > a.value ? b : a), { value: 0 });
const lastDays = (rows, get, n) => { const from = Date.now() - n * 864e5; return rows.filter((r) => { const t = get(r); return t && new Date(t).getTime() >= from; }).length; };

function useReveal() {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const fallback = setTimeout(() => setOn(true), 900);
    if (!el || typeof IntersectionObserver === 'undefined') { setOn(true); return () => clearTimeout(fallback); }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.1 });
    io.observe(el);
    return () => { clearTimeout(fallback); io.disconnect(); };
  }, []);
  return [ref, on];
}

function Count({ value, fmt = 'int', on }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!on) return undefined;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 1100);
      setV(value * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const fb = setTimeout(() => setV(value), 1500);
    return () => { cancelAnimationFrame(raf); clearTimeout(fb); };
  }, [on, value]);
  return <>{FMT[fmt](v)}</>;
}

function Donut({ data, on }) {
  const C = 2 * Math.PI * 46;
  const sum = data.reduce((a, d) => a + d.value, 0) || 1;
  let acc = 0;
  return <svg viewBox="0 0 120 120" className="ins-donut" role="img" aria-label="Share breakdown">
    <circle r="46" cx="60" cy="60" fill="none" stroke="#eef1e8" strokeWidth="14" />
    {data.map((d, i) => {
      const len = Math.max(0, (d.value / sum) * C - 2);
      const off = -acc; acc += (d.value / sum) * C;
      return <circle key={d.label} r="46" cx="60" cy="60" fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="14"
        strokeDasharray={on ? `${len} ${C - len}` : `0 ${C}`} strokeDashoffset={off} transform="rotate(-90 60 60)"
        style={{ transition: `stroke-dasharray 1.1s cubic-bezier(.2,.8,.2,1) ${i * 90}ms` }} />;
    })}
    <text x="60" y="58" textAnchor="middle" className="ins-dn">{FMT.int(sum === 1 && !data.length ? 0 : data.reduce((a, d) => a + d.value, 0))}</text>
    <text x="60" y="73" textAnchor="middle" className="ins-dl">total</text>
  </svg>;
}

function Bars({ data, on, fmt = 'int' }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return <ul className="ins-bars">{data.map((d, i) => <li key={d.label}>
    <span className="ins-bl" title={d.label}>{d.label}</span>
    <span className="ins-bt"><i style={{ width: on ? `${Math.max(3, (d.value / max) * 100)}%` : '0%', transitionDelay: `${i * 80}ms`, background: PALETTE[i % PALETTE.length] }} /></span>
    <b>{FMT[fmt](d.value)}</b>
  </li>)}</ul>;
}

function Trend({ data, on }) {
  const gid = useId().replace(/:/g, '');
  const W = 300, H = 76, P = 8;
  const max = Math.max(...data.map((d) => d.value), 1);
  const pts = data.map((d, i) => [P + (i / Math.max(1, data.length - 1)) * (W - 2 * P), H - 18 - (d.value / max) * (H - 36)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  const area = `${line}L${pts[pts.length - 1][0]} ${H - 18}L${pts[0][0]} ${H - 18}Z`;
  const last = pts[pts.length - 1];
  return <svg viewBox={`0 0 ${W} ${H}`} className="ins-trend" role="img" aria-label="Last 14 days">
    <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#8fa874" stopOpacity=".38" /><stop offset="1" stopColor="#8fa874" stopOpacity="0" /></linearGradient></defs>
    {[0.25, 0.5, 0.75].map((g) => <path key={g} d={`M${P} ${H - 18 - g * (H - 36)}H${W - P}`} stroke="#e8ece1" strokeDasharray="2 4" />)}
    <path d={area} fill={`url(#${gid})`} style={{ opacity: on ? 1 : 0, transition: 'opacity 1s ease .5s' }} />
    <path d={line} pathLength="1" fill="none" stroke="#6f8a57" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      strokeDasharray="1" strokeDashoffset={on ? 0 : 1} style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.3,.7,.2,1)' }} />
    <circle cx={last[0]} cy={last[1]} r="3.6" fill="#6f8a57" style={{ opacity: on ? 1 : 0, transition: 'opacity .4s ease 1.3s' }} />
    <circle cx={last[0]} cy={last[1]} r="3.6" fill="none" stroke="#6f8a57" className="ins-pulse" />
    <text x={P} y={H - 3} className="ins-ax">{data[0].label}</text>
    <text x={W - P} y={H - 3} textAnchor="end" className="ins-ax">{data[data.length - 1].label}</text>
  </svg>;
}

/* Docked just above the bottom nav as a slim pill (rendered in a portal so page transitions can't move it).
   Collapsed by default: the headline numbers scroll sideways inside the pill. Tapping it opens the charts as a popup
   that rises from the pill; tap outside, the close button or Esc dismisses it. */
export function Insights({ title = 'Insights', kpis = [], charts = [], notes = [] }) {
  const [ref, on] = useReveal();
  const [open, setOpen] = useState(false);
  const panel = useId();

  useEffect(() => {
    document.documentElement.style.setProperty('--ins-h', '44px');
    return () => document.documentElement.style.removeProperty('--ins-h');
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const short = title.replace(/ insights$/i, '');
  return createPortal(<>
    {open && <div className="ins-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
    <section className={`ins${on ? ' on' : ''}${open ? ' open' : ''}`} ref={ref} aria-label={title}>
      {open && <div className="ins-pop" id={panel} role="dialog" aria-label={title}>
        <header className="ins-pophead"><h2>{title}</h2>
          <button type="button" className="ins-x" onClick={() => setOpen(false)} aria-label="Close insights">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </header>
        {notes.length > 0 && <p className="ins-notes">{notes.join(' ')}</p>}
        <div className="ins-charts">{charts.map((c) => <div className="ins-card" key={c.title}>
          <h3>{c.title}</h3>
          {!c.data.length || (c.kind === 'trend' && !c.data.some((d) => d.value)) ? <p className="ins-empty">Not enough data yet</p>
            : c.kind === 'donut' ? <div className="ins-donutwrap"><Donut data={c.data} on />
              <ul className="ins-legend">{c.data.slice(0, 4).map((d, j) => <li key={d.label}><i style={{ background: PALETTE[j % PALETTE.length] }} /><span>{d.label}</span><b>{FMT.int(d.value)}</b></li>)}</ul></div>
              : c.kind === 'trend' ? <Trend data={c.data} on />
                : <Bars data={c.data.slice(0, 4)} on fmt={c.fmt} />}
        </div>)}</div>
      </div>}
      <button type="button" className="ins-bar" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={open ? panel : undefined} title={open ? 'Close insights' : 'Open insights'}>
        <span className="ins-title"><i aria-hidden="true" />{short}</span>
        <span className="ins-chips">{kpis.map((k) => <span className="ins-chip" key={k.label}>{k.label} <b><Count value={k.value} fmt={k.fmt} on={on} /></b></span>)}</span>
        <svg className="ins-chev" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 10l4.5-4.5L12.5 10" /></svg>
      </button>
    </section>
  </>, document.body);
}


/* ---------- Per-page analyses ---------- */
const OPEN_OFF = ['DONE', 'CANCELLED'];

export function BookingsInsights({ rows }) {
  if (!rows?.length) return null;
  const total = rows.length, done = rows.filter((b) => b.status === 'DONE').length, open = rows.filter((b) => !OPEN_OFF.includes(b.status));
  const status = countBy(rows, (b) => nice(b.status)), services = countBy(rows, (b) => b.service?.name).slice(0, 5);
  const trend = byDay(rows, (b) => b.createdAt), unassigned = open.filter((b) => !b.providerId).length, pk = peak(trend);
  return <Insights title="Booking insights"
    kpis={[
      { label: 'Total bookings', value: total }, { label: 'Open now', value: open.length, hint: 'not done or cancelled' },
      { label: 'Completion rate', value: pctOf(done, total), fmt: 'pct' }, { label: 'Pipeline value', value: open.reduce((a, b) => a + b.estimate, 0), fmt: 'money', hint: 'open estimates' },
      { label: 'Need a pro', value: unassigned, hint: 'open & unassigned' },
    ]}
    charts={[{ title: 'Status mix', kind: 'donut', data: status }, { title: 'Most booked services', kind: 'bars', data: services }, { title: 'Bookings · last 14 days', kind: 'trend', data: trend }]}
    notes={[
      `${status[0].label} is the most common status at ${Math.round(pctOf(status[0].value, total))}% of bookings.`,
      services[0] && `${services[0].label} drives the most demand with ${plural(services[0].value, 'booking')}.`,
      unassigned ? `${plural(unassigned, 'open booking')} still need a pro assigned.` : open.length ? 'Every open booking has a pro assigned.' : 'Nothing is waiting — all bookings are closed out.',
      pk.value ? `Busiest recent day: ${pk.label} with ${plural(pk.value, 'booking')}.` : null,
    ].filter(Boolean)} />;
}

export function OrdersInsights({ rows }) {
  if (!rows?.length) return null;
  const live = rows.filter((o) => o.status !== 'CANCELLED'), delivered = rows.filter((o) => o.status === 'DELIVERED').length;
  const revenue = live.reduce((a, o) => a + o.total, 0), withCoupon = rows.filter((o) => o.coupon).length;
  const status = countBy(rows, (o) => nice(o.status));
  const top = sumBy(rows.flatMap((o) => o.items.map((i) => ({ n: i.product?.name, q: i.qty }))), (x) => x.n, (x) => x.q).slice(0, 5);
  const trend = byDay(rows, (o) => o.createdAt), pending = rows.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status)).length;
  return <Insights title="Order insights"
    kpis={[
      { label: 'Orders', value: rows.length }, { label: 'Revenue', value: revenue, fmt: 'money', hint: 'excl. cancelled' },
      { label: 'Avg order value', value: avg(live.map((o) => o.total)), fmt: 'money' }, { label: 'Delivered', value: pctOf(delivered, rows.length), fmt: 'pct' },
      { label: 'Used a coupon', value: pctOf(withCoupon, rows.length), fmt: 'pct' },
    ]}
    charts={[{ title: 'Order status', kind: 'donut', data: status }, { title: 'Best sellers · units', kind: 'bars', data: top }, { title: 'Orders · last 14 days', kind: 'trend', data: trend }]}
    notes={[
      `Revenue so far is ₹${Math.round(revenue).toLocaleString('en-IN')} across ${plural(live.length, 'active order')}.`,
      top[0] && `${top[0].label} is the best seller with ${plural(top[0].value, 'unit')} sold.`,
      pending ? `${plural(pending, 'order')} still in flight.` : 'No orders are waiting to ship.',
      withCoupon ? `${Math.round(pctOf(withCoupon, rows.length))}% of orders used a coupon.` : null,
    ].filter(Boolean)} />;
}

export function UsersInsights({ rows }) {
  if (!rows?.length) return null;
  const role = countBy(rows, (u) => nice(u.role)), active = rows.filter((u) => u._count.bookings + u._count.orders > 0);
  const top = rows.map((u) => ({ label: u.name, value: u._count.bookings + u._count.orders })).filter((x) => x.value).sort((a, b) => b.value - a.value).slice(0, 5);
  const trend = byDay(rows, (u) => u.createdAt), recent = lastDays(rows, (u) => u.createdAt, 7);
  return <Insights title="User insights"
    kpis={[
      { label: 'Users', value: rows.length }, { label: 'Customers', value: rows.filter((u) => u.role === 'CUSTOMER').length },
      { label: 'Pros', value: rows.filter((u) => u.role === 'PROVIDER').length }, { label: 'Active users', value: pctOf(active.length, rows.length), fmt: 'pct', hint: 'booked or ordered' },
      { label: 'Joined this week', value: recent },
    ]}
    charts={[{ title: 'Roles', kind: 'donut', data: role }, { title: 'Most active · bookings + orders', kind: 'bars', data: top }, { title: 'Sign-ups · last 14 days', kind: 'trend', data: trend }]}
    notes={[
      `${Math.round(pctOf(active.length, rows.length))}% of users have booked or ordered at least once.`,
      top[0] && `${top[0].label} is the most active with ${plural(top[0].value, 'booking/order')}.`,
      recent ? `${plural(recent, 'new user')} joined in the last 7 days.` : 'No new sign-ups in the last 7 days.',
    ].filter(Boolean)} />;
}

export function ServicesInsights({ rows }) {
  if (!rows?.length) return null;
  const rated = rows.filter((s) => s.rating > 0), cat = countBy(rows, (s) => s.category);
  const priced = [...rows].sort((a, b) => b.fromPrice - a.fromPrice).slice(0, 5).map((s) => ({ label: s.name, value: s.fromPrice }));
  const best = [...rated].sort((a, b) => b.rating - a.rating).slice(0, 5).map((s) => ({ label: s.name, value: s.rating }));
  return <Insights title="Service insights"
    kpis={[
      { label: 'Services', value: rows.length }, { label: 'Categories', value: cat.length }, { label: 'Avg starting price', value: avg(rows.map((s) => s.fromPrice)), fmt: 'money' },
      { label: 'Avg rating', value: avg(rated.map((s) => s.rating)), fmt: 'dec', hint: `${rated.length} rated` }, { label: 'Reviews', value: rows.reduce((a, s) => a + (s.reviews || 0), 0) },
    ]}
    charts={[{ title: 'By category', kind: 'donut', data: cat }, { title: 'Highest starting price', kind: 'bars', fmt: 'money', data: priced }, { title: 'Top rated', kind: 'bars', fmt: 'dec', data: best }]}
    notes={[
      `${cat[0].label} is the biggest category with ${plural(cat[0].value, 'service')}.`,
      best[0] && `${best[0].label} leads on rating at ${best[0].value.toFixed(1)}.`,
      rows.length - rated.length ? `${plural(rows.length - rated.length, 'service')} ${rows.length - rated.length === 1 ? 'has' : 'have'} no reviews yet.` : null,
    ].filter(Boolean)} />;
}

export function ProsInsights({ rows }) {
  if (!rows?.length) return null;
  const verified = rows.filter((p) => p.verified).length, linked = rows.filter((p) => p.userId).length;
  const jobs = rows.map((p) => ({ label: p.name, value: p._count?.bookings ?? 0 })).filter((x) => x.value).sort((a, b) => b.value - a.value).slice(0, 5);
  const exp = [...rows].sort((a, b) => b.years - a.years).slice(0, 5).map((p) => ({ label: p.name, value: p.years }));
  return <Insights title="Pro insights"
    kpis={[
      { label: 'Pros', value: rows.length }, { label: 'Verified', value: pctOf(verified, rows.length), fmt: 'pct' }, { label: 'Online now', value: rows.filter((p) => p.online).length },
      { label: 'Avg experience', value: avg(rows.map((p) => p.years)), fmt: 'dec', hint: 'years' }, { label: 'App login linked', value: pctOf(linked, rows.length), fmt: 'pct' },
    ]}
    charts={[{ title: 'Verification', kind: 'donut', data: [{ label: 'Verified', value: verified }, { label: 'Pending', value: rows.length - verified }].filter((d) => d.value) },
      { title: 'Busiest pros · jobs', kind: 'bars', data: jobs }, { title: 'Most experienced · years', kind: 'bars', data: exp }]}
    notes={[
      rows.length - verified ? `${plural(rows.length - verified, 'pro')} awaiting verification.` : 'All pros are verified.',
      rows.length - linked ? `${plural(rows.length - linked, 'pro')} can’t use the pro app yet — no login linked.` : 'Every pro has a linked app login.',
      jobs[0] && `${jobs[0].label} has handled the most jobs (${jobs[0].value}).`,
    ].filter(Boolean)} />;
}

export function ProductsInsights({ rows }) {
  if (!rows?.length) return null;
  const cat = countBy(rows, (p) => p.category), sellers = countBy(rows, (p) => p.seller).slice(0, 5);
  const disc = rows.map((p) => ({ label: p.name, value: p.oldPrice > p.price ? ((p.oldPrice - p.price) / p.oldPrice) * 100 : 0 }));
  const top = [...disc].filter((d) => d.value).sort((a, b) => b.value - a.value).slice(0, 5);
  return <Insights title="Catalog insights"
    kpis={[
      { label: 'Products', value: rows.length }, { label: 'Categories', value: cat.length }, { label: 'Sellers', value: new Set(rows.map((p) => p.seller)).size },
      { label: 'Avg price', value: avg(rows.map((p) => p.price)), fmt: 'money' }, { label: 'Avg discount', value: avg(disc.map((d) => d.value)), fmt: 'pct' },
    ]}
    charts={[{ title: 'By category', kind: 'donut', data: cat }, { title: 'Products per seller', kind: 'bars', data: sellers }, { title: 'Biggest discounts', kind: 'bars', fmt: 'pct', data: top }]}
    notes={[
      `${cat[0].label} is the largest category with ${plural(cat[0].value, 'product')}.`,
      top[0] && `${top[0].label} has the deepest discount at ${Math.round(top[0].value)}% off.`,
      sellers[0] && `${sellers[0].label} lists the most products (${sellers[0].value}).`,
    ].filter(Boolean)} />;
}

export function CouponsInsights({ rows }) {
  if (!rows?.length) return null;
  const active = rows.filter((c) => c.active).length;
  const bands = [['Up to 10%', 0, 10], ['11–20%', 11, 20], ['21–30%', 21, 30], ['Over 30%', 31, 100]].map(([label, lo, hi]) => ({ label, value: rows.filter((c) => c.percent >= lo && c.percent <= hi).length })).filter((b) => b.value);
  const best = [...rows].sort((a, b) => b.percent - a.percent);
  return <Insights title="Coupon insights"
    kpis={[
      { label: 'Coupons', value: rows.length }, { label: 'Active', value: active }, { label: 'Avg discount', value: avg(rows.map((c) => c.percent)), fmt: 'pct' }, { label: 'Best offer', value: best[0].percent, fmt: 'pct', hint: best[0].code },
    ]}
    charts={[{ title: 'Active vs inactive', kind: 'donut', data: [{ label: 'Active', value: active }, { label: 'Inactive', value: rows.length - active }].filter((d) => d.value) },
      { title: 'Discount by code', kind: 'bars', fmt: 'pct', data: best.slice(0, 6).map((c) => ({ label: c.code, value: c.percent })) }, { title: 'Discount bands', kind: 'bars', data: bands }]}
    notes={[
      active === rows.length ? 'Every coupon is currently live.' : `${plural(rows.length - active, 'coupon')} switched off.`,
      `${best[0].code} is the most generous offer at ${best[0].percent}% off.`,
    ]} />;
}

export function PayoutsInsights({ rows }) {
  if (!rows?.length) return null;
  const totalDue = rows.reduce((a, r) => a + r.balanceDue, 0);
  const totalPaid = rows.reduce((a, r) => a + r.paidOut, 0);
  const owed = rows.filter((r) => r.balanceDue > 0).length;
  const top = [...rows].sort((a, b) => b.balanceDue - a.balanceDue);
  return <Insights title="Payout insights"
    kpis={[
      { label: 'Pros', value: rows.length }, { label: 'Owed now', value: totalDue, fmt: 'money' }, { label: 'Paid out', value: totalPaid, fmt: 'money' }, { label: 'Pros owed', value: owed },
    ]}
    charts={[{ title: 'Balance due by pro', kind: 'bars', fmt: 'money', data: top.slice(0, 6).filter((r) => r.balanceDue).map((r) => ({ label: r.name, value: r.balanceDue })) }]}
    notes={[
      owed ? `${plural(owed, 'pro')} currently owed a payout.` : 'Everyone is paid up.',
      top[0]?.balanceDue ? `${top[0].name} is owed the most: ₹${Math.round(top[0].balanceDue).toLocaleString('en-IN')}.` : null,
    ].filter(Boolean)} />;
}

export function BannersInsights({ rows }) {
  if (!rows?.length) return null;
  const live = rows.filter((b) => b.active).length, offer = rows.filter((b) => b.coupon).length, linked = rows.filter((b) => b.serviceId != null).length;
  const type = [{ label: 'With coupon', value: offer }, { label: 'Opens a service', value: linked }, { label: 'Plain', value: rows.filter((b) => !b.coupon && b.serviceId == null).length }].filter((d) => d.value);
  return <Insights title="Banner insights"
    kpis={[{ label: 'Banners', value: rows.length }, { label: 'Live', value: live }, { label: 'With a coupon', value: offer }, { label: 'Open a service', value: linked }]}
    charts={[{ title: 'Live vs hidden', kind: 'donut', data: [{ label: 'Live', value: live }, { label: 'Hidden', value: rows.length - live }].filter((d) => d.value) }, { title: 'What banners do', kind: 'bars', data: type }]}
    notes={[
      live ? `${plural(live, 'banner')} live on the home screen.` : 'No banner is live right now.',
      rows.length - live ? `${plural(rows.length - live, 'banner')} hidden.` : null,
      offer ? `${Math.round(pctOf(offer, rows.length))}% of banners push a coupon.` : 'None of the banners promote a coupon yet.',
    ].filter(Boolean)} />;
}

export function InboxInsights({ messages, reviews }) {
  const m = messages ?? [], r = reviews ?? [];
  if (!m.length && !r.length) return null;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ label: `${n} ★`, value: r.filter((x) => x.rating === n).length }));
  const kinds = countBy(r, (x) => nice(x.kind)), trend = byDay(m, (x) => x.createdAt), five = r.filter((x) => x.rating === 5).length;
  return <Insights title="Inbox insights"
    kpis={[
      { label: 'Messages', value: m.length }, { label: 'Reviews', value: r.length }, { label: 'Avg rating', value: avg(r.map((x) => x.rating)), fmt: 'dec' },
      { label: '5-star share', value: pctOf(five, r.length), fmt: 'pct' }, { label: 'Messages this week', value: lastDays(m, (x) => x.createdAt, 7) },
    ]}
    charts={[{ title: 'Rating mix', kind: 'bars', data: dist }, { title: 'Messages · last 14 days', kind: 'trend', data: trend }, { title: 'Reviews by type', kind: 'donut', data: kinds }]}
    notes={[
      r.length ? `Customers rate you ${avg(r.map((x) => x.rating)).toFixed(1)} on average across ${plural(r.length, 'review')}.` : null,
      r.filter((x) => x.rating <= 2).length ? `${plural(r.filter((x) => x.rating <= 2).length, 'low review')} worth a look.` : r.length ? 'No low reviews — nice.' : null,
      m.length ? `${plural(m.length, 'contact message')} to answer.` : 'The contact inbox is clear.',
    ].filter(Boolean)} />;
}

export function AuditInsights({ rows, labelOf }) {
  if (!rows?.length) return null;
  const actions = countBy(rows, (a) => labelOf(a.action)).slice(0, 6), area = countBy(rows, (a) => nice(String(a.action).split('.')[0]));
  const admins = countBy(rows, (a) => a.actorEmail), trend = byDay(rows, (a) => a.createdAt);
  return <Insights title="Activity insights"
    kpis={[
      { label: 'Events', value: rows.length }, { label: 'Admins active', value: admins.length }, { label: 'Today', value: lastDays(rows, (a) => a.createdAt, 1) }, { label: 'Kinds of action', value: new Set(rows.map((a) => a.action)).size },
    ]}
    charts={[{ title: 'Most common actions', kind: 'bars', data: actions }, { title: 'Where changes happen', kind: 'donut', data: area }, { title: 'Activity · last 14 days', kind: 'trend', data: trend }]}
    notes={[
      actions[0] && `${actions[0].label} is the most frequent change (${actions[0].value}).`,
      admins[0] && `${admins[0].label} made the most changes (${admins[0].value}).`,
      area[0] && `${area[0].label} is touched most often.`,
    ].filter(Boolean)} />;
}
