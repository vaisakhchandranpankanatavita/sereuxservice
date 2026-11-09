import { useEffect, useState } from 'react';
import { login, logout, refresh } from './api.js';
import { Toaster } from './ui.jsx';
import { LordIcon } from './LordIcon.jsx';
import { HUES, ICONS } from './icons.js';
import { AuditLog, Bookings, Coupons, Dashboard, Inbox, Orders, Products, Providers, Services, Users } from './pages.jsx';

const ROUTES = [
  ['dashboard', 'Dashboard', Dashboard, ICONS.dashboard, 'c1'],
  ['bookings', 'Bookings', Bookings, ICONS.bookings, 'c2'],
  ['orders', 'Orders', Orders, ICONS.orders, 'c3'],
  ['users', 'Users', Users, ICONS.users, 'c4'],
  ['services', 'Services', Services, ICONS.services, 'c5'],
  ['pros', 'Pros', Providers, ICONS.pros, 'c6'],
  ['products', 'Products', Products, ICONS.products, 'c7'],
  ['coupons', 'Coupons', Coupons, ICONS.coupons, 'c8'],
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

function Login({ onDone }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { onDone(await login(email, password)); } catch (e2) { setErr(e2.message); setBusy(false); }
  };
  return <div className="login"><form className="card" onSubmit={submit}>
    <h1>Fixzy Admin</h1><p className="sub">Sign in with an admin account.</p>
    <label className="field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
    <label className="field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
    {err && <p className="err" role="alert">{err}</p>}
    <button className="btn primary" disabled={busy} style={{ width: '100%' }}>{busy ? 'Signing in…' : 'Sign in'}</button>
  </form></div>;
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking session
  const route = useHash();

  useEffect(() => { refresh().then((u) => setUser(u.role === 'ADMIN' ? u : null), () => setUser(null)); }, []);

  if (user === undefined) return null;
  if (!user) return <><Login onDone={setUser} /><Toaster /></>;

  const found = ROUTES.find((r) => r[0] === route) ?? ROUTES[0];
  const [, pageTitle, Page] = found;

  return <div className="shell">
    {/* Fixed, full-height topbar: oversized brand typography fills the bar, stays put on every page. */}
    <header className="topbar">
      <div className="brand">
        <div className="dot"><LordIcon icon={ICONS.dashboard} size={24} colors="primary:#ffffff,secondary:#ffffff" trigger="loop" /></div>
        <span className="word">fixzy<b>.</b> <span style={{ fontWeight: 800, opacity: .35, fontSize: '0.6em' }}>/ {pageTitle}</span></span>
      </div>
      <div className="right">
        <button className="iconbtn" aria-label="Notifications" onClick={() => (location.hash = '#/inbox')}>
          <LordIcon icon={ICONS.bell} size={20} colors="primary:#15171c,secondary:#6d5efc" />
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

    <nav className="side" aria-label="Admin">
      {ROUTES.map(([id, name, , icon, hue]) => <a key={id} href={`#/${id}`} className={route === id ? 'on' : ''} aria-current={route === id ? 'page' : undefined}
        style={{ '--item-bg': `var(--${hue}-bg)`, '--item-color': `var(--${hue})` }}>
        <LordIcon icon={icon} size={22} colors={route === id ? `primary:${HUES[hue]},secondary:${HUES[hue]}` : 'primary:#6b7280,secondary:#6b7280'} trigger={route === id ? 'loop' : 'hover'} />
        <span className="tip">{name}</span>
      </a>)}
    </nav>

    <main className="main"><Page me={user} /></main>
    <Toaster />
  </div>;
}
