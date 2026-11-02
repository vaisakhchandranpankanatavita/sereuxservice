import React from 'react';
import { createRoot } from 'react-dom/client';
import Lenis from 'lenis';
import App from './App.jsx';
import { Contact, ForgotPassword, Help, Login, Privacy, Product, Register, ServicesPage, Shop } from './pages.jsx';
import { Dashboard, Orders } from './account.jsx';
import { Checkout, ServiceRequest } from './flows.jsx';
import { ToastProvider } from './ui.jsx';
import '../assets/css/redesign.css';
import '../assets/css/pages.css';

/* Each PHP entry (login.php, shop.php, …) serves this same shell; the page is chosen from the URL. */
const ROUTES = {
  'login': Login,
  'register': Register,
  'forgot-password': ForgotPassword,
  'services': ServicesPage,
  'shop': Shop,
  'product': Product,
  'orders': Orders,
  'dashboard': Dashboard,
  'help': Help,
  'contact': Contact,
  'privacy': Privacy,
  'checkout': Checkout,
  'service-request': ServiceRequest,
};

/* Smooth, inertial wheel scrolling (skipped for reduced motion); in-page anchors glide too. */
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -72 } });
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

const slug = window.location.pathname.split('/').pop().replace(/\.php$/, '');
const HOME_SLUGS = ['', 'index', 'home'];
const NotFound = () => (
  <main style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', textAlign: 'center', gap: 16, padding: 24 }}>
    <h1 style={{ fontSize: 'clamp(48px,10vw,120px)', fontWeight: 800, letterSpacing: '-.055em', lineHeight: .9, margin: 0 }}>404.</h1>
    <p>That page doesn’t exist.</p>
    <p><a className="pill" href="/">Back home</a></p>
  </main>
);
const Page = ROUTES[slug] || (HOME_SLUGS.includes(slug) ? App : NotFound);
if (Page === NotFound) document.title = 'Page not found — Fixzy';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider><Page /></ToastProvider>
  </React.StrictMode>,
);
