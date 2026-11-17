import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { LordIcon } from './LordIcon.jsx';
import { ICONS } from './icons.js';
import { Badge, FormModal, Page, Table, act, money, useList, when } from './ui.jsx';

const FLOW = ['REQUESTED', 'CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS', 'DONE'];
const ORDER_FLOW = ['PLACED', 'SHIPPED', 'DELIVERED'];
const label = (s) => s.replace(/_/g, ' ').toLowerCase();

/* ---------- Dashboard ---------- */
/* Loading state: the real dashboard layout drawn as ghost blocks, each filled with slowly
   drifting, blurred "smoke" (see .sk in styles.css). */
const Sk = ({ w = '100%', h = 14, r, style }) => <span className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} />;
function DashboardSkeleton() {
  return <div className="dash dash-sk" role="status" aria-busy="true" aria-label="Loading dashboard">
    <section className="dash-hero">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sk w={28} h={28} r={9} /><Sk w={54} h={14} /></div>
      <Sk w="72%" h={40} r={12} style={{ marginTop: 22 }} />
      <Sk w="48%" h={40} r={12} style={{ marginTop: 10 }} />
      <Sk w="62%" h={14} style={{ marginTop: 18 }} />
      <div style={{ display: 'flex', gap: 30, marginTop: 28 }}>
        {[0, 1, 2].map((i) => <div key={i}><Sk w={54} h={38} r={10} /><Sk w={70} h={10} style={{ marginTop: 10 }} /></div>)}
      </div>
      <Sk w="40%" h={11} style={{ marginTop: 34 }} />
      <Sk h={14} r={999} style={{ marginTop: 14 }} />
      <div style={{ display: 'flex', gap: 14, marginTop: 16 }}>{[0, 1, 2, 3].map((i) => <Sk key={i} w={44} h={30} r={8} />)}</div>
      <Sk w="28%" h={11} style={{ marginTop: 'auto' }} />
    </section>
    <div className="glow glow-lg sk-card">
      <Sk w={130} h={14} /><Sk w={120} h={56} r={14} style={{ marginTop: 18 }} />
      <Sk h="38%" r={16} style={{ marginTop: 'auto' }} />
    </div>
    {[0, 1, 2, 3].map((i) => <div key={i} className="glow glow-sm sk-card">
      <Sk w="55%" h={13} /><Sk w="42%" h={34} r={10} style={{ marginTop: 14 }} /><Sk w="70%" h={10} style={{ marginTop: 'auto' }} />
    </div>)}
  </div>;
}

/* Parallax: writes scroll progress (--sy) and pointer position (--mx/--my, -1..1) onto the
   dashboard root as CSS variables; layers read them with different depths (see .dash[data-px]).
   One rAF-throttled write per frame, no React re-renders. Skipped for reduced-motion. */
function useParallax(ref, ready) {
  useEffect(() => {
    const el = ref.current;
    if (!ready || !el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0, mx = 0, my = 0, cx = 0, cy = 0;
    const setScroll = () => document.documentElement.style.setProperty('--sy', String(window.scrollY));
    const loop = () => { // ease the pointer toward its target for a floaty, weighted feel
      cx += (mx - cx) * 0.08; cy += (my - cy) * 0.08;
      el.style.setProperty('--mx', cx.toFixed(3)); el.style.setProperty('--my', cy.toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    const move = (e) => { mx = (e.clientX / innerWidth) * 2 - 1; my = (e.clientY / innerHeight) * 2 - 1; };
    addEventListener('pointermove', move, { passive: true });
    addEventListener('scroll', setScroll, { passive: true });
    setScroll(); raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener('pointermove', move); removeEventListener('scroll', setScroll); };
  }, [ref, ready]);
}

export function Dashboard({ me }) {
  const { rows: s, error } = useList('/admin/stats');
  const dashRef = useRef(null);
  useParallax(dashRef, !!s);
  if (error) return <Page><div className="card err">{error}</div></Page>;
  if (!s) return <Page><DashboardSkeleton /></Page>;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const doneShare = Math.round(((s.bookingsByStatus?.DONE ?? 0) / Math.max(1, s.bookings)) * 100);
  const series = Array.isArray(s.series) ? s.series : [];
  const week = series.slice(-7);
  const STATUS_HUE = { DONE: '#2f9e6b', REQUESTED: '#e8a33a', CONFIRMED: '#7a6cf0', ON_THE_WAY: '#3a7bd5', IN_PROGRESS: '#f07a3a', CANCELLED: '#d9534f' };
  const statuses = Object.entries(s.bookingsByStatus ?? {}).sort((x, y) => y[1] - x[1]);
  const bookings30d = series.reduce((total, day) => total + (day.bookings || 0), 0);
  const orders30d = series.reduce((total, day) => total + (day.orders || 0), 0);
  const revenue30d = series.reduce((total, day) => total + (day.revenue || 0), 0);
  const activityMax = Math.max(1, ...series.flatMap((day) => [day.bookings || 0, day.orders || 0]));
  const revenueMax = Math.max(1, ...series.map((day) => day.revenue || 0));

  /* A simple SVG sine-ish path through a value series, normalized into a w×h viewBox —
     the "glowing line" read of a chart, not a bar grid. */
  const wave = (vals, w, h, ceiling) => {
    const m = ceiling || Math.max(1, ...vals);
    const step = w / Math.max(1, vals.length - 1);
    return vals.map((v, i) => `${i ? 'L' : 'M'} ${(i * step).toFixed(1)},${(h - (v / m) * h * 0.82 - h * 0.09).toFixed(1)}`).join(' ');
  };

  return <Page>
    {/* Two-panel layout mirroring the reference: a white "overview" panel on the left (brand,
        headline, two floating stat call-outs, a this-week strip) and a halo-glow card grid
        on the right (one big feature card, two stacked, three equal below). */}
    <div className="dash" data-px ref={dashRef}>
      <section className="dash-hero">
        <div className="dh-top"><div className="dh-badge"><LordIcon icon={ICONS.dashboard} size={16} colors="primary:#232323,secondary:#232323" /></div><span>fixzy.</span></div>
        <h1 className="dh-title">{greeting},<br />{(me?.name || 'Admin').split(' ')[0]}.</h1>
        <p className="dh-sub">{s.openBookings ? `${s.openBookings} bookings need attention today.` : "You're all caught up."}</p>

        <div className="dh-stats">
          <div className="dh-stat"><span className="dh-dot" /><div className="n">{s.openBookings}</div><div className="l">open bookings</div></div>
          <div className="dh-stat"><span className="dh-dot" /><div className="n">{s.todayBookings}</div><div className="l">today's jobs</div></div>
          <div className="dh-stat"><span className="dh-dot" /><div className="n">{s.messages}</div><div className="l">unread messages</div></div>
        </div>

        <div className="dh-status">
          <h2>Bookings by status</h2>
          {statuses.length ? <>
            <div className="seg" role="img" aria-label="Bookings by status">
              {statuses.map(([k, n]) => <i key={k} style={{ flexGrow: n, '--c': STATUS_HUE[k] ?? '#9a968f' }} title={`${label(k)}: ${n}`} />)}
            </div>
            <ul className="seg-legend">
              {statuses.map(([k, n]) => <li key={k} style={{ '--c': STATUS_HUE[k] ?? '#9a968f' }}>
                <span className="n">{n}</span>
                <span className="l"><i />{label(k)}</span>
              </li>)}
            </ul>
          </> : <div className="glow-l" style={{ color: 'var(--muted)' }}>No bookings yet.</div>}
        </div>

        <div className="dh-scrub">
          <span className="dh-scrub-label">This week</span>
          <div className="dh-scrub-track">{week.map((d, i) => <span key={d.day} className={`dh-tick${i === week.length - 1 ? ' on' : ''}`}>{d.day.slice(8)}</span>)}</div>
        </div>
      </section>

      <div className="glow glow-lg" style={{ '--hue': 'var(--c3)', '--hue2': '#d9e84a' }}>
        <div className="glow-head"><h2>Total bookings</h2><span className="glow-chip">last 30 days</span></div>
        <div className="glow-n big">{s.bookings}<small>{s.orders} orders</small></div>
        <svg className="glow-wave" viewBox="0 0 200 60" preserveAspectRatio="none"><path d={wave(series.map((d) => d.bookings || 0), 200, 60)} /></svg>
        <div className="axis light"><span>{series[0]?.day?.slice(5) ?? '—'}</span><span>{series.at(-1)?.day?.slice(5) ?? '—'} · daily trend</span></div>
      </div>

      <div className="glow glow-sm" style={{ '--hue': 'var(--c6)', '--hue2': '#f08a4b' }}>
        <h2>Total shop revenue</h2>
        <div className="glow-n">{money(s.productRevenue)}</div>
        <svg className="glow-wave sm" viewBox="0 0 120 36" preserveAspectRatio="none"><path d={wave(series.map((d) => d.revenue || 0), 120, 36)} /></svg>
      </div>
      <div className="glow glow-sm" style={{ '--hue': 'var(--c5)', '--hue2': '#e9d44c' }}>
        <h2>Done rate</h2>
        <div className="glow-n">{doneShare}<small>%</small></div>
        <svg className="glow-arc" viewBox="0 0 100 52">
          <path d="M6,50 A44,44 0 0,1 94,50" />
          <path d="M6,50 A44,44 0 0,1 94,50" style={{ strokeDasharray: `${doneShare * 1.38} 200` }} />
        </svg>
      </div>
      <div className="glow glow-sm" style={{ '--hue': 'var(--c4)', '--hue2': '#f5a65b' }}>
        <h2>Users</h2><div className="glow-n">{s.users}</div><div className="glow-l">registered customers</div>
      </div>
      <div className="glow glow-sm" style={{ '--hue': 'var(--c9)', '--hue2': '#6fb6d8' }}>
        <h2>Messages</h2><div className="glow-n">{s.messages}</div><div className="glow-l">in the inbox</div>
      </div>
    </div>
    <section className="dash-analytics" aria-label="Last 30 days analytics">
      <article className="analytics-card analytics-volume">
        <div className="analytics-head"><div><span className="analytics-kicker">Activity</span><h2>Bookings &amp; orders</h2></div><span className="analytics-range">Last 30 days</span></div>
        <div className="analytics-legend"><span><i className="legend-bookings" />Bookings</span><span><i className="legend-orders" />Orders</span></div>
        <svg className="analytics-chart" viewBox="0 0 640 168" preserveAspectRatio="none" role="img" aria-label="Daily booking and order counts over the last 30 days">
          {[28, 76, 124].map((y) => <path key={y} className="chart-gridline" d={`M0 ${y}H640`} />)}
          {series.length > 1 && <>
            <path className="chart-line chart-line-bookings" d={wave(series.map((day) => day.bookings || 0), 640, 168, activityMax)} />
            <path className="chart-line chart-line-orders" d={wave(series.map((day) => day.orders || 0), 640, 168, activityMax)} />
          </>}
        </svg>
        <div className="analytics-axis"><span>{series[0]?.day?.slice(5) ?? '—'}</span><span>{series[Math.floor(series.length / 2)]?.day?.slice(5) ?? '—'}</span><span>{series.at(-1)?.day?.slice(5) ?? '—'}</span></div>
      </article>
      <article className="analytics-card analytics-revenue">
        <div className="analytics-head"><div><span className="analytics-kicker">Sales</span><h2>Daily shop revenue</h2></div><span className="analytics-range">Last 30 days</span></div>
        <div className="analytics-revenue-total">{money(revenue30d)}</div>
        <svg className="analytics-chart" viewBox="0 0 420 168" preserveAspectRatio="none" role="img" aria-label="Daily shop revenue over the last 30 days">
          {[28, 76, 124].map((y) => <path key={y} className="chart-gridline" d={`M0 ${y}H420`} />)}
          {series.length > 1 && <path className="chart-line chart-line-revenue" d={wave(series.map((day) => day.revenue || 0), 420, 168, revenueMax)} />}
        </svg>
        <div className="analytics-axis"><span>{series[0]?.day?.slice(5) ?? '—'}</span><span>{series.at(-1)?.day?.slice(5) ?? '—'}</span></div>
      </article>
    </section>
    <section className="dash-period-cards" aria-label="30 day totals">
      <article className="period-card"><span>Bookings · 30 days</span><strong>{bookings30d}</strong><small>of {s.bookings} total bookings</small></article>
      <article className="period-card"><span>Orders · 30 days</span><strong>{orders30d}</strong><small>{s.orders} total orders</small></article>
      <article className="period-card"><span>Sales · 30 days</span><strong>{money(revenue30d)}</strong><small>{money(s.productRevenue)} all time</small></article>
    </section>
  </Page>;
}

/* ---------- Bookings ---------- */
export function Bookings() {
  const { rows, error, reload } = useList('/admin/bookings');
  const pros = useList('/admin/providers').rows ?? [];
  const next = (s) => (s === 'DONE' || s === 'CANCELLED' ? [] : [FLOW[FLOW.indexOf(s) + 1], 'CANCELLED']);
  return <Page title="Bookings">
    <Table error={error} rows={rows} empty="No bookings match." cols={[
      { h: 'Booking', filter: true, v: (b) => b.service.name, render: (b) => <div className="cell2"><b>{b.service.name}</b><small>#{b.id}</small></div> },
      { h: 'Customer', render: (b) => <div className="cell2"><span>{b.name}</span><small>{b.phone}</small></div> },
      { h: 'Schedule', render: (b) => <div className="cell2"><span>{b.day}</span><small>{b.slot}</small></div> },
      { h: 'Address', wrap: true, render: (b) => <span className="clamp muted">{b.address}</span> },
      { h: 'Pro', v: (b) => (pros.find((p) => p.id === b.providerId)?.name ?? 'Unassigned'), render: (b) => <select value={b.providerId ?? ''} aria-label="Assign pro"
          onChange={(e) => act(() => api(`/admin/bookings/${b.id}/provider`, { method: 'PATCH', body: { providerId: e.target.value ? Number(e.target.value) : null } }), 'Pro updated', reload)}>
          <option value="">Unassigned</option>
          {pros.filter((p) => p.services.some((s) => s.id === b.serviceId)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select> },
      { h: 'Est.', num: true, render: (b) => <b>{money(b.estimate)}</b> },
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
    <Table error={error} rows={rows} empty="No orders match." cols={[
      { h: 'ID', render: (o) => <b>#{o.id}</b> },
      { h: 'Placed', render: (o) => when(o.createdAt) },
      { h: 'Customer', wrap: true, render: (o) => <>{o.name}<br /><small>{o.phone}</small></> },
      { h: 'Ship to', wrap: true, render: (o) => `${o.address}, ${o.city} ${o.pin}` },
      { h: 'Items', wrap: true, render: (o) => o.items.map((i) => `${i.qty}× ${i.product.name}`).join(', ') },
      { h: 'Total', render: (o) => <>{money(o.total)}{o.coupon && <> <small>({o.coupon})</small></>}</> },
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
function Crud({ title, path, listPath = path, noun, fields, cols, idKey = 'id', createExtra }) {
  const { rows, error, reload } = useList(listPath);
  const [form, setForm] = useState(null); // { row? }
  const key = (r) => r[idKey];
  return <Page title={title} actions={<button className="btn primary" onClick={() => setForm({})}>Add {noun}</button>}>
    <Table error={error} rows={rows} cols={[...cols, { h: '', render: (r) => <div className="row-actions">
      <button className="btn sm" onClick={() => setForm({ row: r })}>Edit</button>
      <button className="btn sm danger" onClick={() => confirm(`Delete this ${noun}?`) && act(() => api(`${path}/${key(r)}`, { method: 'DELETE' }), `${noun} deleted`, reload)}>Delete</button>
    </div> }]} />
    {form && <FormModal title={form.row ? `Edit ${noun}` : `New ${noun}`} fields={fields} initial={form.row ? { ...form.row, ...(form.row.services ? { serviceIds: form.row.services.map((s) => s.id) } : {}) } : createExtra}
      onClose={() => setForm(null)}
      onSubmit={async (v) => { await api(form.row ? `${path}/${key(form.row)}` : path, { method: form.row ? 'PATCH' : 'POST', body: v }); await reload(); }} />}
  </Page>;
}

export function Services() {
  return <Crud title="Services" path="/admin/services" listPath="/services" noun="service"
    fields={[
      { key: 'name', label: 'Name', type: 'text' }, { key: 'category', label: 'Category', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'fromPrice', label: 'From price (₹)', type: 'number' }, { key: 'duration', label: 'Duration (minutes)', type: 'number' },
      { key: 'terms', label: 'Search terms', type: 'text', required: false },
    ]}
    cols={[
      { h: 'ID', render: (s) => s.id }, { h: 'Name', render: (s) => <b>{s.name}</b> }, { h: 'Category', filter: true, v: (s) => s.category, render: (s) => s.category },
      { h: 'From', render: (s) => money(s.fromPrice) }, { h: 'Duration', render: (s) => `${s.duration} min` },
      { h: 'Rating', render: (s) => (s.rating ? `${s.rating.toFixed(1)} (${s.reviews})` : '—') },
    ]} />;
}

export function Providers() {
  const services = useList('/services').rows ?? [];
  const { rows, reload } = useList('/admin/providers');
  const [link, setLink] = useState(null); // { provider }
  return <>
    <Crud title="Pros" path="/admin/providers" noun="pro"
      createExtra={{ verified: true, years: 1, response: '30 min' }}
      fields={[
        { key: 'name', label: 'Name', type: 'text' }, { key: 'years', label: 'Years of experience', type: 'number' },
        { key: 'response', label: 'Typical response (e.g. 30 min)', type: 'text' },
        { key: 'verified', label: 'Verified', type: 'bool' },
        { key: 'serviceIds', label: 'Services offered (ctrl/cmd-click for several)', type: 'multi', options: services },
      ]}
      cols={[
        { h: 'ID', render: (p) => p.id }, { h: 'Name', render: (p) => <b>{p.name}</b> }, { h: 'Experience', render: (p) => `${p.years} yrs` },
        { h: 'Response', render: (p) => p.response }, { h: 'Verified', filter: true, v: (p) => (p.verified ? 'verified' : 'pending'), render: (p) => <Badge v={p.verified ? 'DONE' : 'REQUESTED'} text={p.verified ? 'verified' : 'pending'} /> },
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
  return <Crud title="Products" path="/admin/products" listPath="/products" noun="product"
    fields={[
      { key: 'name', label: 'Name', type: 'text' }, { key: 'seller', label: 'Seller', type: 'text' }, { key: 'category', label: 'Category', type: 'text' },
      { key: 'price', label: 'Price (₹)', type: 'number' }, { key: 'oldPrice', label: 'Old price (₹)', type: 'number' },
      { key: 'img', label: 'Image path or URL', type: 'text' }, { key: 'blurb', label: 'Short blurb', type: 'textarea', required: false },
    ]}
    cols={[
      { h: '', render: (p) => <img src={p.img} alt="" width="36" height="36" style={{ objectFit: 'cover', borderRadius: 6 }} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} /> },
      { h: 'Name', render: (p) => <b>{p.name}</b> }, { h: 'Seller', filter: true, v: (p) => p.seller, render: (p) => p.seller }, { h: 'Category', filter: true, v: (p) => p.category, render: (p) => p.category },
      { h: 'Price', render: (p) => <>{money(p.price)} <small><s>{money(p.oldPrice)}</s></small></> },
    ]} />;
}

export function Coupons() {
  const { rows, error, reload } = useList('/admin/coupons');
  const [form, setForm] = useState(null);
  return <Page title="Coupons" actions={<button className="btn primary" onClick={() => setForm({})}>Add coupon</button>}>
    <Table error={error} rows={rows} cols={[
      { h: 'Code', render: (c) => <b>{c.code}</b> }, { h: 'Discount', render: (c) => `${c.percent}%` },
      { h: 'Status', filter: true, v: (c) => (c.active ? 'active' : 'inactive'), render: (c) => <Badge v={c.active ? 'DONE' : 'CANCELLED'} text={c.active ? 'active' : 'inactive'} /> },
      { h: '', render: (c) => <div className="row-actions">
        <button className="btn sm" onClick={() => act(() => api(`/admin/coupons/${c.code}`, { method: 'PATCH', body: { active: !c.active } }), c.active ? 'Coupon disabled' : 'Coupon enabled', reload)}>{c.active ? 'Disable' : 'Enable'}</button>
        <button className="btn sm" onClick={() => setForm({ row: c })}>Edit</button>
        <button className="btn sm danger" onClick={() => confirm(`Delete ${c.code}?`) && act(() => api(`/admin/coupons/${c.code}`, { method: 'DELETE' }), 'Coupon deleted', reload)}>Delete</button>
      </div> },
    ]} />
    {form && <FormModal title={form.row ? 'Edit coupon' : 'New coupon'} initial={form.row ?? { active: true }} onClose={() => setForm(null)}
      fields={[{ key: 'code', label: 'Code (A–Z, 0–9, - _)', type: 'text', locked: true }, { key: 'percent', label: 'Percent off (1–100)', type: 'number' }, { key: 'active', label: 'Active', type: 'bool' }]}
      onSubmit={async (v) => {
        if (form.row) await api(`/admin/coupons/${form.row.code}`, { method: 'PATCH', body: { percent: v.percent, active: v.active } });
        else await api('/admin/coupons', { method: 'POST', body: { ...v, code: v.code.trim().toUpperCase() } });
        await reload();
      }} />}
  </Page>;
}

/* ---------- Home-screen banners ---------- */
export function Banners() {
  const { rows, error, reload } = useList('/admin/banners');
  const [form, setForm] = useState(null);
  return <Page title="Banners" actions={<button className="btn primary" onClick={() => setForm({})}>Add banner</button>}>
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
  'review.delete': 'Review deleted',
  'message.delete': 'Message deleted',
};
const auditActionLabel = (action) => AUDIT_ACTION_LABELS[action]
  ?? String(action ?? '').split(/[._]/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');

export function AuditLog() {
  const { rows, error } = useList('/admin/audit-log');
  return <Page title="Audit log">
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
      { h: 'Text', wrap: true, render: (r) => r.text || '—' },
      { h: '', render: (r) => <button className="btn sm danger" onClick={() => confirm('Delete this review?') && act(() => api(`/admin/reviews/${r.id}`, { method: 'DELETE' }), 'Review removed', reviews.reload)}>Delete</button> },
    ]} />
  </Page>;
}
