# Components

Single-page React 18+/Vite app, vanilla CSS (no Tailwind, no component library). There is no shared ui/ directory: all components live in `src/App.jsx` (Brand, Header, Hero, ServiceRow, Services, WhyFixzy, Marketplace, Footer, App). No shared primitives beyond the `.button`, `.button-accent`, `.button-small` CSS classes.

## src/App.jsx (full source)
```jsx
import { useState } from 'react';

const services = [
  { name: 'AC repair', description: 'Servicing, repairs and installation.', price: '₹800', id: 3, terms: 'air conditioning cooling maintenance installation' },
  { name: 'Appliance repair', description: 'Repairs for the things you use every day.', price: '₹550', id: 7, terms: 'refrigerator washing machine microwave' },
  { name: 'Carpentry', description: 'Furniture repairs and practical woodwork.', price: '₹700', id: 4, terms: 'carpenter furniture woodwork custom' },
  { name: 'Home cleaning', description: 'Regular upkeep and deep cleaning.', price: '₹400', id: 6, terms: 'cleaning deep clean house' },
  { name: 'Electrical work', description: 'Repairs, fittings and installations.', price: '₹600', id: 2, terms: 'electrician wiring lights fan' },
  { name: 'Painting', description: 'Interior and exterior painting.', price: '₹1,000', id: 5, terms: 'painter interior exterior walls' },
  { name: 'Pest control', description: 'Treatment for common household pests.', price: '₹450', id: 8, terms: 'extermination insects bugs' },
  { name: 'Plumbing', description: 'Leaks, fittings and pipe repairs.', price: '₹500', id: 1, terms: 'plumber pipes leak tap bathroom' },
];

function BookingLink({ service, children, className = '', ...props }) {
  return (
    <a className={className} href={`/login.php?redirect=service-request&service_id=${service.id}`} {...props}>
      {children}
    </a>
  );
}

function Brand() {
  return <a className="brand" href="/home.php" aria-label="Fixzy home">fixzy<span>.</span></a>;
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span /><span />
        </button>
        <nav className={`main-nav${menuOpen ? ' open' : ''}`} id="main-nav" aria-label="Main navigation">
          <a href="#services" onClick={closeMenu}>Services</a>
          <a href="/shop.php" onClick={closeMenu}>Marketplace</a>
          <a href="/orders.php" onClick={closeMenu}>My bookings</a>
        </nav>
        <div className="header-actions">
          <a className="sign-in" href="/login.php">Sign in</a>
          <a className="button button-accent button-small" href="/register.php">Create an account <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </header>
  );
}

function Hero({ onSearch }) {
  const [query, setQuery] = useState('');

  function submitSearch(event) {
    event.preventDefault();
    onSearch(query);
  }

  return (
    <section className="hero wrap" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">HOME SERVICES, MADE SIMPLE</p>
        <h1 id="hero-title">Good help for<br />the place you <em>love.</em></h1>
        <p className="hero-description">Repairs, upkeep and everything in between. Find a local professional for the jobs on your list.</p>
        <form className="search-box" role="search" onSubmit={submitSearch}>
          <label className="visually-hidden" htmlFor="service-query">Search home services</label>
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            id="service-query"
            type="search"
            placeholder="What needs doing?"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="button button-accent" type="submit">Find a service <span aria-hidden="true">→</span></button>
        </form>
        <p className="hero-note"><span aria-hidden="true">✓</span> Browse services and starting prices before you book.</p>
      </div>
      <figure className="hero-image">
        <img src="https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1400&q=85" alt="A home professional working beneath a kitchen sink" />
        <figcaption><span>Plumbing</span><span>From ₹500</span><BookingLink service={services[7]} className="image-link" aria-label="Book a plumbing service">↗</BookingLink></figcaption>
      </figure>
      <a className="hero-scroll" href="#services">Explore services <span aria-hidden="true">↓</span></a>
    </section>
  );
}

function ServiceRow({ service }) {
  return (
    <article className="service-row">
      <BookingLink service={service} className="service-link">
        <span className="service-name">{service.name}</span>
        <span className="service-description">{service.description}</span>
        <span className="service-price">From {service.price}</span>
        <span className="service-arrow" aria-hidden="true">↗</span>
      </BookingLink>
    </article>
  );
}

function Services({ query }) {
  const normalized = query.trim().toLowerCase();
  const visibleServices = services.filter((service) =>
    !normalized || `${service.name} ${service.description} ${service.terms}`.toLowerCase().includes(normalized),
  );

  return (
    <section className="services-section section-pad" id="services" aria-labelledby="services-title">
      <div className="wrap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A GOOD PLACE TO START</p>
            <h2 id="services-title">What can we help <em>with?</em></h2>
          </div>
          <p className="section-intro">Choose a service to see its starting price and get your booking underway.</p>
        </div>
        <div className="service-list" aria-live="polite">
          {visibleServices.map((service) => <ServiceRow key={service.id} service={service} />)}
        </div>
        {visibleServices.length === 0 && <p className="empty-search">We couldn’t find that service. Try another search, or browse all services.</p>}
        <div className="service-bottom">
          <p>Looking for something else?</p>
          <a href="/services.php">View all services <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </section>
  );
}

function WhyFixzy() {
  return (
    <section className="promise-section section-pad" aria-labelledby="promise-title">
      <div className="wrap promise-layout">
        <figure className="promise-image">
          <img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=85" alt="A professional cleaning a bright home" loading="lazy" />
        </figure>
        <div className="promise-copy">
          <p className="eyebrow">A MORE CONSIDERED WAY TO BOOK</p>
          <h2 id="promise-title">Take care of home.<br /><em>We’ll help with the rest.</em></h2>
          <p className="promise-intro">Finding help shouldn’t become another job. Fixzy brings local services together so you can compare, choose and book in one place.</p>
          <ul className="promise-list">
            <li><span>01</span><div><h3>Start with the job</h3><p>Browse practical services for the things your home needs.</p></div></li>
            <li><span>02</span><div><h3>Know the starting price</h3><p>See the listed price before you continue to booking.</p></div></li>
            <li><span>03</span><div><h3>Book when you’re ready</h3><p>Sign in to request a service and manage your booking.</p></div></li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Marketplace() {
  return (
    <section className="marketplace-section section-pad" aria-labelledby="marketplace-title">
      <div className="wrap marketplace-layout">
        <div className="marketplace-copy">
          <p className="eyebrow">THE FIXZY MARKETPLACE</p>
          <h2 id="marketplace-title">Useful finds for<br /><em>everyday living.</em></h2>
          <p>Browse home and lifestyle products from the Fixzy marketplace.</p>
          <a className="text-link" href="/shop.php">Explore the marketplace <span aria-hidden="true">↗</span></a>
        </div>
        <a className="marketplace-image" href="/shop.php" aria-label="Browse the Fixzy marketplace">
          <img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85" alt="A calm, naturally lit living room" loading="lazy" />
          <span>For the place you call home <span aria-hidden="true">↗</span></span>
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-main">
          <div className="footer-brand-block"><Brand /><p>A little help for a happier home.</p></div>
          <nav className="footer-column" aria-label="Explore"><h2>Explore</h2><a href="#services">Services</a><a href="/shop.php">Marketplace</a><a href="/orders.php">My bookings</a></nav>
          <nav className="footer-column" aria-label="Your account"><h2>Your account</h2><a href="/login.php">Sign in</a><a href="/register.php">Create an account</a><a href="/dashboard.php">Dashboard</a></nav>
          <nav className="footer-column" aria-label="Support"><h2>Support</h2><a href="/services.php">Help &amp; support</a><a href="mailto:hello@serieux.in">Contact us</a></nav>
        </div>
        <div className="footer-bottom"><span>© 2026 Fixzy</span><a href="/home.php">Home services, made simple.</a></div>
      </div>
    </footer>
  );
}

export default function App() {
  const [query, setQuery] = useState('');

  function searchServices(value) {
    setQuery(value);
    document.querySelector('#services')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <Header />
      <main>
        <Hero onSearch={searchServices} />
        <Services query={query} />
        <WhyFixzy />
        <Marketplace />
        <section className="final-cta" aria-labelledby="cta-title">
          <div className="wrap cta-inner">
            <div><p className="eyebrow">WHEN HOME NEEDS A HAND</p><h2 id="cta-title">Let’s get it<br /><em>taken care of.</em></h2></div>
            <a className="button button-accent" href="/register.php">Get started <span aria-hidden="true">↗</span></a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
```

## src/main.jsx
```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '../assets/css/redesign.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```
