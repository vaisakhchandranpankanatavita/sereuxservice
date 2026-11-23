import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { animated, useSpring } from '@react-spring/web';
import { login, logout, refresh } from './api.js';
import { AppLoader, Toaster } from './ui.jsx';
import { LordIcon } from './LordIcon.jsx';
import { ICONS } from './icons.js';
import { Admins, AuditLog, Banners, Bookings, Coupons, Dashboard, Inbox, Notifications, Orders, Payouts, Products, Providers, Services, Users, Verification } from './pages.jsx';
import { Settings } from './settings.jsx';

/* Vivid active-state colour per section (bg) and the icon colour that reads best on it. */
const BRIGHT = {
  c1: ['#d5e2a1', '#263023'], c2: ['#d5e2a1', '#263023'], c3: ['#d5e2a1', '#263023'], c4: ['#d5e2a1', '#263023'],
  c5: ['#d5e2a1', '#263023'], c6: ['#d5e2a1', '#263023'], c7: ['#d5e2a1', '#263023'], c8: ['#d5e2a1', '#263023'],
  c9: ['#d5e2a1', '#263023'], c10: ['#d5e2a1', '#263023'], c11: ['#d5e2a1', '#263023'], c12: ['#d5e2a1', '#263023'],
  c13: ['#d5e2a1', '#263023'],
};

/* [id, name, Page, icon, hue, group]. `group` is only used when a route overflows into the
   "More" submenu, to pick its category heading there. Ordered by priority: how many sit
   directly on the bar depends on the viewport (see useBarSlots below). */
const ROUTES = [
  ['dashboard', 'Dashboard', Dashboard, ICONS.dashboard, 'c1', 'main'],
  ['bookings', 'Bookings', Bookings, ICONS.bookings, 'c2', 'main'],
  ['orders', 'Orders', Orders, ICONS.orders, 'c3', 'main'],
  ['users', 'Users', Users, ICONS.users, 'c4', 'main'],
  ['inbox', 'Inbox', Inbox, ICONS.inbox, 'c9', 'main'],
  ['services', 'Services', Services, ICONS.services, 'c5', 'catalog'],
  ['pros', 'Pros', Providers, ICONS.pros, 'c6', 'catalog'],
  ['verification', 'Verification', Verification, ICONS.pros, 'c6', 'catalog'],
  ['products', 'Products', Products, ICONS.products, 'c7', 'catalog'],
  ['payouts', 'Payouts', Payouts, ICONS.payouts, 'c10', 'catalog'],
  ['coupons', 'Coupons', Coupons, ICONS.coupons, 'c8', 'marketing'],
  ['banners', 'Banners', Banners, ICONS.banners, 'c11', 'marketing'],
  ['notifications', 'Notifications', Notifications, ICONS.bell, 'c12', 'admin'],
  ['admins', 'Admins', Admins, ICONS.avatar, 'c13', 'admin'],
  ['settings', 'Settings', Settings, ICONS.services, 'c13', 'admin'],
  ['audit-log', 'Audit log', AuditLog, ICONS.auditLog, 'c10', 'admin'],
];
const GROUP_LABELS = { main: 'Main', catalog: 'Catalog', marketing: 'Marketing', admin: 'Admin' };

/* How many bar slots (primary routes + the More trigger, if any) fit at a given width — wider
   screens show more of the bar directly, narrower ones push more into the categorised submenu. */
const BAR_TIERS = [[1200, 13], [1000, 10], [820, 8], [680, 7], [560, 6], [440, 5], [0, 4]];
const slotsFor = (w) => (BAR_TIERS.find(([min]) => w >= min) ?? BAR_TIERS[BAR_TIERS.length - 1])[1];
function useBarSlots() {
  const [slots, setSlots] = useState(() => slotsFor(window.innerWidth));
  useEffect(() => {
    let raf = 0;
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setSlots(slotsFor(window.innerWidth))); };
    addEventListener('resize', onResize);
    return () => { removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
  }, []);
  return Math.min(slots, ROUTES.length);
}

/* The categorised submenu for every route that doesn't fit on the bar itself. Closes on an
   outside click, Escape, or picking an item (the hash change then drives the real navigation). */
function MoreMenu({ open, onClose, route, groups }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('pointerdown', onDoc);
    addEventListener('keydown', onKey);
    return () => { removeEventListener('pointerdown', onDoc); removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="side-more" role="menu" aria-label="More sections" ref={ref}>
    {groups.map(([key, label, items]) => <div className="side-more-group" key={key}>
      <span className="side-more-label">{label}</span>
      {items.map(([id, name, , icon, hue]) => <a key={id} href={`#/${id}`} role="menuitem" onClick={onClose}
        className={`side-more-item${route === id ? ' on' : ''}`} style={{ '--c': BRIGHT[hue][0] }}>
        <LordIcon icon={icon} size={18} colors={route === id ? `primary:${BRIGHT[hue][1]},secondary:${BRIGHT[hue][1]}` : 'primary:#6a665f,secondary:#6a665f'} trigger="hover" />
        <span>{name}</span>
      </a>)}
    </div>)}
  </div>;
}

const useHash = () => {
  const get = () => location.hash.slice(2) || 'dashboard';
  const [h, setH] = useState(get);
  useEffect(() => { const f = () => setH(get()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
};

const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

/* One indicator travels between fixed nav cells. WAAPI keeps movement smooth on the
   compositor while a brief stretch-and-settle gives it a water-drop feel. */
function useLiquidIndicator(navRef, indicatorRef, route, ready, layoutKey) {
  const prev = useRef(null);

  useLayoutEffect(() => {
    const parent = navRef.current;
    const indicator = indicatorRef.current;
    const el = parent?.querySelector('.on');
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
  }, [navRef, indicatorRef, route, ready, layoutKey]);

  /* Window resizes re-flow the cells; keep the pill glued to the active one without animating. */
  useLayoutEffect(() => {
    const parent = navRef.current;
    if (!parent || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const indicator = indicatorRef.current;
      const el = parent.querySelector('.on');
      if (!indicator || !el) return;
      indicator.getAnimations().forEach((animation) => animation.cancel());
      indicator.style.width = `${el.offsetWidth}px`;
      indicator.style.transform = `translate3d(${el.offsetLeft}px, 0, 0)`;
      if (prev.current) prev.current.left = el.offsetLeft;
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, [navRef, indicatorRef, ready]);
}

/* ---- Night-repair scene ------------------------------------------------------
   One 24s clock drives everything: SMIL (car, door, lights) and a small skeletal rig for the
   professional (hips, knees, ankles, shoulders, elbows), read from svg.getCurrentTime() so
   they never drift apart. Feet are tied to distance walked, so they stay planted. */
const SHIFT = 1.3, LOOP = 24 + SHIFT, SC = 0.64, GY = 385, X0 = 160, DIST = 307, DOOR_IN = 16, CYCLE = DIST / 6;
const THIGH_K = [-25, -18, 0, 18, 25, 5, -15, -25];
const SHIN_K = [5, 15, 8, 10, 40, 65, 40, 12];
const FOOT_K = [8, 3, -8, -28, -35, -60, -30, 3];
const HIP = [0, -50], SHO = [0.5, -78];
const RAD = Math.PI / 180;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const sm = (a, b, t) => { const u = clamp01((t - a) / (b - a)); return u * u * (3 - 2 * u); };
const lerp = (a, b, k) => a + (b - a) * k;
const rotP = (p, deg, c) => { const x = p[0] - c[0], y = p[1] - c[1], s = Math.sin(deg * RAD), co = Math.cos(deg * RAD); return [c[0] + x * co - y * s, c[1] + x * s + y * co]; };
const limbAng = (vx, vy) => Math.atan2(-vx, vy) / RAD;
const crom = (keys, u) => {
  const n = keys.length, v = (((u % 1) + 1) % 1) * n, i = Math.floor(v), f = v - i;
  const p0 = keys[(i + n - 1) % n], p1 = keys[i % n], p2 = keys[(i + 1) % n], p3 = keys[(i + 2) % n];
  return 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f * f * f);
};
const trap = (t, t0, tm, ta, d) => {
  const s = t - t0, v = d / (tm - ta);
  if (s <= 0) return 0;
  if (s >= tm) return d;
  if (s < ta) return 0.5 * (v / ta) * s * s;
  if (s < tm - ta) return 0.5 * v * ta + v * (s - ta);
  return d - 0.5 * (v / ta) * (tm - s) * (tm - s);
};
const xAt = (t) => {
  if (t < 8) return trap(t, 2.3, 4.7, 0.6, DIST);
  if (t < 14.5) return DIST + DOOR_IN * sm(8, 8.9, t);
  return DIST + DOOR_IN - trap(t, 14.8, 5, 0.6, DIST + DOOR_IN);
};

function ik2(S, G, l1, l2) {
  const dx = G[0] - S[0], dy = G[1] - S[1], d = Math.hypot(dx, dy) || 1e-3;
  const dc = Math.min((l1 + l2) * 0.999, Math.max(Math.abs(l1 - l2) + 0.01, d));
  const ux = dx / d, uy = dy / d;
  const a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const T = [S[0] + ux * dc, S[1] + uy * dc];
  const c1 = [S[0] + ux * a - uy * h, S[1] + uy * a + ux * h], c2 = [S[0] + ux * a + uy * h, S[1] + uy * a - ux * h];
  const E = c1[1] > c2[1] ? c1 : c2;
  const a1 = limbAng(E[0] - S[0], E[1] - S[1]);
  return [a1, limbAng(T[0] - E[0], T[1] - E[1]) - a1];
}

function courierPose(real) {
  const t = real <= 2 ? real : Math.max(2, real - SHIFT);
  const x = xAt(t);
  const a = clamp01((Math.abs(xAt(t + 0.03) - xAt(t - 0.03)) / 0.06) / 22);
  const ph = (t < 14.5 ? x : 2 * (DIST + DOOR_IN) - x) / CYCLE;
  const f = t < 14.3 ? 1 : -1;
  const op = t < 12 ? sm(2.2, 2.7, t) * (1 - sm(8.5, 8.9, t)) : sm(14.4, 14.8, t) * (1 - sm(19.9, 20.4, t));
  const depth = 1 - 0.1 * (t < 12 ? (1 - sm(2.2, 2.9, t)) + sm(8.2, 8.9, t) : (1 - sm(14.4, 14.9, t)) + sm(19.9, 20.4, t));
  const ww = sm(7, 7.3, t) * (1 - sm(7.6, 7.9, t));
  const s4 = Math.sin(4 * Math.PI * ph), c4 = Math.cos(4 * Math.PI * ph), c2 = Math.cos(2 * Math.PI * ph);
  const dy = a * (1.7 + 1.7 * c4);
  const lean = 2 + a * 1.2 * s4 - 3 * ww;
  const sh = (() => { const q = rotP(SHO, lean, HIP); return [q[0], q[1] + dy]; })();
  const legs = [0, 1].map((i) => {
    const phi = ph + i * 0.5;
    return [lerp(i ? 1.5 : -1.5, crom(THIGH_K, phi), a), lerp(2, crom(SHIN_K, phi), a), lerp(0, crom(FOOT_K, phi), a)];
  });
  const swing = (sign) => [1.5 + sign * 11 * c2 * a, -46 - 2.5 * a * Math.abs(Math.sin(2 * Math.PI * ph))];
  const toU = (p) => rotP([p[0], p[1] - dy], -lean, HIP);
  const near = swing(-1), far = swing(1);
  const nTarget = toU([lerp(near[0], 9, ww), lerp(near[1], -104, ww)]);
  const tb = t % 3.3, blink = tb < 0.13 ? Math.sin((tb / 0.13) * Math.PI) : 0;
  return {
    x, f, op, depth, dy, lean, legs, shoulder: sh, blink,
    arms: [0, 1].map((i) => {
      const back = (i ? -1 : 1) * c2 * a;
      const fk = [(i ? 1 : 2) + 28 * back, -(6 + 26 * a * clamp01(-back))];
      if (i || ww < 0.001) return fk;
      const w = ik2(SHO, nTarget, 17, 19);
      return [lerp(fk[0], w[0], ww), lerp(fk[1], w[1], ww)];
    }),
    head: -0.62 * lean - 16 * ww + (1 - a) * 1.2 * Math.sin(t * 1.3),
  };
}

const legEl = (bind, side, far) => {
  const trs = far ? '#2f3a2d' : 'url(#cg-trs)';
  return <g ref={bind(`${side}Leg`)}>
    <path d="M-4.7 -1.2Q0 -3.6 4.7 -1.2Q4.5 10 3.5 24L-3.4 24Q-4.5 10 -4.7 -1.2Z" fill={trs} />
    <g ref={bind(`${side}Shin`)}>
      <path d="M-3.6 -0.6L3.6 -0.6Q3.2 11 2.4 22L-2.4 22Q-3.3 11 -3.6 -0.6Z" fill={trs} />
      <path d="M-3.4 18.4Q0 19.4 3.4 18.4" stroke="#1f261d" strokeOpacity=".35" strokeWidth=".7" fill="none" />
      <g ref={bind(`${side}Foot`)}>
        <path d="M-3.1 -1.6L2.9 -1.6L3.3 .8Q9.3 1.4 10.7 3.1L10.7 4L-4.5 4Q-5.1 1.5 -3.1 -1.6Z" fill={far ? '#20251e' : '#2a3027'} />
        <rect x="-4.5" y="3" width="15.2" height="1.1" rx=".5" fill="#e8eadf" />
        <path d="M.4 -.4L2.8 .2M.2 1L2.9 1.7" stroke="#8d9684" strokeWidth=".5" strokeLinecap="round" />
      </g>
    </g>
  </g>;
};

const armEl = (bind, side, far) => {
  const skin = far ? '#c28f6b' : 'url(#cg-skin)', sleeve = far ? '#6b8057' : '#8aa070';
  return <g ref={bind(`${side}Arm`)}>
    <path d="M-2.7 -.5Q-3.2 8 -2.5 17L2.5 17Q3.2 8 2.7 -.5Z" fill={skin} />
    <path d="M-3.6 -1.4Q-4 5 -3.5 10.6L3.5 10.6Q4 5 3.6 -1.4Q0 -2.8 -3.6 -1.4Z" fill={sleeve} stroke="#566a46" strokeWidth=".5" />
    <path d="M-3.5 10.1Q0 11.3 3.5 10.1" stroke="#5f7350" strokeWidth=".7" fill="none" />
    <circle cx="0" cy="17" r="2.5" fill={skin} />
    <g ref={bind(`${side}Fore`)}>
      <path d="M-2.4 0L2.4 0Q2.3 9 1.7 16L-1.7 16Q-2.3 9 -2.4 0Z" fill={skin} />
      {!far && <><rect x="-2.5" y="11.4" width="5" height="1.7" rx=".5" fill="#2d3329" /><rect x="-1.1" y="11.3" width="2.2" height="1.9" rx=".4" fill="#d5e2a1" /></>}
      <ellipse cx="0" cy="18.2" rx="2.3" ry="3" fill={skin} />
      <path d="M1.4 16.6Q4.2 17.8 3.5 20.2" stroke={skin} strokeWidth="1.7" strokeLinecap="round" fill="none" />
    </g>
  </g>;
};

function Courier() {
  const R = useRef({});
  const bind = (key) => (el) => { R.current[key] = el; };
  useEffect(() => {
    const el = R.current;
    const set = (key, v) => el[key]?.setAttribute('transform', v);
    const draw = (t) => {
      const p = courierPose(t);
      set('root', `translate(${X0 + p.x} ${GY}) scale(${p.f * SC * p.depth} ${SC * p.depth})`);
      el.root.setAttribute('opacity', p.op.toFixed(3));
      const body = `translate(0 ${p.dy})`;
      set('upper', `${body} rotate(${p.lean} 0 -50)`);
      set('head', `rotate(${p.head} 0.5 -81)`);
      ['near', 'far'].forEach((side, i) => {
        const [th, sh, ft] = p.legs[i];
        set(`${side}Leg`, `${body} translate(${i ? -1 : 1} -50) rotate(${th})`);
        set(`${side}Shin`, `translate(0 24) rotate(${sh})`);
        set(`${side}Foot`, `translate(0 22) rotate(${ft})`);
        const [a1, a2] = p.arms[i];
        set(`${side}Arm`, `translate(${p.shoulder[0]} ${p.shoulder[1]}) rotate(${a1})`);
        set(`${side}Fore`, `translate(0 17) rotate(${a2})`);
      });
      el.lid?.setAttribute('ry', (0.05 + p.blink * 1.7).toFixed(2));
    };
    const svg = el.root?.ownerSVGElement;
    const start = performance.now();
    let raf = 0;
    const loop = (now) => {
      const clock = svg?.getCurrentTime ? svg.getCurrentTime() : (now - start) / 1000;
      draw(Math.min(clock, LOOP));
      if (clock < LOOP) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <g ref={bind('root')} className="art-worker" aria-hidden="true" opacity="0">
    <defs>
      <radialGradient id="cg-skin" cx=".35" cy=".3" r=".85"><stop stopColor="#f3cfaa" /><stop offset="1" stopColor="#d9a47c" /></radialGradient>
      <linearGradient id="cg-polo" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#9db383" /><stop offset="1" stopColor="#789060" /></linearGradient>
      <linearGradient id="cg-trs" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#4a5846" /><stop offset="1" stopColor="#36432f" /></linearGradient>
    </defs>
    <ellipse cx="0" cy="0" rx="17" ry="3.4" fill="#3f4a37" fillOpacity=".3" />
    {legEl(bind, 'far', true)}
    {armEl(bind, 'far', true)}
    <g ref={bind('upper')}>
      <path d="M-2.9 -86.5L3.2 -86.5L3.6 -79L-3.8 -79Z" fill="#cf9e78" />
      <path d="M-5.3 -50C-7.5 -60 -7.1 -70 -5.7 -78C-4.7 -80.7 -2.4 -81.8 0 -81.8C2.8 -81.8 5.1 -80.7 6.1 -78.3C7.5 -72 7.5 -62 5.9 -50Z" fill="url(#cg-polo)" stroke="#667a52" strokeWidth=".7" />
      <path d="M-5.5 -78C-6.9 -70 -6.7 -60 -5.1 -50" stroke="#5f7350" strokeOpacity=".4" strokeWidth="1.3" fill="none" />
      <path d="M-5.5 -52.4Q0 -51 6 -52.4" stroke="#5f7350" strokeOpacity=".55" strokeWidth=".8" fill="none" />
      <path d="M-3.4 -81.6L0 -78.4L3.6 -81.4L4.8 -79.8L0 -75.6L-4.4 -79.8Z" fill="#eef1e2" stroke="#b9c1a4" strokeWidth=".5" strokeLinejoin="round" />
      <path d="M0 -76.5V-68.5" stroke="#667a52" strokeWidth=".8" />
      <circle cx="0" cy="-74.4" r=".55" fill="#eef1e2" /><circle cx="0" cy="-70.8" r=".55" fill="#eef1e2" />
      <circle cx="3.6" cy="-71.5" r="1.9" fill="#d5e2a1" stroke="#667a52" strokeWidth=".5" />
      <rect x="-5.7" y="-51.4" width="11.7" height="2.8" rx=".8" fill="#23281f" />
      <rect x="3" y="-51" width="2.6" height="2" rx=".4" fill="#c9b77a" />
      <g ref={bind('head')}>
        <path d="M-5.4 -93C-5.6 -99.6 -1.6 -100.3 1.5 -100.1C5.7 -99.9 7.1 -96.3 6.9 -93.9C6.8 -92.3 7.4 -91.7 7.2 -90.9C6.9 -89.7 6.3 -89.5 6.3 -88.8C6.3 -87.3 4.7 -85.8 2.3 -85.6C-1.9 -85.4 -5.2 -87.9 -5.4 -93Z" fill="url(#cg-skin)" />
        <path d="M-5.2 -92.5C-3 -88 0 -86.5 2.4 -86.2" stroke="#c18f69" strokeOpacity=".5" strokeWidth=".8" fill="none" />
        <path d="M-5.9 -97C-6.6 -93 -6 -90.4 -4.7 -89.2L-3.7 -92Z" fill="#2d2a26" />
        <ellipse cx="-.9" cy="-93" rx="1.5" ry="2.2" fill="#d9a77f" stroke="#b98963" strokeWidth=".4" />
        <path d="M-5.9 -97.6C-6.1 -104.7 0 -106.2 3.3 -105.6C6.3 -105 7.2 -101.6 7.2 -98.2L-5.9 -97.6Z" fill="#6f8458" />
        <path d="M-5.9 -97.8L7.2 -98.4" stroke="#55683f" strokeWidth="1.1" />
        <path d="M5.7 -98.7C9.2 -98.9 12.8 -98.1 14.4 -96.4C12.2 -96.2 8.6 -96.8 5.5 -97Z" fill="#55683f" />
        <circle cx=".7" cy="-105.8" r=".9" fill="#55683f" />
        <path d="M-3.9 -102.5C-2 -104.6 1.4 -105.2 3.4 -104.7" stroke="#8fa476" strokeOpacity=".7" strokeWidth=".8" strokeLinecap="round" fill="none" />
        <ellipse cx="3.8" cy="-93.8" rx="1.6" ry="1.25" fill="#fbfbf6" />
        <circle cx="4.3" cy="-93.8" r=".95" fill="#2d2a26" />
        <circle cx="4.6" cy="-94.1" r=".28" fill="#fff" />
        <ellipse ref={bind('lid')} cx="3.8" cy="-93.8" rx="1.9" ry=".05" fill="#e7bb94" />
        <path d="M2.1 -96.3Q4 -97.2 5.9 -96.3" stroke="#2d2a26" strokeWidth=".75" strokeLinecap="round" fill="none" />
        <ellipse cx="2.3" cy="-90.8" rx="1.8" ry="1.1" fill="#e59a85" fillOpacity=".32" />
        <path d="M3.4 -88.5Q4.7 -88 5.7 -88.7" stroke="#9a5f4a" strokeWidth=".6" strokeLinecap="round" fill="none" />
      </g>
    </g>
    {legEl(bind, 'near', false)}
    {armEl(bind, 'near', false)}
  </g>;
};

/* SMIL helper: [[seconds, value], ...] over the 24s loop -> values / keyTimes. */
const track = (pts) => ({ values: pts.map((p) => p[1]).join(';'), keyTimes: pts.map((p) => ((p[0] >= 24 ? LOOP : p[0] <= 2 ? p[0] : p[0] + SHIFT) / LOOP).toFixed(4)).join(';'), dur: `${LOOP}s`, repeatCount: 1, fill: 'freeze' });
const LIT = [[0, 0], [13.3, 0], [14.2, 1], [24, 1]];
const scaled = (pts, k) => pts.map(([t, v]) => [t, +(v * k).toFixed(3)]);
const BULB = [[0, 0], [5.1, 0], [5.2, 0.5], [5.32, 0], [6, 0], [6.1, 0.35], [6.22, 0], [11, 0], [11.1, 0.6], [11.22, 0], [11.32, 0.4], [11.45, 0], [12.2, 0], [12.3, 0.7], [12.42, 0], [13.3, 0], [13.4, 1], [14.2, 1], [24, 1]];
/* While he works inside, he is seen as a silhouette in the windows: left one first, then the right,
   an arm reaching up to twist the bulb in a warm, flickering glow. */
const WORK_L = [[0, 0], [9.8, 0], [10.1, 0.9], [10.5, 0.7], [10.9, 0.95], [11.3, 0.75], [11.5, 0.9], [11.7, 0], [24, 0]];
const WORK_R = [[0, 0], [11.7, 0], [12, 0.9], [12.4, 0.7], [12.8, 0.95], [13.1, 0.8], [13.3, 0.9], [13.4, 0], [24, 0]];
const workFigure = <g>
  <path d="M430 310L431 298Q437 293.5 443 298L444 310Z" fill="#161b14" />
  <circle cx="437" cy="289.5" r="4.4" fill="#161b14" />
  <path d="M432.4 287.6Q437 282.6 441.6 287.6Z" fill="#0b0f0a" />
  <g>
    <animateTransform attributeName="transform" type="rotate" values="-16 442 298;10 442 298;-16 442 298" dur="1.1s" repeatCount="indefinite" />
    <path d="M442 298L447 291L449 282" stroke="#161b14" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="449" cy="281" r="2" fill="#161b14" />
  </g>
</g>;
const workWindow = (pts, flip) => <g opacity="0">
  <animate attributeName="opacity" {...track(pts)} />
  <g clipPath="url(#work-clip)" transform={flip ? 'translate(942 0) scale(-1 1)' : undefined}>
    <rect x="420" y="275" width="34" height="34" fill="#ffd98a" />
    <circle cx="446" cy="278" r="12" fill="#fff2c4" opacity=".6" />
    <path d="M437 276v32M421 292h32" stroke="#a98f55" strokeWidth="1.6" opacity=".7" />
    {workFigure}
  </g>
</g>;
const DOOR_W = [[0, 34], [7.6, 34], [8, 9], [9.1, 9], [9.5, 34], [14.2, 34], [14.6, 9], [15.4, 9], [15.8, 34], [24, 34]];
const CAR_X = '-480 18;0 18;0 18;-480 18', CAR_T = [0, 1.8 / LOOP, (20.6 + SHIFT) / LOOP, 1].map((v) => +v.toFixed(4)).join(';');
const carMove = <animateTransform attributeName="transform" type="translate" values={CAR_X} keyTimes={CAR_T} keySplines=".42 0 .58 1;0 0 1 1;.42 0 .58 1" calcMode="spline" dur={`${LOOP}s`} repeatCount="1" fill="freeze" />;
const wheelSpin = (cx) => <animateTransform attributeName="transform" type="rotate" values={`0 ${cx} 345;800 ${cx} 345;800 ${cx} 345;1600 ${cx} 345`} keyTimes={CAR_T} dur={`${LOOP}s`} repeatCount="1" fill="freeze" />;
/* Once the bulb is fixed the whole panel brightens and the details hidden in the dark appear.
   DAY_PTS drives the SMIL veil/details and (through --day) the panel's CSS, on the same clock. */
const DAY_PTS = [[0, 0], [13.4, 0], [15.2, 1], [24, 1]];
const DAY_AT = DAY_PTS.map(([t, v]) => [t >= 24 ? LOOP : t <= 2 ? t : t + SHIFT, v]);
const dayAt = (t) => {
  for (let i = 1; i < DAY_AT.length; i += 1) {
    if (t <= DAY_AT[i][0]) { const [t0, v0] = DAY_AT[i - 1], [t1, v1] = DAY_AT[i]; return t1 === t0 ? v1 : v0 + (v1 - v0) * ((t - t0) / (t1 - t0)); }
  }
  return 0;
};
const VEIL = DAY_PTS.map(([t, v]) => [t, +(0.64 * (1 - v)).toFixed(3)]);
const NIGHT_ONLY = DAY_PTS.map(([t, v]) => [t, 1 - v]);
const DAY_ONLY = [[0, 0], [14.4, 0], [16, 1], [24, 1]];
const dayDetails = <g opacity="0">
  <animate attributeName="opacity" {...track(DAY_ONLY)} />
  <path d="M447 226h36a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-36a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4Z" fill="#fbfcf6" stroke="#69775d" strokeWidth="1.4" />
  <text x="465" y="237.4" textAnchor="middle" fontSize="7.6" fontWeight="800" fill="#465140" letterSpacing=".7">HOME  42</text>
  <rect x="452" y="382" width="30" height="3.4" rx="1.4" fill="#8a7650" />
  {[[440, 0], [502, 1]].map(([px, k]) => <g key={px}>
    <path d={`M${px - 6} 366h12l-2 14h-8Z`} fill="#b8734f" stroke="#7d4a33" strokeWidth="1" />
    <circle cx={px - 4} cy="360" r="5" fill="#6f9a56" /><circle cx={px + 3} cy="358" r="5.6" fill="#82ad63" /><circle cx={px} cy="353" r="4" fill={k ? '#f0a2b0' : '#f2cf6a'} />
  </g>)}
  <rect x="388" y="344" width="5" height="38" fill="#7b5a3c" />
  <circle cx="390" cy="336" r="17" fill="#6f9a56" /><circle cx="380" cy="346" r="12" fill="#82ad63" /><circle cx="401" cy="347" r="11" fill="#5f8c4a" />
  <path d="M356 382v-26h14v8h-14" fill="none" stroke="#7b5a3c" strokeWidth="2" strokeLinejoin="round" />
  <rect x="352" y="346" width="22" height="12" rx="3" fill="#8fa1c4" stroke="#5a6a8c" strokeWidth="1.2" />
</g>;
/* House styled like the post-login loader: line art that draws itself, windows then the door light up one by one. */
const LIT_W1 = [[0, 0], [13.3, 0], [13.8, 1], [24, 1]];
const LIT_W2 = [[0, 0], [13.7, 0], [14.2, 1], [24, 1]];
const LIT_DOOR = [[0, 0], [14.1, 0], [14.7, 1], [24, 1]];
const drawOn = (delay, dur = 0.9) => <animate attributeName="stroke-dashoffset" from="1" to="0" begin={`${delay}s`} dur={`${dur}s`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".3 .7 .2 1" />;
const outlineTone = <animate attributeName="stroke" values="#8fa07c;#8fa07c;#5f6f4d;#5f6f4d" keyTimes={track(DAY_PTS).keyTimes} dur={`${LOOP}s`} repeatCount="1" fill="freeze" />;
const litFill = (pts, from, to, attr = 'fill') => <animate attributeName={attr} values={`${from};${from};${to};${to}`} keyTimes={track(pts).keyTimes} dur={`${LOOP}s`} repeatCount="1" fill="freeze" />;
const STARS = [[40, 60, 1.1], [150, 30, 1.4], [250, 78, 1], [330, 24, 1.3], [430, 52, 1.1], [540, 30, 1.5], [596, 96, 1], [70, 150, 1.2], [210, 132, 0.9], [590, 190, 1.2]];


function Login({ onDone }) {
  const [email, setEmail] = useState(import.meta.env.DEV ? 'admin@fixzy.app' : '') /* dev-only prefill; production builds start blank */;
  const [password, setPassword] = useState(import.meta.env.DEV ? 'testpass123' : '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [buttonHover, setButtonHover] = useState(false);
  const [buttonPress, setButtonPress] = useState(false);
  const loginRef = useRef(null);
  const artRef = useRef(null);
  useEffect(() => {
    const art = artRef.current, svg = art?.querySelector('.lg-illustration');
    if (!art || !svg) return undefined;
    let raf = 0;
    const tick = (now) => {
      const clock = svg.getCurrentTime ? svg.getCurrentTime() : now / 1000;
      art.style.setProperty('--day', dayAt(Math.min(clock, LOOP)).toFixed(3));
      if (clock < LOOP) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
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
    <aside className="lg-art" ref={artRef} aria-label="Night scene: a professional repairs a broken light and the house lights up">
      <div className="lg-art-glow glow-one" />
      <div className="lg-art-glow glow-two" />
      <svg className="lg-illustration" viewBox="0 0 620 520" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="home-fill" x1="394" y1="188" x2="536" y2="390" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fbfcf6" /><stop offset="1" stopColor="#dce5d0" />
          </linearGradient>
          <linearGradient id="tool-fill" x1="450" y1="316" x2="484" y2="382" gradientUnits="userSpaceOnUse">
            <stop stopColor="#cbd99b" /><stop offset="1" stopColor="#9daf6c" />
          </linearGradient>
          <linearGradient id="thar-body" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#cf5640" /><stop offset="1" stopColor="#962f23" />
          </linearGradient>
          <radialGradient id="cut"><stop stopColor="#000" /><stop offset=".55" stopColor="#000" stopOpacity=".55" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
          <linearGradient id="beam-cut" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#000" /><stop offset="1" stopColor="#000" stopOpacity="0" /></linearGradient>
          <linearGradient id="beam-glow" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#fff2c4" stopOpacity=".42" /><stop offset="1" stopColor="#fff2c4" stopOpacity="0" /></linearGradient>
          <radialGradient id="warm"><stop stopColor="#ffe9a8" stopOpacity=".95" /><stop offset=".4" stopColor="#ffd37a" stopOpacity=".4" /><stop offset="1" stopColor="#ffd37a" stopOpacity="0" /></radialGradient>
          <clipPath id="work-clip"><rect x="420" y="275" width="34" height="34" rx="8" /></clipPath>
          <mask id="night-mask" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="6600" height="6600">
            <rect x="-3000" y="-3000" width="6600" height="6600" fill="#fff" />
            <g>
              {carMove}
              <polygon points="238,314 372,276 372,376 238,328" fill="url(#beam-cut)" />
              <circle cx="236" cy="320" r="34" fill="url(#cut)" />
            </g>
            <ellipse cx="340" cy="345" rx="260" ry="100" fill="url(#cut)" opacity=".5" />
            <circle cx="465" cy="300" r="200" fill="url(#cut)" opacity="0"><animate attributeName="opacity" {...track(LIT)} /></circle>
            <circle cx="467" cy="306" r="70" fill="url(#cut)" opacity="0"><animate attributeName="opacity" {...track(scaled(BULB, 0.8))} /></circle>
          </mask>
        </defs>

        <ellipse className="art-ground" cx="330" cy="423" rx="224" ry="22" fill="#879670" fillOpacity=".14" />
        <circle className="art-orbit" cx="330" cy="270" r="200" stroke="#9aa983" strokeOpacity=".32" strokeDasharray="2 9">
          <animateTransform attributeName="transform" type="rotate" from="0 330 270" to="360 330 270" dur="44s" repeatCount="indefinite" />
        </circle>

        {/* House: dark and faintly visible at first, windows and doorway warm up once the bulb is fixed. */}
        <g className="art-home" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M392 383.5H540" stroke="#c9d79a" strokeWidth="4" pathLength="1" strokeDasharray="1" strokeDashoffset="1">{drawOn(0.05, 1.2)}</path>
          <path d="m383 262 82-92 82 92" stroke="#8fa07c" strokeWidth="5" pathLength="1" strokeDasharray="1" strokeDashoffset="1">{drawOn(0.15)}{outlineTone}</path>
          <path d="M405 240V382H525V240" stroke="#8fa07c" strokeWidth="3" pathLength="1" strokeDasharray="1" strokeDashoffset="1">{drawOn(0.4)}{outlineTone}</path>
          <path d="M497 207V186h16v38" stroke="#8fa07c" strokeWidth="3" pathLength="1" strokeDasharray="1" strokeDashoffset="1">{drawOn(0.6)}{outlineTone}</path>
          <g opacity="0"><animate attributeName="opacity" {...track(LIT)} /><path className="pl-smoke" d="M505 180c-5-6 5-10 0-17" /></g>
          {[[420, LIT_W1], [488, LIT_W2]].map(([wx, pts]) => <g key={wx}>
            <rect x={wx - 4} y="271" width="42" height="42" rx="10" fill="#ffd98a" opacity="0" style={{ filter: 'blur(9px)' }}><animate attributeName="opacity" values="0;0;.75;.75" keyTimes={track(pts).keyTimes} dur={`${LOOP}s`} repeatCount="1" fill="freeze" /></rect>
            <rect x={wx} y="275" width="34" height="34" rx="7" fill="#dfe6d2" stroke="#6f7f5c" strokeWidth="2.4">{litFill(pts, '#dfe6d2', '#ffe1a0')}{litFill(pts, '#6f7f5c', '#8a6f2e', 'stroke')}</rect>
            <path d={`M${wx + 17} 276v32M${wx + 1} 292h32`} stroke="#8a9a74" strokeWidth="1.6" opacity=".7" />
          </g>)}
          <rect x="450" y="316" width="34" height="66" rx="6" fill="#1d241b" stroke="none" />
          <rect x="450" y="316" width="34" height="66" rx="6" fill="#ffe3a0" opacity="0" stroke="none"><animate attributeName="opacity" {...track(LIT_DOOR)} /></rect>
          <rect x="450" y="316" width="34" height="66" rx="6" fill="#dfe6d2" stroke="#6f7f5c" strokeWidth="2.6">
            <animate attributeName="width" {...track(DOOR_W)} />
            {litFill(LIT_DOOR, '#dfe6d2', '#ffe1a0')}
          </rect>
          <circle cx="477" cy="350" r="2" fill="#5f6f4d" stroke="none" />
          <path d="M462 294h10v4h-10Z" fill="#465140" stroke="none" />
          <circle cx="467" cy="305" r="5" fill="#8b9484" stroke="#465140" strokeWidth="1.6" />
        </g>

        {/* Thar-style 4x4: boxy tub, black flared arches, soft top, round lamp and a rear-mounted spare. */}
        <g className="art-van">
          <animateTransform attributeName="transform" type="translate" values={CAR_X} keyTimes={CAR_T} keySplines=".42 0 .58 1;0 0 1 1;.42 0 .58 1" calcMode="spline" dur={`${LOOP}s`} repeatCount="1" fill="freeze" />
          <ellipse cx="156" cy="366" rx="96" ry="8" fill="#000" fillOpacity=".25" />
          <ellipse cx="78" cy="322" rx="7" ry="16" fill="#161b17" />
          <ellipse cx="78" cy="322" rx="2.6" ry="7" fill="#8c948a" />
          <rect x="84" y="306" width="148" height="34" rx="3" fill="url(#thar-body)" stroke="#5f1d15" strokeWidth="1.6" />
          <path d="M182 306h46" stroke="#e8836f" strokeOpacity=".5" strokeWidth="1.4" />
          <path d="M88 291q1-3 7-3h66q6 0 9 4l12 14H88Z" fill="#1b211d" />
          <path d="M126 293h37l11 13h-48Z" fill="#2b3a40" /><path d="M98 294h22v12H98Z" fill="#2b3a40" />
          <path d="M129 295l10 0M101 296h8" stroke="#8fb0b8" strokeOpacity=".5" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M172 292l12 14" stroke="#1b211d" strokeWidth="3" />
          <path d="M124 307v31M176 307v31" stroke="#5f1d15" strokeOpacity=".7" strokeWidth="1.2" />
          <rect x="160" y="313" width="11" height="2.8" rx="1.2" fill="#1b211d" />
          <rect x="134" y="338" width="50" height="5" rx="2" fill="#1b211d" />
          <rect x="180" y="302" width="8" height="5" rx="1.6" fill="#1b211d" />
          <path d="M232 308l7 3v27l-7 2Z" fill="#242a26" />
          <path d="M234 313v22M236 313v22M238 314v21" stroke="#aeb5a6" strokeWidth=".9" />
          <ellipse cx="237" cy="318" rx="3.4" ry="5.6" fill="#fff3c8" stroke="#1b211d" strokeWidth="1.6" />
          <rect x="228" y="334" width="9" height="9" rx="2" fill="#1b211d" />
          <rect x="82" y="312" width="3.5" height="10" rx="1" fill="#e0443a" />
          {[110, 205].map((cx) => <g key={cx}>
            <path d={`M${cx - 24} 342A24 24 0 0 1 ${cx + 24} 342Z`} fill="#0e120d" />
            <path d={`M${cx - 24} 342A24 24 0 0 1 ${cx + 24} 342`} stroke="#161b17" strokeWidth="6" />
            <g>
              {wheelSpin(cx)}
              <circle cx={cx} cy="345" r="19" fill="#141915" />
              <circle cx={cx} cy="345" r="12" fill="#9aa294" stroke="#6b7367" strokeWidth="2" />
              <path d={`M${cx} 334v22M${cx - 11} 345h22M${cx - 8} 337l16 16M${cx + 8} 337l-16 16`} stroke="#5d655a" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx={cx} cy="345" r="3.2" fill="#3b4138" />
            </g>
          </g>)}
        </g>

        {dayDetails}
        <g className="art-spark spark-a"><path d="M149 190v22m-11-11h22" stroke="#a3b475" strokeWidth="3" strokeLinecap="round" /></g>
        <circle className="art-dot dot-a" cx="475" cy="147" r="7" fill="#d5e2a1" />
        <circle className="art-dot dot-b" cx="144" cy="340" r="5" fill="#b9c796" />

        {/* Night: one dark veil with holes where light falls (headlights, the repaired house). */}
        <rect x="-3000" y="-3000" width="6600" height="6600" fill="#0d1511" fillOpacity=".64" mask="url(#night-mask)">
          <animate attributeName="fill-opacity" {...track(VEIL)} />
        </rect>

        {workWindow(WORK_L, false)}
        {workWindow(WORK_R, true)}

        {/* The professional sits above the night veil (slightly dimmed) so he stays readable in the dark. */}
        <g style={{ filter: 'brightness(.92) saturate(1.05)' }}><Courier /></g>

        <g style={{ mixBlendMode: 'screen' }}>
          <g>
            <animate attributeName="opacity" {...track(NIGHT_ONLY)} />
            {STARS.map(([sx, sy, sr], i) => <circle key={i} cx={sx} cy={sy} r={sr} fill="#dfe8cf" opacity=".5">
              <animate attributeName="opacity" values=".15;.8;.15" dur={`${3 + (i % 4)}s`} begin={`${-i * 0.7}s`} repeatCount="indefinite" />
            </circle>)}
            <circle cx="96" cy="104" r="15" fill="#e6eed3" opacity=".78" />
            <circle cx="102" cy="99" r="13" fill="#0d1511" />
            <circle cx="96" cy="104" r="46" fill="url(#warm)" opacity=".12" />
          </g>
          <ellipse cx="467" cy="388" rx="92" ry="12" fill="#ffe2a0" opacity="0"><animate attributeName="opacity" {...track(scaled(LIT, 0.34))} /></ellipse>
          <circle cx="467" cy="306" r="52" fill="url(#warm)" opacity="0"><animate attributeName="opacity" {...track(BULB)} /></circle>
          <circle cx="467" cy="305" r="4.4" fill="#fff4c9" opacity="0"><animate attributeName="opacity" {...track(BULB)} /></circle>
          <g>
            {carMove}
            <polygon points="240,316 372,278 372,374 240,326" fill="url(#beam-glow)" />
            <circle cx="237" cy="318" r="15" fill="url(#warm)" />
            <circle cx="82" cy="317" r="9" fill="#ff5a48" opacity=".35" />
          </g>
        </g>
      </svg>
      <div className="lg-art-chip chip-a"><i>✓</i><span><b>Bulb replaced</b><small>Hallway light · 12 min</small></span></div>
      <div className="lg-art-chip chip-b"><i>★</i><span><b>5.0 rating</b><small>Homeowner feedback</small></span></div>
      <div className="lg-art-chip chip-c"><i>#</i><span><b>Booking 2041</b><small>Completed · Paid</small></span></div>
      <div className="lg-art-copy"><span>HOME SERVICE OPERATIONS</span><h2>A clearer view<br />of every detail.</h2><p>Bookings, teams, and orders in one calm workspace.</p></div>
    </aside>
  </main>;
}

/* Windows light in the order the workspace "comes online": bookings, orders, pros, inbox. */
const LOAD_STEPS = ['Warming up', 'Opening bookings', 'Checking orders', 'Syncing pros', 'Reading the inbox'];
const LOAD_AT = [0, 0.9, 1.32, 1.74, 2.16, 2.6];
const WINDOWS = [[78, 100], [154, 100], [74, 138], [160, 138]];

function PostLoginLoader({ name }) {
  const first = (name || '').trim().split(/\s+/)[0];
  return <main className="pl" role="status" aria-label="Setting up your admin workspace">
    <span className="pl-brand">fixzy<i /></span>
    <div className="pl-stage">
      <svg className="pl-house" viewBox="0 0 260 200" aria-hidden="true">
        <path className="pl-ground" d="M18 176H242" pathLength="1" />
        <path className="pl-draw" style={{ '--d': '.15s' }} strokeWidth="5" d="M36 96 130 22l94 74" pathLength="1" />
        <path className="pl-draw" style={{ '--d': '.4s' }} strokeWidth="3" d="M52 84V176H208V84" pathLength="1" />
        <path className="pl-draw" style={{ '--d': '.6s' }} strokeWidth="3" d="M170 56V34h18v40" pathLength="1" />
        <path className="pl-smoke" d="M179 28c-5-6 5-10 0-17" />
        {WINDOWS.map(([x, y], i) => <g key={i} style={{ '--i': i }}>
          <rect className="pl-glow" x={x - 4} y={y - 4} width="36" height="36" rx="9" />
          <rect className="pl-win" x={x} y={y} width="28" height={i < 2 ? 28 : 26} rx="6" />
          <path className="pl-bar" d={`M${x + 14} ${y + 1}v${i < 2 ? 26 : 24}M${x + 1} ${y + 13}h26`} />
        </g>)}
        <rect className="pl-glow" style={{ animationDelay: '2.6s' }} x="112" y="126" width="36" height="56" rx="9" />
        <rect className="pl-door" x="116" y="130" width="28" height="46" rx="6" />
        <circle className="pl-knob" cx="137" cy="154" r="2" />
      </svg>
      <h1 className="pl-title">Setting up your workspace</h1>
      <p className="pl-say" aria-live="polite">
        {LOAD_STEPS.map((s, k) => <span key={s} style={{ '--d': `${LOAD_AT[k]}s`, '--l': `${(LOAD_AT[k + 1] - LOAD_AT[k]).toFixed(2)}s` }}>{s}</span>)}
        <span className="last">{first ? `Welcome back, ${first}` : 'Welcome back'}</span>
      </p>
    </div>
  </main>;
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking session
  const [afterLogin, setAfterLogin] = useState(false);
  const route = useHash();
  const navRef = useRef(null);
  const indicatorRef = useRef(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const barSlots = useBarSlots();
  useLiquidIndicator(navRef, indicatorRef, route, !!user && !afterLogin, barSlots); // re-runs once the nav actually mounts after the post-login loader
  useEffect(() => { setMoreOpen(false); }, [route]);

  useEffect(() => { refresh().then((u) => setUser(u.role === 'ADMIN' ? u : null), () => setUser(null)); }, []);
  useEffect(() => {
    if (!afterLogin) return undefined;
    const timer = setTimeout(() => setAfterLogin(false), 3700);
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
  if (afterLogin) return <PostLoginLoader name={user.name} />;

  const found = ROUTES.find((r) => r[0] === shown) ?? ROUTES[0];
  const [, , Page] = found;

  /* Fewer slots fit at a given width -> more routes drop into the categorised More submenu.
     One slot is reserved for the More trigger itself whenever anything overflows. */
  const overflowing = barSlots < ROUTES.length;
  const primaryRoutes = overflowing ? ROUTES.slice(0, barSlots - 1) : ROUTES;
  const overflowRoutes = overflowing ? ROUTES.slice(barSlots - 1) : [];
  const overflowGroups = Object.keys(GROUP_LABELS)
    .map((key) => [key, GROUP_LABELS[key], overflowRoutes.filter((r) => r[5] === key)])
    .filter(([, , items]) => items.length);
  const activeOverflow = overflowRoutes.find((r) => r[0] === route);

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
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v8" /><path d="M7.05 6.6a8 8 0 1 0 9.9 0" /></svg>
          </button>
        </div>
      </div>
    </header>

    <nav className="side" aria-label="Admin" ref={navRef} style={{ '--cols': primaryRoutes.length + (overflowing ? 1 : 0) }}>
      <span className="side-indicator" ref={indicatorRef} aria-hidden="true" />
      {primaryRoutes.map(([id, name, , icon, hue]) => <a key={id} href={`#/${id}`} data-hue={hue} className={route === id ? 'on' : ''} aria-current={route === id ? 'page' : undefined}
        style={{ '--on-ink': BRIGHT[hue][1] }}>
        <LordIcon icon={icon} size={21} colors={route === id ? `primary:${BRIGHT[hue][1]},secondary:${BRIGHT[hue][1]}` : 'primary:#e9ecf5,secondary:#e9ecf5'} trigger={route === id ? 'loop' : 'hover'} />
        <span className="side-label">{name}</span>
      </a>)}
      {overflowing && (() => {
        const hue = activeOverflow ? activeOverflow[4] : primaryRoutes[0][4];
        return <button type="button" className={`more-trigger${activeOverflow ? ' on' : ''}`} data-hue={hue}
          aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}
          style={activeOverflow ? { '--on-ink': BRIGHT[hue][1] } : undefined}>
          <svg viewBox="0 0 20 20" width="21" height="21" fill="currentColor" aria-hidden="true">
            <circle cx="4.5" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="15.5" cy="10" r="1.5" />
          </svg>
          <span className="side-label">More</span>
        </button>;
      })()}
    </nav>
    {overflowing && <MoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} route={route} groups={overflowGroups} />}

    <main className={`main${leaving ? ' leaving' : ''}${found[0] === 'dashboard' ? ' is-dash' : ''}`}><div className="page-view" key={shown}><Page me={user} /></div></main>
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
