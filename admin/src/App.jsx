import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { login, logout, refresh } from './api.js';
import { Toaster } from './ui.jsx';
import { LordIcon } from './LordIcon.jsx';
import heroImg from './assets/login-hero.webp';
import { ICONS } from './icons.js';
import { AuditLog, Banners, Bookings, Coupons, Dashboard, Inbox, Orders, Products, Providers, Services, Users } from './pages.jsx';

/* Vivid active-state colour per section (bg) and the icon colour that reads best on it. */
const BRIGHT = {
  c1: ['#c9dc2a', '#232323'], c2: ['#ff8a2a', '#fff'], c3: ['#22c55e', '#fff'], c4: ['#ec4899', '#fff'],
  c5: ['#3b82f6', '#fff'], c6: ['#ffc21a', '#232323'], c7: ['#14b8a6', '#fff'], c8: ['#f4533a', '#fff'],
  c9: ['#8b5cf6', '#fff'], c10: ['#64748b', '#fff'], c11: ['#06b6d4', '#fff'],
};

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

/* The highlight behind the active nav icon is one floating element so it can *flow* between
   icons like water: its leading edge races ahead while the trailing edge lags behind, so the
   blob stretches across the gap and then contracts into the new icon. Its edges are driven
   by left/right (not width), and the bar itself has a fixed width, so nothing ever resizes. */
function useLiquidIndicator(navRef, route, ready) {
  const [style, setStyle] = useState(null);
  const prev = useRef(null); // { left, hue } of the previously selected item
  const raf = useRef(0);

  useLayoutEffect(() => {
    const parent = navRef.current;
    const el = parent?.querySelector('a.on');
    if (!parent || !el) return;
    const left = el.offsetLeft, right = parent.clientWidth - (el.offsetLeft + el.offsetWidth);
    const hue = BRIGHT[el.dataset.hue]?.[0] ?? '#8b5cf6';
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const glow = (c) => `0 8px 20px -6px color-mix(in srgb, ${c} 65%, transparent), inset 0 1px 0 rgba(255,255,255,.45), inset 0 -6px 12px -8px rgba(0,0,0,.18)`;
    cancelAnimationFrame(raf.current);

    if (!prev.current || reduced) {
      setStyle({ left, right, background: hue, boxShadow: glow(hue), transition: 'none' });
    } else {
      const { left: pl, hue: from } = prev.current;
      const forward = left > pl;
      const ease = 'cubic-bezier(.22,1,.36,1)';
      const lead = `.42s ${ease}`, lag = `.7s ${ease} .06s`;
      // Colour is a 3x-wide gradient (old | blend | new) laid over the blob. Its position starts
      // on the old colour and slides to the new one, so the hue visibly *runs through* the blob
      // from the old icon toward the new, in the direction of travel, while it stretches.
      const dir = forward ? 'to right' : 'to left';
      const image = `linear-gradient(${dir}, ${from} 0%, ${from} 30%, ${hue} 70%, ${hue} 100%)`;
      const edges = `left ${forward ? lag : lead}, right ${forward ? lead : lag}`;
      setStyle({ left, right, backgroundImage: image, backgroundSize: '300% 100%', backgroundPosition: forward ? '0% 0' : '100% 0',
        backgroundColor: from, boxShadow: glow(from), transition: `${edges}, background-position 0s, box-shadow 0s` });
      raf.current = requestAnimationFrame(() => { raf.current = requestAnimationFrame(() => {
        setStyle({ left, right, backgroundImage: image, backgroundSize: '300% 100%', backgroundPosition: forward ? '100% 0' : '0% 0',
          backgroundColor: hue, boxShadow: glow(hue),
          transition: `${edges}, background-position .85s cubic-bezier(.45,.05,.25,1), background-color .85s ease, box-shadow .85s ease` });
      }); });
    }
    prev.current = { left, hue };
  }, [route, ready]);

  return style;
}

function Login({ onDone }) {
  const [email, setEmail] = useState('admin@fixzy.app') /* demo prefill for testing */;
  const [password, setPassword] = useState('testpass123');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { onDone(await login(email, password)); } catch (e2) { setErr(e2.message || 'Could not sign in.'); setBusy(false); }
  };
  return <main className="lg">
    <section className="lg-form">
      <a className="lg-brand" href="#/" aria-label="Fixzy">fixzy<i aria-hidden="true" /></a>
      <form onSubmit={submit}>
        <h1>Welcome back</h1>
        <p className="lg-sub">Sign in to manage bookings, pros and orders.</p>
        <label className="lg-field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></label>
        <label className="lg-field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
        {err && <p className="lg-err" role="alert">{err}</p>}
        <button className="lg-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="lg-foot">Fixzy admin · authorised staff only</p>
    </section>
    <aside className="lg-art" aria-hidden="true">
      <img src={heroImg} alt="" />
      <div className="lg-card">
        <b>Every booking, one calm place.</b>
        <span>Assign pros, track orders and keep customers happy.</span>
      </div>
    </aside>
  </main>;
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking session
  const route = useHash();
  const navRef = useRef(null);
  const indicator = useLiquidIndicator(navRef, route, user !== undefined && !!user); // called unconditionally — see Rules of Hooks

  useEffect(() => { refresh().then((u) => setUser(u.role === 'ADMIN' ? u : null), () => setUser(null)); }, []);

  /* Page transitions: the old page fades out slowly, then the new one is mounted and eases in.
     `shown` lags `route` by the fade-out time; the nav indicator still follows `route` at once. */
  const [shown, setShown] = useState(route);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (route === shown) return;
    setLeaving(true);
    const t = setTimeout(() => { setShown(route); setLeaving(false); window.scrollTo({ top: 0 }); }, 380);
    return () => clearTimeout(t);
  }, [route, shown]);

  if (user === undefined) return null;
  if (!user) return <><Login onDone={setUser} /><Toaster /></>;

  const found = ROUTES.find((r) => r[0] === shown) ?? ROUTES[0];
  const [, , Page] = found;

  return <div className="shell">
    {/* Bottom-pinned bar: oversized brand typography fills the bar, stays put on every page. */}
    <header className="topbar">
      <div className="brand">
        <a className="word" href="#/" aria-label="Fixzy home">fixzy<i aria-hidden="true" /></a>
      </div>
      <div className="right">
        <button className="iconbtn" aria-label="Notifications" title="Inbox" onClick={() => (location.hash = '#/inbox')}>
          <LordIcon icon={ICONS.bell} size={18} colors="primary:#f2f4fa,secondary:#f2f4fa" />
          <span className="ping" aria-hidden="true" />
        </button>
        <div className="who-chip">
          <span className="name">{user.name || user.email.split('@')[0]}</span>
          <div className="av" title={user.email}>{initials(user.name || user.email)}</div>
          <button className="signout" aria-label="Sign out" title="Sign out" onClick={async () => { await logout(); setUser(null); }}>
            <LordIcon icon={ICONS.logout} size={16} colors="primary:#f2f4fa,secondary:#f2f4fa" />
          </button>
        </div>
      </div>
    </header>

    <nav className="side" aria-label="Admin" ref={navRef}>
      {indicator && <span className="side-indicator" style={indicator} aria-hidden="true" />}
      {ROUTES.map(([id, name, , icon, hue]) => <a key={id} href={`#/${id}`} data-hue={hue} className={route === id ? 'on' : ''} aria-current={route === id ? 'page' : undefined}
        style={{ '--on-ink': BRIGHT[hue][1] }}>
        <LordIcon icon={icon} size={22} colors={route === id ? `primary:${BRIGHT[hue][1]},secondary:${BRIGHT[hue][1]}` : 'primary:#e9ecf5,secondary:#e9ecf5'} trigger={route === id ? 'loop' : 'hover'} />
        <span className="tip">{name}</span>
      </a>)}
    </nav>

    <main className={`main${leaving ? ' leaving' : ''}`}><div className="page-view" key={shown}><Page me={user} /></div></main>
    <Toaster />
  </div>;
}
