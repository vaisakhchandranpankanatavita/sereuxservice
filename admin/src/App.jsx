import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { login, logout, refresh } from './api.js';
import { Toaster } from './ui.jsx';
import { LordIcon } from './LordIcon.jsx';
import { HUES, ICONS } from './icons.js';
import { AuditLog, Banners, Bookings, Coupons, Dashboard, Inbox, Orders, Products, Providers, Services, Users } from './pages.jsx';

const ROUTES = [
  ['dashboard', 'Dashboard', Dashboard, ICONS.dashboard, 'c1'],
  ['bookings', 'Bookings', Bookings, ICONS.bookings, 'c2'],
  ['orders', 'Orders', Orders, ICONS.orders, 'c3'],
  ['users', 'Users', Users, ICONS.users, 'c4'],
  ['services', 'Services', Services, ICONS.services, 'c5'],
  ['pros', 'Pros', Providers, ICONS.pros, 'c6'],
  ['products', 'Products', Products, ICONS.products, 'c7'],
  ['coupons', 'Coupons', Coupons, ICONS.coupons, 'c8'],
  ['banners', 'Banners', Banners, ICONS.banners, 'c11'],
  ['inbox', 'Inbox', Inbox, ICONS.inbox, 'c9'],
  ['audit-log', 'Audit log', AuditLog, ICONS.auditLog, 'c10'],
];

const useHash = () => {
  const get = () => location.hash.slice(2) || 'dashboard';
  const [h, setH] = useState(get);
  useEffect(() => { const f = () => setH(get()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
};

const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

/* The highlight behind the active nav icon is one floating element, not a class toggled on
   two different icons — so it can flow between them. On each route change it first snaps
   (no transition) to the union of the old and new icon's rects — a wide blob spanning both —
   then, a frame later, eases down into the new icon's exact rect. That collapse from "wide
   blob" to "tight pill" is what reads as a waxy, fluid drip rather than a slide. */
function useLiquidIndicator(navRef, route) {
  const [style, setStyle] = useState(null);
  const prev = useRef(null);

  useLayoutEffect(() => {
    const parent = navRef.current;
    const el = parent?.querySelector('a.on');
    if (!parent || !el) return;
    const pr = parent.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const bg = getComputedStyle(el).getPropertyValue('--item-bg').trim();
    const target = { x: er.left - pr.left + parent.scrollLeft, w: er.width, bg };

    if (!prev.current) {
      prev.current = target;
      setStyle({ transform: `translateX(${target.x}px)`, width: target.w, background: target.bg, transition: 'none' });
      return;
    }
    const from = prev.current;
    const x = Math.min(from.x, target.x);
    const w = Math.max(from.x + from.w, target.x + target.w) - x;
    setStyle({ transform: `translateX(${x}px)`, width: w, background: target.bg, transition: 'none' });
    const raf = requestAnimationFrame(() => setStyle({
      transform: `translateX(${target.x}px)`, width: target.w, background: target.bg,
      transition: 'transform .5s cubic-bezier(.16,1,.3,1), width .5s cubic-bezier(.16,1,.3,1), background .35s ease',
    }));
    prev.current = target;
    return () => cancelAnimationFrame(raf);
  }, [route]);

  return style;
}

function Login({ onDone }) {
  const [email, setEmail] = useState('admin@fixzy.app') /* demo prefill for testing */;
  const [password, setPassword] = useState('testpass123');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { onDone(await login(email, password)); } catch (e2) { setErr(`ACCESS DENIED — ${e2.message}`); setBusy(false); }
  };
  return <div className="login crt">
    <div className="scanlines" aria-hidden="true" />
    <form className="card" onSubmit={submit}>
      <div className="title-row">
        <span className="glyph" aria-hidden="true">
          <svg viewBox="0 0 8 8" width="28" height="28" shapeRendering="crispEdges">
            <path fill="#5ee87a" d="M1,0h2v1h-2z M0,1h1v2h-1z M3,1h1v1h-1z M1,2h2v1h-2z M4,2h2v1h-2z M2,3h1v1h-1z M6,3h1v1h-1z M3,4h1v1h-1z M7,4h1v2h-1z M4,5h2v1h-2z M5,6h2v1h-2z" />
          </svg>
        </span>
        <h1>FIXZY<span className="blink">_</span>ADMIN</h1>
      </div>
      <div className="pixel-rule" aria-hidden="true" />
      <p className="sub">&gt; INSERT CREDENTIALS TO CONTINUE</p>
      <label className="field"><span>&gt; EMAIL_</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field"><span>&gt; PASSWORD_</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {err && <p className="err" role="alert">&gt; {err}</p>}
      <button className="btn-start" disabled={busy}>{busy ? 'LOADING…' : 'PRESS START'}</button>
      <div className="status-bar">
        <span className="dot" aria-hidden="true" /> READY
      </div>
    </form>
  </div>;
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking session
  const route = useHash();
  const navRef = useRef(null);
  const indicator = useLiquidIndicator(navRef, route); // called unconditionally — see Rules of Hooks

  useEffect(() => { refresh().then((u) => setUser(u.role === 'ADMIN' ? u : null), () => setUser(null)); }, []);

  if (user === undefined) return null;
  if (!user) return <><Login onDone={setUser} /><Toaster /></>;

  const found = ROUTES.find((r) => r[0] === route) ?? ROUTES[0];
  const [, pageTitle, Page] = found;

  return <div className="shell">
    {/* Bottom-pinned bar: oversized brand typography fills the bar, stays put on every page. */}
    <header className="topbar">
      <div className="brand">
        <div className="dot"><LordIcon icon={ICONS.dashboard} size={24} colors="primary:#232323,secondary:#232323" trigger="loop" /></div>
        <span className="word">fixzy<b>.</b> <span style={{ fontWeight: 800, opacity: .35, fontSize: '0.6em' }}>/ {pageTitle}</span></span>
      </div>
      <div className="right">
        <button className="iconbtn" aria-label="Notifications" onClick={() => (location.hash = '#/inbox')}>
          <LordIcon icon={ICONS.bell} size={20} colors="primary:#232323,secondary:#232323" />
        </button>
        <div className="who-chip">
          <div className="av">{initials(user.name || user.email)}</div>
          <span className="email">{user.email}</span>
          <button aria-label="Sign out" title="Sign out" onClick={async () => { await logout(); setUser(null); }}>
            <LordIcon icon={ICONS.logout} size={18} colors="primary:#c13a3a,secondary:#c13a3a" />
          </button>
        </div>
      </div>
    </header>

    <nav className="side" aria-label="Admin" ref={navRef}>
      {indicator && <span className="side-indicator" style={indicator} aria-hidden="true" />}
      {ROUTES.map(([id, name, , icon, hue]) => <a key={id} href={`#/${id}`} className={route === id ? 'on' : ''} aria-current={route === id ? 'page' : undefined}
        style={{ '--item-bg': `var(--${hue}-bg)`, '--item-color': `var(--${hue})` }}>
        <LordIcon icon={icon} size={22} colors={route === id ? `primary:${HUES[hue]},secondary:${HUES[hue]}` : 'primary:#d4d5db,secondary:#d4d5db'} trigger={route === id ? 'loop' : 'hover'} />
        <span className="tip">{name}</span>
      </a>)}
    </nav>

    <main className="main"><Page me={user} /></main>
    <Toaster />
  </div>;
}
