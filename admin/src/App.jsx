import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { animated, useSpring } from '@react-spring/web';
import { login, logout, refresh } from './api.js';
import { AppLoader, Toaster } from './ui.jsx';
import { LordIcon } from './LordIcon.jsx';
import { ICONS } from './icons.js';
import { AuditLog, Banners, Bookings, Coupons, Dashboard, Inbox, Orders, Products, Providers, Services, Users } from './pages.jsx';

/* Vivid active-state colour per section (bg) and the icon colour that reads best on it. */
const BRIGHT = {
  c1: ['#d5e2a1', '#263023'], c2: ['#d5e2a1', '#263023'], c3: ['#d5e2a1', '#263023'], c4: ['#d5e2a1', '#263023'],
  c5: ['#d5e2a1', '#263023'], c6: ['#d5e2a1', '#263023'], c7: ['#d5e2a1', '#263023'], c8: ['#d5e2a1', '#263023'],
  c9: ['#d5e2a1', '#263023'], c10: ['#d5e2a1', '#263023'], c11: ['#d5e2a1', '#263023'],
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

/* One indicator travels between fixed nav cells. WAAPI keeps movement smooth on the
   compositor while a brief stretch-and-settle gives it a water-drop feel. */
function useLiquidIndicator(navRef, indicatorRef, route, ready) {
  const prev = useRef(null);

  useLayoutEffect(() => {
    const parent = navRef.current;
    const indicator = indicatorRef.current;
    const el = parent?.querySelector('a.on');
    if (!parent || !indicator || !el) return;
    const left = el.offsetLeft;
    const width = el.offsetWidth;
    const hue = BRIGHT[el.dataset.hue]?.[0] ?? '#8b5cf6';
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const glow = (c) => `0 8px 20px -6px color-mix(in srgb, ${c} 65%, transparent), inset 0 1px 0 rgba(255,255,255,.45), inset 0 -6px 12px -8px rgba(0,0,0,.18)`;

    indicator.getAnimations().forEach((animation) => animation.cancel());
    indicator.style.left = '0px';
    indicator.style.right = 'auto';
    indicator.style.width = `${width}px`;
    indicator.style.transform = `translate3d(${left}px, 0, 0)`;
    indicator.style.backgroundColor = hue;
    indicator.style.boxShadow = glow(hue);

    if (prev.current && !reduced) {
      const { left: fromLeft, hue: fromHue } = prev.current;
      const forward = left >= fromLeft;
      const start = `translate3d(${fromLeft}px, 0, 0)`;
      const mid = `translate3d(${fromLeft + (left - fromLeft) * .58}px, 0, 0) scaleX(1.18)`;
      const near = `translate3d(${left}px, 0, 0) scaleX(.92)`;
      const end = `translate3d(${left}px, 0, 0) scaleX(1)`;
      indicator.style.transformOrigin = forward ? 'left center' : 'right center';
      indicator.animate([
        { transform: `${start} scaleX(1)`, backgroundColor: fromHue, boxShadow: glow(fromHue), borderRadius: '999px' },
        { transform: mid, backgroundColor: `color-mix(in srgb, ${fromHue} 42%, ${hue})`, boxShadow: glow(hue), borderRadius: forward ? '48% 52% 52% 48% / 50%' : '52% 48% 48% 52% / 50%', offset: .52 },
        { transform: near, backgroundColor: hue, boxShadow: glow(hue), borderRadius: '999px', offset: .84 },
        { transform: end, backgroundColor: hue, boxShadow: glow(hue), borderRadius: '999px' },
      ], { duration: 720, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' });
    }
    prev.current = { left, hue };
  }, [navRef, indicatorRef, route, ready]);
}

function FloatingNote() {
  const motionAllowed = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const float = useSpring({
    from: { y: 0 },
    to: { y: motionAllowed ? -7 : 0 },
    loop: motionAllowed ? { reverse: true } : false,
    config: { mass: 1.2, tension: 90, friction: 24 },
  });
  return <animated.div className="lg-float-note" style={{ transform: float.y.to((y) => `translate3d(0, ${y}px, 0)`) }} aria-hidden="true">
    <span className="lg-float-check">✓</span><span><b>All in one place</b><small>Bookings · Orders · Teams</small></span>
  </animated.div>;
}

function Login({ onDone }) {
  const [email, setEmail] = useState('admin@fixzy.app') /* demo prefill for testing */;
  const [password, setPassword] = useState('testpass123');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [buttonHover, setButtonHover] = useState(false);
  const [buttonPress, setButtonPress] = useState(false);
  const loginRef = useRef(null);
  const motionAllowed = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const buttonMotion = useSpring({
    transform: `translate3d(0, ${motionAllowed && buttonHover ? -1 : 0}px, 0) scale(${motionAllowed && buttonPress ? .985 : 1})`,
    config: { mass: .45, tension: 360, friction: 24 },
  });

  useLayoutEffect(() => {
    const root = loginRef.current;
    if (!root) return undefined;
    const ctx = gsap.context(() => {
      if (motionAllowed) {
        const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
        intro.fromTo('.lg-form-panel', { autoAlpha: 0, x: -18 }, { autoAlpha: 1, x: 0, duration: .72 })
          .fromTo('.login-kicker', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .45 }, '-=.32')
          .fromTo('.lg-content h1', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .62 }, '-=.22')
          .fromTo('.lg-sub, .lg-field, .lg-btn', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .46, stagger: .075 }, '-=.28')
          .fromTo('.lg-art-glow', { autoAlpha: 0, scale: .82 }, { autoAlpha: 1, scale: 1, duration: 1.1, stagger: .12 }, '-=1.05')
          .fromTo('.lg-illustration', { autoAlpha: 0, y: 22, scale: .96 }, { autoAlpha: 1, y: 0, scale: 1, duration: .85, ease: 'power2.out' }, '-=.92')
          .fromTo('.lg-art-copy', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .55 }, '-=.36');
      }

      // The illustration's continuous loops are CSS-driven so they keep running
      // independently of the route entrance timeline and browser frame timing.
    }, root);
    return () => ctx.revert();
  }, [motionAllowed]);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { onDone(await login(email, password)); } catch (e2) { setErr(e2.message || 'Could not sign in.'); setBusy(false); }
  };
  return <main className="lg" ref={loginRef}>
    <section className="lg-form-panel">
      <a className="lg-brand" href="#/" aria-label="Fixzy admin home">fixzy<i aria-hidden="true" /><span>ADMIN</span></a>
      <div className="lg-content">
        <p className="login-kicker"><i /> FIXZY ADMINISTRATION</p>
        <h1>Welcome<br /><span>back.</span></h1>
        <p className="lg-sub">Sign in to manage bookings, services, and your marketplace.</p>
        <form onSubmit={submit}>
          <label className="lg-field"><span>Email address</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></label>
          <label className="lg-field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" /></label>
          {err && <p className="lg-err" role="alert">{err}</p>}
          <animated.button className="lg-btn" style={buttonMotion} disabled={busy}
            onPointerEnter={() => setButtonHover(true)} onPointerLeave={() => { setButtonHover(false); setButtonPress(false); }}
            onPointerDown={() => setButtonPress(true)} onPointerUp={() => setButtonPress(false)}
            onFocus={() => setButtonHover(true)} onBlur={() => { setButtonHover(false); setButtonPress(false); }}>
            <span>{busy ? 'Signing in…' : 'Sign in'}</span>
            {busy ? <i className="button-loader" aria-hidden="true" /> : <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </animated.button>
        </form>
      </div>
    </section>
    <aside className="lg-art" aria-label="Illustration of a home service workspace">
      <div className="lg-art-glow glow-one" />
      <div className="lg-art-glow glow-two" />
      <svg className="lg-illustration" viewBox="0 0 620 520" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="home-fill" x1="188" y1="138" x2="422" y2="390" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fbfcf6" /><stop offset="1" stopColor="#dce5d0" />
          </linearGradient>
          <linearGradient id="tool-fill" x1="370" y1="245" x2="451" y2="365" gradientUnits="userSpaceOnUse">
            <stop stopColor="#cbd99b" /><stop offset="1" stopColor="#9daf6c" />
          </linearGradient>
        </defs>
        <ellipse className="art-ground" cx="310" cy="423" rx="204" ry="22" fill="#879670" fillOpacity=".14" />
        <circle className="art-orbit" cx="310" cy="260" r="190" stroke="#9aa983" strokeOpacity=".32" strokeDasharray="2 9">
          <animateTransform attributeName="transform" type="rotate" from="0 310 260" to="360 310 260" dur="44s" repeatCount="indefinite" />
        </circle>
        <g className="art-home">
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 -4; 0 0" dur="5s" repeatCount="indefinite" />
          <path d="M183 247 310 146l127 101v142H183V247Z" fill="url(#home-fill)" stroke="#69775d" strokeWidth="3" strokeLinejoin="round" />
          <path d="m160 251 150-119 150 119" stroke="#465140" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M274 389v-91a36 36 0 0 1 72 0v91" stroke="#69775d" strokeWidth="3" />
          <rect x="207" y="263" width="42" height="42" rx="9" fill="#e2e9d8" stroke="#899778" strokeWidth="2" />
          <path d="M228 264v40M208 284h40" stroke="#899778" strokeWidth="2" />
          <rect x="371" y="263" width="42" height="42" rx="9" fill="#e2e9d8" stroke="#899778" strokeWidth="2" />
          <path d="M392 264v40M372 284h40" stroke="#899778" strokeWidth="2" />
        </g>
        <g className="art-tool">
          <animateTransform attributeName="transform" type="rotate" values="-3 420 228; 5 420 228; -3 420 228" dur="4s" repeatCount="indefinite" />
          <path d="m405 194 19-19a30 30 0 0 1 34 34l-22 22-18-18-68 68-18-18 68-69-17-18Z" fill="url(#tool-fill)" stroke="#58644b" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="435" cy="205" r="7" fill="#f5f6ef" stroke="#58644b" strokeWidth="3" />
        </g>
        <g className="art-repair-signal" aria-hidden="true">
          <circle cx="309" cy="230" r="12" fill="#d5e2a1" fillOpacity=".72">
            <animate attributeName="r" values="12;12;18;18;12;12" keyTimes="0;.24;.31;.69;.76;1" dur="12s" repeatCount="indefinite" />
          </circle>
          <path d="m301 230 5 5 11-12" stroke="#58644b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.24;.31;.69;.76;1" dur="12s" repeatCount="indefinite" />
        </g>
        <g className="art-worker" aria-hidden="true">
          <animateTransform attributeName="transform" type="translate" values="0 0;180 0;180 0;180 0;180 0;0 0" keyTimes="0;.24;.31;.69;.76;1" keySplines=".42 0 .58 1;0 0 1 1;0 0 1 1;0 0 1 1;.42 0 .58 1" calcMode="spline" dur="12s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;1;0;0;1;1" keyTimes="0;.24;.31;.69;.76;1" dur="12s" repeatCount="indefinite" />
          <ellipse cx="120" cy="390" rx="21" ry="4" fill="#58644b" fillOpacity=".14" />
          <g className="worker-leg-back">
            <path d="m111 351-7 22 4 13" stroke="#465140" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <animateTransform attributeName="transform" type="rotate" values="-13 111 351;13 111 351;-13 111 351" dur=".72s" repeatCount="indefinite" />
          </g>
          <g className="worker-leg-front">
            <path d="m127 351 7 22-4 13" stroke="#465140" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <animateTransform attributeName="transform" type="rotate" values="13 127 351;-13 127 351;13 127 351" dur=".72s" repeatCount="indefinite" />
          </g>
          <path d="M107 319q13-9 27 0l4 31q-18 12-36 0l5-31Z" fill="#84966b" stroke="#58644b" strokeWidth="2" strokeLinejoin="round" />
          <path d="m108 325-9 16m34-16 9 15" stroke="#e8eddf" strokeWidth="6" strokeLinecap="round" />
          <circle cx="120" cy="303" r="12" fill="#d9ad87" />
          <path d="M108 302q1-14 13-14 10 1 12 12l-5-3-5-5q-5 7-15 10Z" fill="#465140" />
          <path d="M124 303h1" stroke="#394334" strokeWidth="2" strokeLinecap="round" />
          <rect x="139" y="337" width="19" height="15" rx="3" fill="#c5d38f" stroke="#58644b" strokeWidth="2" />
          <path d="M143 337v-4a5 5 0 0 1 10 0v4" stroke="#58644b" strokeWidth="2" strokeLinecap="round" />
          <path d="m143 344 3 3 6-7" stroke="#58644b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g className="art-spark spark-a"><path d="M149 190v22m-11-11h22" stroke="#a3b475" strokeWidth="3" strokeLinecap="round" /></g>
        <g className="art-spark spark-b"><path d="M473 319v18m-9-9h18" stroke="#a3b475" strokeWidth="3" strokeLinecap="round" /></g>
        <circle className="art-dot dot-a" cx="475" cy="147" r="7" fill="#d5e2a1" />
        <circle className="art-dot dot-b" cx="144" cy="340" r="5" fill="#b9c796" />
      </svg>
      <FloatingNote />
      <div className="lg-art-copy"><span>HOME SERVICE OPERATIONS</span><h2>A clearer view<br />of every detail.</h2><p>Bookings, teams, and orders in one calm workspace.</p></div>
    </aside>
  </main>;
}

function PostLoginLoader() {
  return <main className="post-login-loader" role="status" aria-label="Preparing your admin workspace">
    <section className="post-login-card">
      <span className="post-login-brand">fixzy<i /></span>
      <h1>Preparing your workspace</h1>
      <p>Your dashboard will be ready in a moment.</p>
      <div className="post-login-progress"><i /></div>
      <div className="post-login-preview" aria-hidden="true">
        <span /><span /><span />
        <div><i /><i /><i /><i /></div>
      </div>
    </section>
  </main>;
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking session
  const [afterLogin, setAfterLogin] = useState(false);
  const route = useHash();
  const navRef = useRef(null);
  const indicatorRef = useRef(null);
  useLiquidIndicator(navRef, indicatorRef, route, user !== undefined && !!user); // called unconditionally — see Rules of Hooks

  useEffect(() => { refresh().then((u) => setUser(u.role === 'ADMIN' ? u : null), () => setUser(null)); }, []);
  useEffect(() => {
    if (!afterLogin) return undefined;
    const timer = setTimeout(() => setAfterLogin(false), 3000);
    return () => clearTimeout(timer);
  }, [afterLogin]);

  /* Page transitions: the old page fades out slowly, then the new one is mounted and eases in.
     `shown` lags `route` by the fade-out time; the nav indicator still follows `route` at once. */
  const [shown, setShown] = useState(route);
  const [leaving, setLeaving] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  useEffect(() => {
    if (route === shown) return;
    setLeaving(true);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let swapTimer;
    const fadeTimer = setTimeout(() => {
      setRouteLoading(true);
      swapTimer = setTimeout(() => {
        setShown(route);
        setLeaving(false);
        setRouteLoading(false);
        window.scrollTo({ top: 0 });
    }, reduced ? 120 : 300);
    }, reduced ? 0 : 580);
    return () => { clearTimeout(fadeTimer); clearTimeout(swapTimer); };
  }, [route, shown]);

  if (user === undefined) return <AppLoader />;
  if (!user) return <><Login onDone={(nextUser) => { setUser(nextUser); setAfterLogin(true); }} /><Toaster /></>;
  if (afterLogin) return <PostLoginLoader />;

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
      <span className="side-indicator" ref={indicatorRef} aria-hidden="true" />
      {ROUTES.map(([id, name, , icon, hue]) => <a key={id} href={`#/${id}`} data-hue={hue} className={route === id ? 'on' : ''} aria-current={route === id ? 'page' : undefined}
        style={{ '--on-ink': BRIGHT[hue][1] }}>
        <LordIcon icon={icon} size={22} colors={route === id ? `primary:${BRIGHT[hue][1]},secondary:${BRIGHT[hue][1]}` : 'primary:#e9ecf5,secondary:#e9ecf5'} trigger={route === id ? 'loop' : 'hover'} />
        <span className="tip">{name}</span>
      </a>)}
    </nav>

    <main className={`main${leaving ? ' leaving' : ''}`}><div className="page-view" key={shown}><Page me={user} /></div></main>
    {routeLoading && <div className="route-loader" role="status" aria-live="polite" aria-label="Loading page">
      <div className="transition-skeleton" aria-hidden="true">
        <div className="transition-skeleton-head"><i /><i /></div>
        <div className="transition-skeleton-metrics"><i /><i /><i /></div>
        <div className="transition-skeleton-panel">
          <div className="transition-skeleton-toolbar"><i /><i /><i /></div>
          {[0, 1, 2, 3, 4].map((row) => <div className="transition-skeleton-row" key={row}><i /><i /><i /><i /></div>)}
        </div>
      </div>
    </div>}
    <Toaster />
  </div>;
}
