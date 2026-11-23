import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { AuditInsights, BannersInsights, BookingsInsights, CouponsInsights, InboxInsights, OrdersInsights, PayoutsInsights, ProductsInsights, ProsInsights, ServicesInsights, UsersInsights } from './insights.jsx';
import { LordIcon } from './LordIcon.jsx';
import { ICONS } from './icons.js';
import { Badge, FormModal, Modal, Page, Table, act, distanceKm, money, toast, useList, when } from './ui.jsx';

const FLOW = ['REQUESTED', 'CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS', 'DONE'];
const ORDER_FLOW = ['PLACED', 'SHIPPED', 'DELIVERED'];
const label = (s) => s.replace(/_/g, ' ').toLowerCase();

/* ---------- Dashboard ---------- */
const nf = new Intl.NumberFormat('en-IN');
const STATUS_HUE = { DONE: '#2f9e6b', REQUESTED: '#e8a33a', CONFIRMED: '#7a6cf0', ON_THE_WAY: '#3a7bd5', IN_PROGRESS: '#f07a3a', CANCELLED: '#d9534f' };

/* Points for a line through `vals`, scaled into a w×h box (a little headroom top and bottom). */
const pts = (vals, w, h, max) => {
  const m = max || Math.max(1, ...vals);
  const step = w / Math.max(1, vals.length - 1);
  return vals.map((v, i) => [i * step, h - 3 - (v / m) * (h - 6)]);
};
const linePath = (p) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const areaPath = (p, w, h) => `${linePath(p)} L${w},${h} L0,${h} Z`;

function Spark({ vals, color, w = 96, h = 30 }) {
  if (vals.length < 2) return null;
  const p = pts(vals, w, h);
  const id = `sp${color.replace('#', '')}`;
  return <svg className="dx-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <path d={areaPath(p, w, h)} fill={`url(#${id})`} />
    <path d={linePath(p)} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

function Tile({ href, label: l, value, sub, color, spark, pct }) {
  return <a className="dx-tile" href={href} style={{ '--t': color }}>
    <span className="dx-tile-top"><i className="dx-dot" /><span>{l}</span></span>
    <strong className="dx-val">{value}</strong>
    <span className="dx-sub">{sub}</span>
    {spark}
    {pct != null && <span className="dx-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, pct)}%` }} /></span>}
  </a>;
}

const Sk = ({ w = '100%', h = 14, r, style }) => <span className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} />;
function DashboardSkeleton() {
  return <div className="dx" role="status" aria-busy="true" aria-label="Loading dashboard">
    <div className="dx-head"><div><Sk w={220} h={26} r={8} /><Sk w={160} h={13} style={{ marginTop: 10 }} /></div></div>
    <div className="dx-grid">
      <div className="dx-kpis dx-sk">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="dx-tile"><Sk w="50%" h={10} /><Sk w="40%" h={22} r={6} style={{ marginTop: 8 }} /></div>)}
      </div>
      <div className="dx-card dx-wide dx-sk"><Sk w="30%" h={14} /><Sk h={110} r={10} style={{ marginTop: 14 }} /></div>
      <div className="dx-card dx-narrow dx-sk"><Sk w="40%" h={14} /><Sk h={110} r={10} style={{ marginTop: 14 }} /></div>
    </div>
  </div>;
}

export function Dashboard({ me }) {
  const { rows: s, error } = useList('/admin/stats');
  if (error) return <Page><div className="card err">{error}</div></Page>;
  if (!s) return <Page><DashboardSkeleton /></Page>;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const series = Array.isArray(s.series) ? s.series : [];
  const bookingsSeries = series.map((d) => d.bookings || 0);
  const ordersSeries = series.map((d) => d.orders || 0);
  const revenueSeries = series.map((d) => d.revenue || 0);
  const sum = (a) => a.reduce((t, v) => t + v, 0);
  const statuses = Object.entries(s.bookingsByStatus ?? {}).sort((x, y) => y[1] - x[1]);
  const doneShare = Math.round(((s.bookingsByStatus?.DONE ?? 0) / Math.max(1, s.bookings)) * 100);
  const first = series[0]?.day?.slice(5) ?? '—';
  const mid = series[Math.floor(series.length / 2)]?.day?.slice(5) ?? '';
  const last = series.at(-1)?.day?.slice(5) ?? '—';

  const W = 560, H = 120;
  const actMax = Math.max(1, ...bookingsSeries, ...ordersSeries);
  const pb = pts(bookingsSeries, W, H, actMax), po = pts(ordersSeries, W, H, actMax);
  const revMax = Math.max(1, ...revenueSeries);
  const barW = 100 / Math.max(1, revenueSeries.length);

  return <Page>
    <div className="dx">
      <header className="dx-head">
        <div>
          <h1 className="dx-title">{greeting}, {(me?.name || 'Admin').split(' ')[0]}</h1>
          <p className="dx-lead">{s.openBookings ? `${s.openBookings} booking${s.openBookings === 1 ? '' : 's'} need attention` : 'You’re all caught up'} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        </div>
        {s.openBookings > 0 && <a className="dx-cta" href="#/bookings">Review bookings →</a>}
      </header>

      <div className="dx-grid">
        <div className="dx-kpis">
        <Tile href="#/bookings" label="Open bookings" value={nf.format(s.openBookings)} sub="need attention" color="#e8a33a" />
        <Tile href="#/bookings" label="Today’s jobs" value={nf.format(s.todayBookings)} sub="scheduled today" color="#3a7bd5" />
        <Tile href="#/inbox" label="Unread messages" value={nf.format(s.messages)} sub="in the inbox" color="#7a6cf0" />
        <Tile href="#/users" label="Customers" value={nf.format(s.users)} sub="registered" color="#c0489a" />
        <Tile href="#/bookings" label="Bookings · 30d" value={nf.format(sum(bookingsSeries))} sub={`${nf.format(s.bookings)} all time`} color="#2f9e6b" spark={<Spark vals={bookingsSeries} color="#2f9e6b" />} />
        <Tile href="#/orders" label="Orders · 30d" value={nf.format(sum(ordersSeries))} sub={`${nf.format(s.orders)} all time`} color="#3a7bd5" spark={<Spark vals={ordersSeries} color="#3a7bd5" />} />
        <Tile href="#/orders" label="Sales · 30d" value={money(sum(revenueSeries))} sub={`${money(s.productRevenue)} all time`} color="#e07a2f" spark={<Spark vals={revenueSeries} color="#e07a2f" />} />
        <Tile href="#/bookings" label="Done rate" value={`${doneShare}%`} sub={`${nf.format(s.bookingsByStatus?.DONE ?? 0)} of ${nf.format(s.bookings)} done`} color="#2f9e6b" pct={doneShare} />
        </div>

        <section className="dx-card dx-wide" aria-label="Bookings and orders over the last 30 days">
          <div className="dx-card-head"><h2>Bookings &amp; orders <small>30 days</small></h2>
            <span className="dx-legend"><i style={{ background: '#2f9e6b' }} />Bookings<i style={{ background: '#3a7bd5' }} />Orders</span></div>
          <svg className="dx-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Daily bookings and orders, last 30 days">
            <defs><linearGradient id="dxb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f9e6b" stopOpacity=".22" /><stop offset="1" stopColor="#2f9e6b" stopOpacity="0" /></linearGradient></defs>
            {[0.25, 0.5, 0.75].map((f) => <path key={f} d={`M0 ${H * f}H${W}`} className="dx-grid-line" />)}
            {series.length > 1 && <>
              <path d={areaPath(pb, W, H)} fill="url(#dxb)" />
              <path d={linePath(pb)} fill="none" stroke="#2f9e6b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d={linePath(po)} fill="none" stroke="#3a7bd5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </>}
          </svg>
          <div className="dx-axis"><span>{first}</span><span>{mid}</span><span>{last}</span></div>
        </section>

        <section className="dx-card dx-narrow" aria-label="Bookings by status">
          <div className="dx-card-head"><h2>Bookings by status</h2></div>
          {statuses.length ? <div className="dx-status">
            <div className="dx-stack" role="img" aria-label="Bookings by status">
              {statuses.map(([k, n]) => <i key={k} style={{ flexGrow: n, background: STATUS_HUE[k] ?? '#9a968f' }} title={`${label(k)}: ${n}`} />)}
            </div>
            <ul className="dx-slegend">
              {statuses.map(([k, n]) => <li key={k}><i style={{ background: STATUS_HUE[k] ?? '#9a968f' }} /><span>{label(k)}</span><b>{n}</b><em>{Math.round((n / Math.max(1, s.bookings)) * 100)}%</em></li>)}
            </ul>
          </div> : <p className="dx-empty">No bookings yet.</p>}
        </section>

        <section className="dx-card dx-full" aria-label="Daily shop revenue, last 30 days">
          <div className="dx-card-head"><h2>Daily shop revenue</h2><span className="dx-note">{money(sum(revenueSeries))} in 30 days</span></div>
          <svg className="dx-bars" viewBox="0 0 100 24" preserveAspectRatio="none" role="img" aria-label="Daily shop revenue">
            {revenueSeries.map((v, i) => { const bh = Math.max(v ? 1.5 : 0.6, (v / revMax) * 22); return <rect key={i} x={i * barW + barW * 0.18} y={24 - bh} width={barW * 0.64} height={bh} rx="0.6" className={v ? 'on' : ''} />; })}
          </svg>
          <div className="dx-axis"><span>{first}</span><span>{mid}</span><span>{last}</span></div>
        </section>
      </div>
    </div>
  </Page>;
}

/* ---------- Bookings ---------- */
export function Bookings() {
  const { rows, error, reload } = useList('/admin/bookings');
  const pros = useList('/admin/providers').rows ?? [];
  const next = (s) => (s === 'DONE' || s === 'CANCELLED' ? [] : [FLOW[FLOW.indexOf(s) + 1], 'CANCELLED']);
  return <Page title="Bookings">
    <BookingsInsights rows={rows} />
    <Table error={error} rows={rows} empty="No bookings match." cols={[
      { h: 'Booking', filter: true, v: (b) => b.service.name, render: (b) => <div className="cell2"><b>{b.service.name}</b><small>#{b.id}</small></div> },
      { h: 'Customer', render: (b) => <div className="cell2"><span>{b.name}</span><small>{b.phone}</small></div> },
      { h: 'Schedule', render: (b) => <div className="cell2"><span>{b.day}</span><small>{b.slot}</small></div> },
      { h: 'Address', wrap: true, render: (b) => <span className="clamp muted">{b.address}</span> },
      { h: 'Pro', v: (b) => (pros.find((p) => p.id === b.providerId)?.name ?? 'Unassigned'), render: (b) => {
          const eligible = pros.filter((p) => p.services.some((s) => s.id === b.serviceId))
            .map((p) => ({ ...p, km: b.lat != null && b.lng != null && p.lat != null && p.lng != null ? distanceKm(b.lat, b.lng, p.lat, p.lng) : null }))
            .sort((a, c) => (a.online !== c.online ? (a.online ? -1 : 1) : (a.km ?? Infinity) - (c.km ?? Infinity)));
          return <select value={b.providerId ?? ''} aria-label="Assign pro"
            onChange={(e) => act(() => api(`/admin/bookings/${b.id}/provider`, { method: 'PATCH', body: { providerId: e.target.value ? Number(e.target.value) : null } }), 'Pro updated', reload)}>
            <option value="">Unassigned</option>
            {eligible.map((p) => <option key={p.id} value={p.id}>{p.name}{p.online ? ' · online' : ' · offline'}{p.km != null ? ` · ${p.km < 1 ? '<1 km' : `${Math.round(p.km)} km`}` : ''}</option>)}
          </select>;
        } },
      { h: 'Est.', num: true, render: (b) => <b>{money(b.estimate)}</b> },
      { h: 'Payment', filter: true, v: (b) => b.payment ? b.payment.status : 'COD', render: (b) => b.payment ? <Badge v={b.payment.status} text={`${b.payment.status.toLowerCase()} · online`} /> : <Badge v="COD" text="pay on completion" /> },
      { h: 'Status', filter: true, v: (b) => b.status, render: (b) => <Badge v={b.status} /> },
      { h: '', render: (b) => <div className="row-actions">{next(b.status).map((s) =>
          <button key={s} className={`btn sm ${s === 'CANCELLED' ? 'danger' : ''}`}
            onClick={() => (s !== 'CANCELLED' || confirm(`Cancel booking #${b.id}?`)) && act(() => api(`/bookings/${b.id}/status`, { method: 'PATCH', body: { status: s } }), `#${b.id} → ${label(s)}`, reload)}>
            {s === 'CANCELLED' ? 'Cancel' : `Mark ${label(s)}`}</button>)}</div> },
    ]} />
  </Page>;
}

/* ---------- Orders ---------- */
export function Orders() {
  const { rows, error, reload } = useList('/admin/orders');
  const set = (o, s) => act(() => api(`/admin/orders/${o.id}/status`, { method: 'PATCH', body: { status: s } }), `#${o.id} → ${label(s)}`, reload);
  return <Page title="Orders">
    <OrdersInsights rows={rows} />
    <Table error={error} rows={rows} empty="No orders match." cols={[
      { h: 'ID', render: (o) => <b>#{o.id}</b> },
      { h: 'Placed', render: (o) => when(o.createdAt) },
      { h: 'Customer', wrap: true, render: (o) => <>{o.name}<br /><small>{o.phone}</small></> },
      { h: 'Ship to', wrap: true, render: (o) => `${o.address}, ${o.city} ${o.pin}` },
      { h: 'Items', wrap: true, render: (o) => o.items.map((i) => `${i.qty}× ${i.product.name}`).join(', ') },
      { h: 'Total', render: (o) => <>{money(o.total)}{o.coupon && <> <small>({o.coupon})</small></>}</> },
      { h: 'Payment', filter: true, v: (o) => o.paymentMethod === 'ONLINE' ? (o.payment?.status ?? 'CREATED') : 'COD', render: (o) => o.paymentMethod === 'ONLINE'
        ? <Badge v={o.payment?.status ?? 'CREATED'} text={`${(o.payment?.status ?? 'created').toLowerCase()} · online`} />
        : <Badge v="COD" text="cash on delivery" /> },
      { h: 'Status', filter: true, v: (o) => o.status, render: (o) => <Badge v={o.status} /> },
      { h: '', render: (o) => {
        if (o.status === 'DELIVERED' || o.status === 'CANCELLED') return null;
        const n = ORDER_FLOW[ORDER_FLOW.indexOf(o.status) + 1];
        return <div className="row-actions">
          <button className="btn sm" onClick={() => set(o, n)}>Mark {label(n)}</button>
          <button className="btn sm danger" onClick={() => confirm(`Cancel order #${o.id}?`) && set(o, 'CANCELLED')}>Cancel</button>
        </div>;
      } },
    ]} />
  </Page>;
}

/* ---------- Users ---------- */
export function Users({ me }) {
  const { rows, error, reload } = useList('/admin/users');
  return <Page title="Users">
    <UsersInsights rows={rows} />
    <Table error={error} rows={rows} empty="No users match." cols={[
      { h: 'Name', render: (u) => <b>{u.name}</b> },
      { h: 'Email', render: (u) => u.email },
      { h: 'Phone', render: (u) => u.phone },
      { h: 'Bookings', render: (u) => u._count.bookings },
      { h: 'Orders', render: (u) => u._count.orders },
      { h: 'Joined', render: (u) => when(u.createdAt) },
      { h: 'Role', filter: true, v: (u) => u.role, render: (u) => u.id === me.id ? <Badge v={u.role} /> :
          <select value={u.role} aria-label={`Role for ${u.name}`}
            onChange={(e) => confirm(`Make ${u.name} a ${e.target.value.toLowerCase()}?`) && act(() => api(`/admin/users/${u.id}/role`, { method: 'PATCH', body: { role: e.target.value } }), 'Role updated', reload)}>
            {['CUSTOMER', 'PROVIDER', 'ADMIN'].map((r) => <option key={r} value={r}>{label(r)}</option>)}
          </select> },
    ]} />
  </Page>;
}

/* ---------- Generic catalog CRUD ---------- */
function Crud({ title, path, listPath = path, noun, fields, cols, idKey = 'id', createExtra, Analysis, rowExtra }) {
  const { rows, error, reload } = useList(listPath);
  const [form, setForm] = useState(null); // { row? }
  const key = (r) => r[idKey];
  return <Page title={title} actions={<button className="btn primary" onClick={() => setForm({})}>Add {noun}</button>}>
    {Analysis && <Analysis rows={rows} />}
    <Table error={error} rows={rows} cols={[...cols, { h: '', render: (r) => <div className="row-actions">
      {rowExtra?.(r, reload)}
      <button className="btn sm" onClick={() => setForm({ row: r })}>Edit</button>
      <button className="btn sm danger" onClick={() => confirm(`Delete this ${noun}?`) && act(() => api(`${path}/${key(r)}`, { method: 'DELETE' }), `${noun} deleted`, reload)}>Delete</button>
    </div> }]} />
    {form && <FormModal title={form.row ? `Edit ${noun}` : `New ${noun}`} fields={fields} initial={form.row ? { ...form.row, ...(form.row.services ? { serviceIds: form.row.services.map((s) => s.id) } : {}) } : createExtra}
      onClose={() => setForm(null)}
      onSubmit={async (v) => { await api(form.row ? `${path}/${key(form.row)}` : path, { method: form.row ? 'PATCH' : 'POST', body: v }); await reload(); }} />}
  </Page>;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const serviceImgUrl = (s) => (s.imageVersion > 0 ? `${API_BASE}/services/${s.id}/image?v=${s.imageVersion}` : null);

/* Resize in the browser so uploads stay small (the API caps images at 400 KB); WebP keeps logo transparency. */
async function shrinkImage(file, max = 640) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Choose a PNG, JPG or WebP image.');
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  for (const q of [0.88, 0.72, 0.55]) {
    const url = c.toDataURL('image/webp', q);
    if (url.length < 520_000) return url;
  }
  throw new Error('That image is too detailed to shrink under 400 KB.');
}

function ServiceThumb({ s }) {
  const src = serviceImgUrl(s);
  return src ? <img className="svc-thumb" src={src} alt={`${s.name} image`} loading="lazy" /> : <span className="svc-thumb noimg" aria-label="No image">—</span>;
}

function ServiceImageActions({ s, reload }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await shrinkImage(file);
      await act(() => api(`/admin/services/${s.id}/image`, { method: 'PUT', body: { dataUrl } }), 'Image saved', reload);
    } catch (err) { toast(err.message); }
    setBusy(false);
  };
  return <>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} />
    <button className="btn sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : s.imageVersion > 0 ? 'Change image' : 'Add image'}</button>
    {s.imageVersion > 0 && <button className="btn sm" disabled={busy} onClick={() => confirm('Remove this image?') && act(() => api(`/admin/services/${s.id}/image`, { method: 'DELETE' }), 'Image removed', reload)}>Remove image</button>}
  </>;
}

export function Services() {
  return <Crud title="Services" path="/admin/services" listPath="/services" noun="service" Analysis={ServicesInsights} rowExtra={(s, reload) => <ServiceImageActions s={s} reload={reload} />}
    fields={[
      { key: 'name', label: 'Name', type: 'text' }, { key: 'category', label: 'Category', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'fromPrice', label: 'From price (₹)', type: 'number' }, { key: 'duration', label: 'Duration (minutes)', type: 'number' },
      { key: 'terms', label: 'Search terms', type: 'text', required: false },
    ]}
    cols={[
      { h: 'ID', render: (s) => s.id }, { h: 'Image', thumb: true, v: (s) => (s.imageVersion > 0 ? 'has image' : 'no image'), render: (s) => <ServiceThumb s={s} /> }, { h: 'Name', render: (s) => <b className="svc-name">{s.name}</b> }, { h: 'Category', filter: true, v: (s) => s.category, render: (s) => <span className="svc-cat">{s.category}</span> },
      { h: 'From', render: (s) => <span className="svc-price">{money(s.fromPrice)}</span> }, { h: 'Duration', render: (s) => <span className="svc-dur">{s.duration} min</span> },
      { h: 'Rating', render: (s) => (s.rating ? <span className="svc-rate"><b>★ {s.rating.toFixed(1)}</b><small>({s.reviews})</small></span> : <span className="svc-dur">No reviews</span>) },
    ]} />;
}

export function Providers() {
  const services = useList('/services').rows ?? [];
  const { rows, reload } = useList('/admin/providers');
  const settings = useList('/admin/settings').rows ?? [];
  const defaultCommission = settings.find((d) => d.key === 'rules.defaultCommissionPercent')?.value ?? 20;
  const [link, setLink] = useState(null); // { provider }
  return <>
    <Crud title="Pros" path="/admin/providers" noun="pro" Analysis={ProsInsights}
      createExtra={{ verified: true, years: 1, response: '30 min', commissionPercent: defaultCommission }}
      fields={[
        { key: 'name', label: 'Name', type: 'text' }, { key: 'years', label: 'Years of experience', type: 'number' },
        { key: 'response', label: 'Typical response (e.g. 30 min)', type: 'text' },
        { key: 'verified', label: 'Verified', type: 'bool' },
        { key: 'commissionPercent', label: 'Platform commission (%)', type: 'number' },
        { key: 'serviceIds', label: 'Services offered (ctrl/cmd-click for several)', type: 'multi', options: services },
      ]}
      cols={[
        { h: 'ID', render: (p) => p.id }, { h: 'Name', render: (p) => <b>{p.name}</b> }, { h: 'Experience', render: (p) => `${p.years} yrs` },
        { h: 'Response', render: (p) => p.response }, { h: 'Commission', render: (p) => `${p.commissionPercent}%` },
        { h: 'Verified', filter: true, v: (p) => (p.verified ? 'verified' : 'pending'), render: (p) => <Badge v={p.verified ? 'DONE' : 'REQUESTED'} text={p.verified ? 'verified' : 'pending'} /> },
        { h: 'Services', wrap: true, render: (p) => p.services.map((s) => s.name).join(', ') }, { h: 'Jobs', render: (p) => p._count.bookings },
        { h: 'App login', render: (p) => {
          const row = (rows ?? []).find((r) => r.id === p.id);
          return row?.userId
            ? <div className="row-actions"><Badge v="DONE" text="linked" /><button className="btn sm danger" onClick={() => confirm('Unlink this pro’s app login?') && act(() => api(`/admin/providers/${p.id}/link`, { method: 'PATCH', body: { email: null } }), 'Unlinked', reload)}>Unlink</button></div>
            : <button className="btn sm" onClick={() => setLink({ provider: p })}>Link account</button>;
        } },
      ]} />
    {link && <FormModal title={`Link ${link.provider.name} to a login`} initial={{ email: '' }} onClose={() => setLink(null)}
      fields={[{ key: 'email', label: 'Account email (must already be registered)', type: 'text' }]}
      onSubmit={async (v) => { await api(`/admin/providers/${link.provider.id}/link`, { method: 'PATCH', body: { email: v.email } }); await reload(); }} />}
  </>;
}

export function Products() {
  return <Crud title="Products" path="/admin/products" listPath="/products" noun="product" Analysis={ProductsInsights}
    fields={[
      { key: 'name', label: 'Name', type: 'text' }, { key: 'seller', label: 'Seller', type: 'text' }, { key: 'category', label: 'Category', type: 'text' },
      { key: 'price', label: 'Price (₹)', type: 'number' }, { key: 'oldPrice', label: 'Old price (₹)', type: 'number' },
      { key: 'img', label: 'Image path or URL', type: 'text' }, { key: 'blurb', label: 'Short blurb', type: 'textarea', required: false },
    ]}
    cols={[
      { h: '', thumb: true, render: (p) => <img src={p.img} alt="" width="36" height="36" style={{ objectFit: 'cover', borderRadius: 6 }} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} /> },
      { h: 'Name', wrap: true, render: (p) => <b>{p.name}</b> }, { h: 'Seller', wrap: true, filter: true, v: (p) => p.seller, render: (p) => p.seller }, { h: 'Category', filter: true, v: (p) => p.category, render: (p) => p.category },
      { h: 'Price', render: (p) => <>{money(p.price)} <small><s>{money(p.oldPrice)}</s></small></> },
    ]} />;
}

/* Status label for a coupon card: disabled, expired, used up, or active. */
function couponState(c) {
  if (!c.active) return 'Disabled';
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return 'Expired';
  if (c.usageLimit && (c.uses ?? 0) >= c.usageLimit) return 'Used up';
  return 'Active';
}

export function Coupons() {
  const { rows, error, reload } = useList('/admin/coupons');
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  return <Page title="Coupons" actions={<button className="btn primary" onClick={() => setForm({})}>Add coupon</button>}>
    <CouponsInsights rows={rows} />
    {error && <div className="empty">{error}</div>}
    {rows && !rows.length && <div className="empty">No coupons yet.</div>}
    <div className="coupon-list">
      {(rows || []).map((c) => <button type="button" key={c.code} className={`coupon${c.active ? '' : ' off'}`} onClick={() => setView(c)} aria-label={`View coupon ${c.code}`}>
        <span className="coupon-main">
          <small>Discount coupon</small>
          <b className="coupon-pct">{c.percent}<sup>%</sup> <i>OFF</i></b>
          <span className="coupon-state">{couponState(c)}</span>
        </span>
        <span className="coupon-cut" aria-hidden="true" />
        <span className="coupon-stub">
          <small>Code</small>
          <b className="coupon-code">{c.code}</b>
        </span>
      </button>)}
    </div>
    {view && <Modal title={`Coupon ${view.code}`} onClose={() => setView(null)}>
      <div className={`coupon coupon-lg${view.active ? '' : ' off'}`}>
        <span className="coupon-main">
          <small>Discount coupon</small>
          <b className="coupon-pct">{view.percent}<sup>%</sup> <i>OFF</i></b>
          <span className="coupon-state">{couponState(view)}</span>
        </span>
        <span className="coupon-cut" aria-hidden="true" />
        <span className="coupon-stub"><small>Code</small><b className="coupon-code">{view.code}</b></span>
      </div>
      <ul className="muted" style={{ margin: '14px 0 0', paddingLeft: 18, fontSize: 13 }}>
        <li>Used {view.uses ?? 0}{view.usageLimit ? ` of ${view.usageLimit}` : ''} times</li>
        {view.perUserLimit && <li>{view.perUserLimit} use{view.perUserLimit > 1 ? 's' : ''} per customer</li>}
        {view.minOrder && <li>Minimum order ₹{view.minOrder}</li>}
        {view.maxDiscount && <li>Discount capped at ₹{view.maxDiscount}</li>}
        {view.expiresAt && <li>Expires {new Date(view.expiresAt).toLocaleDateString()}</li>}
      </ul>
      <div className="row-actions" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
        <button className="btn sm" onClick={() => act(() => api(`/admin/coupons/${view.code}`, { method: 'PATCH', body: { active: !view.active } }), view.active ? 'Coupon disabled' : 'Coupon enabled', reload).then(() => setView(null))}>{view.active ? 'Disable' : 'Enable'}</button>
        <button className="btn sm" onClick={() => { setForm({ row: view }); setView(null); }}>Edit</button>
        <button className="btn sm danger" onClick={() => confirm(`Delete ${view.code}?`) && act(() => api(`/admin/coupons/${view.code}`, { method: 'DELETE' }), 'Coupon deleted', reload).then(() => setView(null))}>Delete</button>
      </div>
    </Modal>}
    {form && <CouponEditor row={form.row} onClose={() => setForm(null)} onSave={async (v) => {
      if (form.row) await api(`/admin/coupons/${form.row.code}`, { method: 'PATCH', body: { percent: v.percent, active: v.active, ...v.rules } });
      else await api('/admin/coupons', { method: 'POST', body: { code: v.code.trim().toUpperCase(), percent: v.percent, active: v.active, ...v.rules } });
      await reload();
    }} />}
  </Page>;
}

/* Add/edit popup drawn as a coupon: the discount and code are typed straight onto the ticket. */
function CouponEditor({ row, onClose, onSave }) {
  const [v, setV] = useState({ code: row?.code ?? '', percent: row?.percent ?? 10, active: row?.active ?? true });
  const [r, setR] = useState({
    maxDiscount: row?.maxDiscount ?? '', minOrder: row?.minOrder ?? '', usageLimit: row?.usageLimit ?? '', perUserLimit: row?.perUserLimit ?? '',
    expiresAt: row?.expiresAt ? row.expiresAt.slice(0, 10) : '',
  });
  const n = (x) => (x === '' ? null : Number(x));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await onSave({ ...v, percent: Number(v.percent), rules: { maxDiscount: n(r.maxDiscount), minOrder: n(r.minOrder), usageLimit: n(r.usageLimit), perUserLimit: n(r.perUserLimit), expiresAt: r.expiresAt ? new Date(`${r.expiresAt}T23:59:59`).toISOString() : null } }); onClose(); } catch (e2) { setErr(e2.message); setBusy(false); }
  };
  return <Modal title={row ? 'Edit coupon' : 'New coupon'} onClose={onClose}>
    <form onSubmit={submit}>
      <div className={`coupon coupon-lg coupon-edit${v.active ? '' : ' off'}`}>
        <label className="coupon-main">
          <small>Percent off (1–100)</small>
          <span className="coupon-pct">
            <input type="number" min="1" max="100" required value={v.percent} onChange={(e) => setV({ ...v, percent: e.target.value })} aria-label="Percent off" />
            <sup>%</sup> <i>OFF</i>
          </span>
        </label>
        <span className="coupon-cut" aria-hidden="true" />
        <label className="coupon-stub">
          <small>Code</small>
          <input className="coupon-code" required disabled={!!row} pattern="[A-Za-z0-9_\-]+" placeholder="SAVE10" value={v.code}
            onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} aria-label="Coupon code" />
        </label>
      </div>
      <div className="grid2" style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label className="field">Max discount (₹)<input type="number" min="1" placeholder="No cap" value={r.maxDiscount} onChange={(e) => setR({ ...r, maxDiscount: e.target.value })} /></label>
        <label className="field">Minimum order (₹)<input type="number" min="1" placeholder="None" value={r.minOrder} onChange={(e) => setR({ ...r, minOrder: e.target.value })} /></label>
        <label className="field">Total uses<input type="number" min="1" placeholder="Unlimited" value={r.usageLimit} onChange={(e) => setR({ ...r, usageLimit: e.target.value })} /></label>
        <label className="field">Uses per customer<input type="number" min="1" placeholder="Unlimited" value={r.perUserLimit} onChange={(e) => setR({ ...r, perUserLimit: e.target.value })} /></label>
        <label className="field">Expires on<input type="date" value={r.expiresAt} onChange={(e) => setR({ ...r, expiresAt: e.target.value })} /></label>
      </div>
      <label className="check field" style={{ marginTop: 14 }}>
        <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Active
      </label>
      {err && <p className="err">{err}</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  </Modal>;
}

/* ---------- Home-screen banners ---------- */
export function Banners() {
  const { rows, error, reload } = useList('/admin/banners');
  const [form, setForm] = useState(null);
  return <Page title="Banners" actions={<button className="btn primary" onClick={() => setForm({})}>Add banner</button>}>
    <BannersInsights rows={rows} />
    <Table error={error} rows={rows} empty="No banners yet." cols={[
      { h: 'Order', render: (b) => b.sort },
      { h: 'Banner', render: (b) => <><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 4, background: b.color, marginRight: 8 }} /><b>{b.title}</b><br /><small>{b.subtitle}</small></> },
      { h: 'Offer', render: (b) => b.coupon ? <b>{b.coupon}</b> : '—' },
      { h: 'Opens service', render: (b) => b.serviceId ?? '—' },
      { h: 'Status', filter: true, v: (b) => (b.active ? 'active' : 'inactive'), render: (b) => <Badge v={b.active ? 'DONE' : 'CANCELLED'} text={b.active ? 'active' : 'inactive'} /> },
      { h: '', render: (b) => <div className="row-actions">
        <button className="btn sm" onClick={() => act(() => api(`/admin/banners/${b.id}`, { method: 'PATCH', body: { active: !b.active } }), b.active ? 'Banner hidden' : 'Banner live', reload)}>{b.active ? 'Hide' : 'Show'}</button>
        <button className="btn sm" onClick={() => setForm({ row: b })}>Edit</button>
        <button className="btn sm danger" onClick={() => confirm(`Delete "${b.title}"?`) && act(() => api(`/admin/banners/${b.id}`, { method: 'DELETE' }), 'Banner deleted', reload)}>Delete</button>
      </div> },
    ]} />
    {form && <FormModal title={form.row ? 'Edit banner' : 'New banner'} initial={form.row ? { ...form.row, coupon: form.row.coupon ?? '', img: form.row.img ?? '', serviceId: form.row.serviceId ?? '' } : { active: true, color: '#E6F36B', sort: 0 }} onClose={() => setForm(null)}
      fields={[
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'subtitle', label: 'Subtitle', type: 'text', required: false },
        { key: 'color', label: 'Background colour (hex, e.g. #E6F36B)', type: 'text' },
        { key: 'img', label: 'Image URL (optional)', type: 'text', required: false },
        { key: 'coupon', label: 'Coupon code — adds an Apply button (optional)', type: 'text', required: false },
        { key: 'serviceId', label: 'Service ID to open (optional)', type: 'text', required: false },
        { key: 'sort', label: 'Order (0 = first)', type: 'number' },
        { key: 'active', label: 'Live', type: 'bool' },
      ]}
      onSubmit={async (v) => {
        const body = { ...v, serviceId: v.serviceId === '' || v.serviceId == null ? null : Number(v.serviceId), coupon: v.coupon ?? '', img: v.img ?? '' };
        if (form.row) await api(`/admin/banners/${form.row.id}`, { method: 'PATCH', body });
        else await api('/admin/banners', { method: 'POST', body });
        await reload();
      }} />}
  </Page>;
}

/* ---------- Pro verification (KYC) ---------- */
const DOC_LABELS = { AADHAAR: 'Aadhaar', PAN: 'PAN', DRIVING_LICENCE: 'Driving licence', VOTER_ID: 'Voter ID' };
export function Verification() {
  const { rows, error, reload } = useList('/admin/kyc');
  const [review, setReview] = useState(null); // { row, image, loading, error, rejecting, note }
  const [busy, setBusy] = useState(false);

  const open = async (row) => {
    setReview({ row, image: null, loading: true });
    try { setReview({ row, image: (await api(`/admin/kyc/${row.id}/document`)).image, loading: false }); }
    catch (e) { setReview({ row, image: null, loading: false, error: e.message }); }
  };
  const decide = async (decision) => {
    if (decision === 'REJECTED' && !review.note?.trim()) { setReview((r) => ({ ...r, error: 'Tell the pro what to fix.' })); return; }
    setBusy(true);
    const ok = await act(() => api(`/admin/kyc/${review.row.id}`, { method: 'PATCH', body: { decision, note: review.note?.trim() || undefined } }),
      decision === 'APPROVED' ? `${review.row.name} approved` : `${review.row.name} sent back`, reload);
    setBusy(false);
    if (ok) setReview(null);
  };

  const pending = (rows ?? []).filter((r) => r.kycStatus === 'PENDING').length;
  return <Page title="Verification">
    <p className="muted" style={{ margin: '0 0 14px' }}>{rows ? (pending ? `${pending} pro${pending === 1 ? '' : 's'} waiting for review.` : 'Nothing waiting for review.') : ' '}</p>
    <Table error={error} rows={rows} empty="No pros have submitted documents yet." cols={[
      { h: 'Pro', render: (r) => <div className="cell2"><b>{r.name}</b><small>{r.user?.email ?? 'No login linked'}</small></div> },
      { h: 'Document', render: (r) => r.kyc ? <div className="cell2"><b>{DOC_LABELS[r.kyc.docType] ?? r.kyc.docType}</b><small>{r.kyc.docNumber}</small></div> : '—' },
      { h: 'Submitted', render: (r) => r.kyc ? when(r.kyc.submittedAt) : '—' },
      { h: 'Status', render: (r) => <Badge v={r.kycStatus} /> },
      { h: '', render: (r) => <div className="row-actions"><button className={`btn sm${r.kycStatus === 'PENDING' ? ' primary' : ''}`} onClick={() => open(r)}>{r.kycStatus === 'PENDING' ? 'Review' : 'View'}</button></div> },
    ]} />
    {review && <Modal title={`Verify ${review.row.name}`} onClose={() => !busy && setReview(null)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="cell2"><b>{DOC_LABELS[review.row.kyc?.docType] ?? review.row.kyc?.docType}</b><small>{review.row.kyc?.docNumber}</small></div>
        {review.loading ? <p className="muted">Loading document…</p>
          : review.image ? <a href={review.image} target="_blank" rel="noreferrer"><img src={review.image} alt="Submitted ID document" style={{ width: '100%', maxHeight: 340, objectFit: 'contain', borderRadius: 10, background: 'var(--idle-bg)' }} /></a>
          : <p className="muted">No image on file.</p>}
        {review.row.kycStatus === 'REJECTED' && review.row.kycNote && <p className="muted">Previously sent back: {review.row.kycNote}</p>}
        {review.row.kycStatus === 'PENDING' && <>
          {review.rejecting && <textarea rows={3} maxLength={300} placeholder="What should the pro fix? (shown to them in the app)" value={review.note ?? ''} onChange={(e) => setReview((r) => ({ ...r, note: e.target.value, error: '' }))} />}
          {review.error && <p className="err">{review.error}</p>}
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            {review.rejecting
              ? <><button className="btn" disabled={busy} onClick={() => setReview((r) => ({ ...r, rejecting: false, error: '' }))}>Back</button><button className="btn danger" disabled={busy} onClick={() => decide('REJECTED')}>Send back</button></>
              : <><button className="btn" disabled={busy} onClick={() => setReview((r) => ({ ...r, rejecting: true }))}>Reject</button><button className="btn primary" disabled={busy || review.loading || !review.image} onClick={() => decide('APPROVED')}>Approve</button></>}
          </div>
        </>}
        {review.row.kycStatus !== 'PENDING' && review.error && <p className="err">{review.error}</p>}
      </div>
    </Modal>}
  </Page>;
}

/* ---------- Payouts ---------- */
export function Payouts() {
  const { rows, error, reload } = useList('/admin/payouts');
  const [pay, setPay] = useState(null); // { row }
  const [history, setHistory] = useState(null); // { row, list, error? }
  const reqs = useList('/admin/payout-requests');
  const [resolve, setResolve] = useState(null); // { req, decision }
  const waiting = (reqs.rows ?? []).filter((r) => r.status === 'REQUESTED');

  const openHistory = async (row) => {
    setHistory({ row, list: null });
    try { setHistory({ row, list: await api(`/admin/payouts/${row.providerId}`) }); }
    catch (e) { setHistory({ row, list: [], error: e.message }); }
  };

  return <Page title="Payouts">
    <PayoutsInsights rows={rows} />
    {waiting.length > 0 && <div style={{ marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 8px' }}>Payout requests <span className="muted">({waiting.length} waiting)</span></h3>
      <Table rows={waiting} empty="" cols={[
        { h: 'Pro', render: (r) => <b>{r.name}</b> },
        { h: 'Amount', num: true, render: (r) => <b>{money(r.amount)}</b> },
        { h: 'Pay to', render: (r) => r.details },
        { h: 'Requested', render: (r) => when(r.createdAt) },
        { h: '', render: (r) => <div className="row-actions">
          <button className="btn sm danger" onClick={() => setResolve({ req: r, decision: 'REJECTED' })}>Decline</button>
          <button className="btn sm primary" onClick={() => setResolve({ req: r, decision: 'PAID' })}>Mark paid</button>
        </div> },
      ]} />
    </div>}
    {resolve && <FormModal title={`${resolve.decision === 'PAID' ? 'Mark paid' : 'Decline'} — ${resolve.req.name}, ${money(resolve.req.amount)}`} initial={{ note: '' }} onClose={() => setResolve(null)}
      fields={[{ key: 'note', label: resolve.decision === 'PAID' ? `Payment reference (optional) — paid to ${resolve.req.details}` : 'Reason (shown to the pro)', type: 'text', required: resolve.decision === 'REJECTED' }]}
      onSubmit={async (v) => {
        await api(`/admin/payout-requests/${resolve.req.id}`, { method: 'PATCH', body: { decision: resolve.decision, note: v.note || undefined } });
        await Promise.all([reqs.reload(), reload()]);
      }} />}
    <Table error={error} rows={rows} empty="No pros yet." cols={[
      { h: 'Pro', render: (r) => <b>{r.name}</b> },
      { h: 'Commission', render: (r) => `${r.commissionPercent}%` },
      { h: 'Gross earned', render: (r) => money(r.grossEarned) },
      { h: 'Net earned', render: (r) => money(r.netEarned) },
      { h: 'Paid out', render: (r) => money(r.paidOut) },
      { h: 'Balance due', num: true, render: (r) => <b>{money(r.balanceDue)}</b> },
      { h: '', render: (r) => <div className="row-actions">
        <button className="btn sm" onClick={() => openHistory(r)}>History</button>
        <button className="btn sm primary" disabled={!r.balanceDue} onClick={() => setPay({ row: r })}>Record payout</button>
      </div> },
    ]} />
    {pay && <FormModal title={`Record payout — ${pay.row.name}`} initial={{ amount: pay.row.balanceDue, note: '' }} onClose={() => setPay(null)}
      fields={[
        { key: 'amount', label: `Amount (₹, up to ${money(pay.row.balanceDue)} due)`, type: 'number' },
        { key: 'note', label: 'Note (optional, e.g. UPI ref)', type: 'text', required: false },
      ]}
      onSubmit={async (v) => {
        await api('/admin/payouts', { method: 'POST', body: { providerId: pay.row.providerId, amount: Number(v.amount), note: v.note || undefined } });
        await reload();
      }} />}
    {history && <Modal title={`Payout history — ${history.row.name}`} onClose={() => setHistory(null)}>
      {!history.list ? <p className="muted">Loading…</p>
        : history.error ? <p className="err">{history.error}</p>
        : !history.list.length ? <p className="muted">No payouts recorded yet.</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.list.map((p) => <div key={p.id} className="cell2"><b>{money(p.amount)}</b><small>{when(p.createdAt)}{p.note ? ` · ${p.note}` : ''}</small></div>)}
        </div>}
    </Modal>}
  </Page>;
}

/* ---------- Reviews & messages ---------- */
/* Raw JSON is unreadable: show non-empty fields as "key value" pairs, clamped to two lines,
   with the full JSON available on hover. */
function AuditMeta({ meta }) {
  if (!meta || typeof meta !== 'object') return <span className="muted">—</span>;
  const pairs = Object.entries(meta).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  if (!pairs.length) return <span className="muted">—</span>;
  return <span className="clamp meta" title={JSON.stringify(meta, null, 2)}>
    {pairs.map(([k, v]) => <span key={k}><em>{k}</em> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>)}
  </span>;
}

const AUDIT_ACTION_LABELS = {
  'booking.assign': 'Booking assigned',
  'order.status': 'Order status updated',
  'user.role': 'User role changed',
  'service.create': 'Service created',
  'service.update': 'Service updated',
  'service.delete': 'Service deleted',
  'provider.create': 'Provider created',
  'provider.update': 'Provider updated',
  'provider.link': 'Provider account linked',
  'provider.unlink': 'Provider account unlinked',
  'provider.delete': 'Provider deleted',
  'product.create': 'Product created',
  'product.update': 'Product updated',
  'product.delete': 'Product deleted',
  'banner.create': 'Banner created',
  'banner.update': 'Banner updated',
  'banner.delete': 'Banner deleted',
  'coupon.create': 'Coupon created',
  'coupon.update': 'Coupon updated',
  'coupon.delete': 'Coupon deleted',
  'payout.create': 'Payout recorded',
  'kyc.approved': 'Pro verified',
  'kyc.rejected': 'Pro verification sent back',
  'review.delete': 'Review deleted',
  'message.delete': 'Message deleted',
};
const auditActionLabel = (action) => AUDIT_ACTION_LABELS[action]
  ?? String(action ?? '').split(/[._]/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');

export function AuditLog() {
  const { rows, error } = useList('/admin/audit-log');
  return <Page title="Audit log">
    <AuditInsights rows={rows} labelOf={auditActionLabel} />
    <Table error={error} rows={rows} empty="No admin activity yet." cols={[
      { h: 'When', render: (a) => when(a.createdAt) },
      { h: 'Admin', render: (a) => a.actorEmail },
      { h: 'Action', filter: true, v: (a) => auditActionLabel(a.action), render: (a) => <span className="tag">{auditActionLabel(a.action)}</span> },
      { h: 'Target', render: (a) => <span className="muted">{a.target}</span> },
      { h: 'Details', wrap: true, v: (a) => (a.meta ? JSON.stringify(a.meta) : ''), render: (a) => <AuditMeta meta={a.meta} /> },
    ]} />
  </Page>;
}

export function Inbox() {
  const msgs = useList('/admin/messages');
  const reviews = useList('/admin/reviews');
  return <Page title="Inbox">
    <InboxInsights messages={msgs.rows} reviews={reviews.rows} />
    <h2 className="subsection-title">Contact messages</h2>
    <Table error={msgs.error} rows={msgs.rows} empty="No messages." cols={[
      { h: 'Received', render: (m) => when(m.createdAt) }, { h: 'From', render: (m) => <>{m.name}<br /><small>{m.email}</small></> },
      { h: 'Message', wrap: true, render: (m) => m.message },
      { h: '', render: (m) => <div className="row-actions">
        <a className="btn sm" href={`mailto:${m.email}`}>Reply</a>
        <button className="btn sm danger" onClick={() => confirm('Delete this message?') && act(() => api(`/admin/messages/${m.id}`, { method: 'DELETE' }), 'Deleted', msgs.reload)}>Delete</button>
      </div> },
    ]} />
    <div style={{ height: 24 }} />
    <h2 className="subsection-title">Reviews</h2>
    <Table error={reviews.error} rows={reviews.rows} empty="No reviews." cols={[
      { h: 'Date', render: (r) => when(r.createdAt) }, { h: 'By', render: (r) => r.user.name },
      { h: 'For', render: (r) => `${r.kind} #${r.target}` }, { h: 'Rating', filter: true, v: (r) => `${r.rating} star${r.rating === 1 ? '' : 's'}`, render: (r) => '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) },
      { h: 'Text', wrap: true, render: (r) => <>{r.text || '—'}{r.reply && <small className="muted" style={{ display: 'block' }}>Pro replied: {r.reply}</small>}</> },
      { h: 'Shown', filter: true, v: (r) => (r.hidden ? 'Hidden' : 'Visible'), render: (r) => (r.hidden ? 'Hidden' : 'Visible') },
      { h: '', render: (r) => <div className="row-actions">
        <button className="btn sm" onClick={() => act(() => api(`/admin/reviews/${r.id}`, { method: 'PATCH', body: { hidden: !r.hidden } }), r.hidden ? 'Review shown' : 'Review hidden', reviews.reload)}>{r.hidden ? 'Show' : 'Hide'}</button>
        <button className="btn sm danger" onClick={() => confirm('Delete this review?') && act(() => api(`/admin/reviews/${r.id}`, { method: 'DELETE' }), 'Review removed', reviews.reload)}>Delete</button>
      </div> },
    ]} />
  </Page>;
}

/* ---------- Push notifications ---------- */
const AUDIENCES = [['ALL', 'Everyone'], ['CUSTOMER', 'Customers'], ['PROVIDER', 'Pros']];

export function Notifications() {
  const { rows: log, reload } = useList('/admin/audit-log', { action: 'notification.broadcast' });
  const [v, setV] = useState({ audience: 'ALL', title: 'Fixzy', text: '', href: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const set = (k, x) => setV((p) => ({ ...p, [k]: x }));

  const send = async (e) => {
    e.preventDefault();
    setBusy(true); setResult(null);
    const ok = await act(async () => {
      const r = await api('/admin/notifications/broadcast', { method: 'POST', body: { ...v, href: v.href || undefined } });
      setResult(r);
    }, 'Notification sent', reload);
    setBusy(false);
    if (ok) setV((p) => ({ ...p, text: '' }));
  };

  return <Page title="Notifications">
    <div className="card">
      <h2 className="subsection-title">Send a push notification</h2>
      <form onSubmit={send} className="field-grid">
        <label className="field"><span>Send to</span>
          <select value={v.audience} onChange={(e) => set('audience', e.target.value)}>
            {AUDIENCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="field"><span>Title</span>
          <input type="text" required maxLength={60} value={v.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label className="field"><span>Message</span>
          <textarea rows={3} required maxLength={240} value={v.text} onChange={(e) => set('text', e.target.value)} placeholder="What should they know?" />
        </label>
        <label className="field"><span>Opens screen (optional, e.g. /orders)</span>
          <input type="text" maxLength={200} value={v.href} onChange={(e) => set('href', e.target.value)} placeholder="/orders" />
        </label>
        <div className="actions">
          <button className="btn primary" disabled={busy || !v.text.trim()}>{busy ? 'Sending…' : 'Send notification'}</button>
        </div>
      </form>
      {result && <p className="muted" style={{ marginTop: 10 }}>Sent to {result.sent} device{result.sent === 1 ? '' : 's'} across {result.recipients} recipient{result.recipients === 1 ? '' : 's'}.</p>}
    </div>
    <div style={{ height: 24 }} />
    <h2 className="subsection-title">Recent broadcasts</h2>
    <Table rows={log} empty="No notifications sent yet." cols={[
      { h: 'When', render: (a) => when(a.createdAt) },
      { h: 'Admin', render: (a) => a.actorEmail },
      { h: 'Audience', filter: true, v: (a) => a.target.replace('audience:', ''), render: (a) => <span className="tag">{a.target.replace('audience:', '')}</span> },
      { h: 'Title', render: (a) => a.meta?.title ?? '—' },
      { h: 'Message', wrap: true, render: (a) => a.meta?.text ?? '—' },
      { h: 'Reach', render: (a) => `${a.meta?.sent ?? 0} / ${a.meta?.recipients ?? 0}` },
    ]} />
  </Page>;
}

/* ---------- Admin accounts ---------- */
export function Admins({ me }) {
  const { rows, error, reload } = useList('/admin/admins');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await act(() => api('/admin/admins', { method: 'POST', body: { email } }), 'Admin added', reload);
    setBusy(false);
    if (ok) setEmail('');
  };

  return <Page title="Admins">
    <div className="card">
      <h2 className="subsection-title">Grant admin access</h2>
      <p className="muted">The person must already have an account from the mobile app — this promotes an existing user to admin.</p>
      <form onSubmit={add} className="field-grid">
        <label className="field"><span>Account email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" />
        </label>
        <div className="actions">
          <button className="btn primary" disabled={busy || !email.trim()}>{busy ? 'Adding…' : 'Make admin'}</button>
        </div>
      </form>
    </div>
    <div style={{ height: 24 }} />
    <Table error={error} rows={rows} empty="No other admins yet." cols={[
      { h: 'Name', render: (u) => <b>{u.name}</b> },
      { h: 'Email', render: (u) => u.email },
      { h: 'Phone', render: (u) => u.phone || '—' },
      { h: 'Admin since', render: (u) => when(u.createdAt) },
      { h: '', render: (u) => u.id === me.id ? <span className="muted">You</span> :
        <button className="btn sm danger" onClick={() => confirm(`Remove admin access for ${u.name}?`) && act(() => api(`/admin/admins/${u.id}`, { method: 'DELETE' }), 'Admin access removed', reload)}>Remove</button> },
    ]} />
  </Page>;
}
