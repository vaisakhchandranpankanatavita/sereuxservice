import { useEffect, useRef, useState } from 'react';

const ICONS = {
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  'search-x': <><path d="m13.5 8.5-5 5" /><path d="m8.5 8.5 5 5" /><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  'arrow-right': <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  'arrow-up-right': <><path d="M7 7h10v10" /><path d="M7 17 17 7" /></>,
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  'shield-check': <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>,
  'circle-check': <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  snowflake: <><path d="m10 20-1.25-2.5L6 18" /><path d="M10 4 8.75 6.5 6 6" /><path d="m14 20 1.25-2.5L18 18" /><path d="m14 4 1.25 2.5L18 6" /><path d="m17 21-3-6h-4" /><path d="m17 3-3 6 1.5 3" /><path d="M2 12h6.5L10 9" /><path d="m20 10-1.5 2 1.5 2" /><path d="M22 12h-6.5L14 15" /><path d="m4 10 1.5 2L4 14" /><path d="m7 21 3-6-1.5-3" /><path d="m7 3 3 6h4" /></>,
  hammer: <><path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9" /><path d="m18 15 4-4" /><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" /></>,
  sparkles: <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />,
  zap: <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />,
  'paint-roller': <><rect width="16" height="6" x="2" y="2" rx="2" /><path d="M10 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect width="4" height="6" x="8" y="16" rx="1" /></>,
  bug: <><path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" /><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" /><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" /></>,
  'washing-machine': <><path d="M3 6h3" /><path d="M17 6h.01" /><rect width="18" height="20" x="3" y="2" rx="2" /><circle cx="12" cy="13" r="5" /><path d="M12 18a2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 1 0-5" /></>,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />,
  'calendar-check': <><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="m9 16 2 2 4-4" /></>,
  rupee: <><path d="M6 3h12" /><path d="M6 8h12" /><path d="m6 13 8.5 8" /><path d="M6 13h3" /><path d="M9 13c6.667 0 6.667-10 0-10" /></>,
  briefcase: <><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect width="20" height="14" x="2" y="6" rx="2" /></>,
  headset: <><path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z" /><path d="M21 16v2a4 4 0 0 1-4 4h-5" /></>,
  heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  mail: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
};

function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

const services = [
  { name: 'AC repair', description: 'Servicing, repairs and installation.', price: '₹800', id: 3, icon: 'snowflake', terms: 'air conditioning cooling maintenance installation' },
  { name: 'Appliance repair', description: 'Repairs for the things you use every day.', price: '₹550', id: 7, icon: 'washing-machine', terms: 'refrigerator washing machine microwave' },
  { name: 'Carpentry', description: 'Furniture repairs and practical woodwork.', price: '₹700', id: 4, icon: 'hammer', terms: 'carpenter furniture woodwork custom' },
  { name: 'Home cleaning', description: 'Regular upkeep and deep cleaning.', price: '₹400', id: 6, icon: 'sparkles', terms: 'cleaning deep clean house' },
  { name: 'Electrical work', description: 'Repairs, fittings and installations.', price: '₹600', id: 2, icon: 'zap', terms: 'electrician wiring lights fan' },
  { name: 'Painting', description: 'Interior and exterior painting.', price: '₹1,000', id: 5, icon: 'paint-roller', terms: 'painter interior exterior walls' },
  { name: 'Pest control', description: 'Treatment for common household pests.', price: '₹450', id: 8, icon: 'bug', terms: 'extermination insects bugs' },
  { name: 'Plumbing', description: 'Leaks, fittings and pipe repairs.', price: '₹500', id: 1, icon: 'wrench', terms: 'plumber pipes leak tap bathroom' },
];

const marqueeItems = ['Plumbing', 'Electrical', 'AC repair', 'Carpentry', 'Painting', 'Cleaning', 'Appliances', 'Pest control'];

const stats = [
  { icon: 'briefcase', value: 50, suffix: 'k+', label: 'Jobs completed' },
  { icon: 'wrench', value: 8, suffix: '', label: 'Core services' },
  { icon: 'headset', value: 24, suffix: '/7', label: 'Customer support' },
  { icon: 'shield-check', value: 100, suffix: '%', label: 'Satisfaction guarantee' },
];

const steps = [
  { icon: 'search', title: 'Start with the job', text: 'Browse practical services for the things your home needs.' },
  { icon: 'rupee', title: 'Know the starting price', text: 'See the listed price before you continue to booking.' },
  { icon: 'calendar-check', title: 'Book when you’re ready', text: 'Sign in to request a service and manage your booking.' },
];

function useInView(options = { threshold: 0.15 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, options);
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, inView];
}

function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...props }) {
  const [ref, inView] = useInView();
  return (
    <Tag
      ref={ref}
      className={`reveal${inView ? ' is-visible' : ''} ${className}`.trim()}
      style={{ '--delay': `${delay}ms` }}
      {...props}
    >
      {children}
    </Tag>
  );
}

function CountUp({ value, suffix = '' }) {
  const [ref, inView] = useInView({ threshold: 0.6 });
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setCurrent(value);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const duration = 1400;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value]);

  return <span ref={ref}>{current}{suffix}</span>;
}

function BookingLink({ service, children, className = '', ...props }) {
  return (
    <a className={className} href={`/login.php?redirect=service-request&service_id=${service.id}`} {...props}>
      {children}
    </a>
  );
}

function Brand({ className = '' }) {
  return <a className={`brand ${className}`.trim()} href="/home.php" aria-label="Fixzy home">fixzy<span>.</span></a>;
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="header-inner">
        <Brand />
        <button
          className={`menu-toggle${menuOpen ? ' is-open' : ''}`}
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
          <a className="button button-accent button-small" href="/register.php">Create an account <Icon name="arrow-up-right" size={16} /></a>
        </div>
      </div>
    </header>
  );
}

function Hero({ query, onQueryChange, onSearch }) {
  function submitSearch(event) {
    event.preventDefault();
    onSearch();
  }

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-blob hero-blob-a" aria-hidden="true" />
      <div className="hero-blob hero-blob-b" aria-hidden="true" />
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="eyebrow hero-in" style={{ '--delay': '0ms' }}><span className="eyebrow-dot" aria-hidden="true" />HOME SERVICES, MADE SIMPLE</p>
          <h1 id="hero-title" className="hero-in" style={{ '--delay': '100ms' }}>Good help for<br />the place you <em>love.</em></h1>
          <p className="hero-description hero-in" style={{ '--delay': '220ms' }}>Repairs, upkeep and everything in between. Find a local professional for the jobs on your list.</p>
          <form className="search-box hero-in" style={{ '--delay': '340ms' }} role="search" onSubmit={submitSearch}>
            <label className="visually-hidden" htmlFor="service-query">Search home services</label>
            <Icon name="search" size={20} className="search-icon" />
            <input
              id="service-query"
              type="search"
              placeholder="What needs doing?"
              autoComplete="off"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            <button className="button button-accent" type="submit">Find a service <Icon name="arrow-right" size={16} /></button>
          </form>
          <p className="hero-note hero-in" style={{ '--delay': '440ms' }}><Icon name="circle-check" size={16} /> Browse services and starting prices before you book.</p>
        </div>

        <figure className="hero-visual hero-in" style={{ '--delay': '260ms' }}>
          <div className="hero-image">
            <img src="https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1400&q=85" alt="A home professional working beneath a kitchen sink" />
            <figcaption>
              <span className="caption-text"><strong>Plumbing</strong><span>From ₹500</span></span>
              <BookingLink service={services[7]} className="image-link" aria-label="Book a plumbing service"><Icon name="arrow-up-right" size={20} /></BookingLink>
            </figcaption>
          </div>
          <div className="float-card float-card-a">
            <span className="float-icon"><Icon name="star" size={20} /></span>
            <span><strong>4.8/5 rating</strong><small>Based on 10k+ reviews</small></span>
          </div>
          <div className="float-card float-card-b">
            <span className="float-icon"><Icon name="shield-check" size={20} /></span>
            <span><strong>Verified pros</strong><small>Background checked</small></span>
          </div>
          <div className="float-card float-card-c">
            <span className="float-icon"><Icon name="clock" size={20} /></span>
            <span><strong>Same-day slots</strong><small>Book in minutes</small></span>
          </div>
        </figure>
      </div>
    </section>
  );
}

function StatsStrip() {
  return (
    <section className="stats-strip" aria-label="Fixzy at a glance">
      <div className="wrap stats-grid">
        {stats.map((stat, index) => (
          <Reveal key={stat.label} delay={index * 90} className="stat">
            <span className="stat-icon"><Icon name={stat.icon} size={20} /></span>
            <p className="stat-value"><CountUp value={stat.value} suffix={stat.suffix} /></p>
            <p className="stat-label">{stat.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function ServiceCard({ service, index }) {
  return (
    <Reveal as="article" delay={(index % 4) * 80} className="service-card">
      <BookingLink service={service} className="service-link">
        <span className="service-icon"><Icon name={service.icon} size={26} /></span>
        <span className="service-name">{service.name}</span>
        <span className="service-description">{service.description}</span>
        <span className="service-foot">
          <span className="service-price">From {service.price}</span>
          <span className="service-arrow" aria-hidden="true"><Icon name="arrow-right" size={16} /></span>
        </span>
      </BookingLink>
    </Reveal>
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
        <Reveal className="section-heading">
          <div>
            <p className="eyebrow">A GOOD PLACE TO START</p>
            <h2 id="services-title">What can we help <em>with?</em></h2>
          </div>
          <p className="section-intro">Choose a service to see its starting price and get your booking underway.</p>
        </Reveal>
        <div className="service-list" aria-live="polite">
          {visibleServices.map((service, index) => <ServiceCard key={service.id} service={service} index={index} />)}
        </div>
        {visibleServices.length === 0 && (
          <div className="empty-search">
            <span className="empty-icon"><Icon name="search-x" size={26} /></span>
            <p>We couldn’t find that service. Try another search, or browse all services.</p>
          </div>
        )}
        <div className="service-bottom">
          <p>Looking for something else?</p>
          <a href="/services.php">View all services <Icon name="arrow-right" size={16} /></a>
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const items = [...marqueeItems, ...marqueeItems];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {items.map((item, index) => <span key={`${item}-${index}`}><Icon name="star" size={14} /> {item}</span>)}
      </div>
    </div>
  );
}

function WhyFixzy() {
  return (
    <section className="promise-section section-pad" aria-labelledby="promise-title">
      <div className="wrap promise-layout">
        <Reveal as="figure" className="promise-image">
          <img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=85" alt="A professional cleaning a bright home" loading="lazy" />
          <div className="float-card float-card-d">
            <span className="float-icon"><Icon name="heart" size={20} /></span>
            <span><strong>Loved by homes</strong><small>Across your city</small></span>
          </div>
        </Reveal>
        <div className="promise-copy">
          <Reveal>
            <p className="eyebrow">A MORE CONSIDERED WAY TO BOOK</p>
            <h2 id="promise-title">Take care of home.<br /><em>We’ll help with the rest.</em></h2>
            <p className="promise-intro">Finding help shouldn’t become another job. Fixzy brings local services together so you can compare, choose and book in one place.</p>
          </Reveal>
          <ul className="promise-list">
            {steps.map((step, index) => (
              <Reveal as="li" key={step.title} delay={index * 120}>
                <span className="step-badge"><Icon name={step.icon} size={20} /><b>0{index + 1}</b></span>
                <div><h3>{step.title}</h3><p>{step.text}</p></div>
              </Reveal>
            ))}
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
        <Reveal className="marketplace-copy">
          <p className="eyebrow">THE FIXZY MARKETPLACE</p>
          <h2 id="marketplace-title">Useful finds for<br /><em>everyday living.</em></h2>
          <p>Browse home and lifestyle products from the Fixzy marketplace.</p>
          <a className="text-link" href="/shop.php">Explore the marketplace <Icon name="arrow-right" size={16} /></a>
        </Reveal>
        <Reveal as="a" delay={120} className="marketplace-image" href="/shop.php" aria-label="Browse the Fixzy marketplace">
          <img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85" alt="A calm, naturally lit living room" loading="lazy" />
          <span>For the place you call home <span className="marketplace-arrow"><Icon name="arrow-up-right" size={18} /></span></span>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-main">
          <div className="footer-brand-block"><Brand className="brand-footer" /><p>A little help for a happier home. We connect you with trusted professionals for all your home service needs.</p></div>
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

  function scrollToServices() {
    document.querySelector('#services')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <Header />
      <main>
        <Hero query={query} onQueryChange={setQuery} onSearch={scrollToServices} />
        <StatsStrip />
        <Services query={query} />
        <Marquee />
        <WhyFixzy />
        <Marketplace />
        <section className="final-cta" aria-labelledby="cta-title">
          <div className="wrap cta-inner">
            <Reveal><p className="eyebrow">WHEN HOME NEEDS A HAND</p><h2 id="cta-title">Let’s get it<br /><em>taken care of.</em></h2></Reveal>
            <Reveal delay={120}><a className="button button-accent button-large" href="/register.php">Get started <Icon name="arrow-up-right" size={20} /></a></Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
