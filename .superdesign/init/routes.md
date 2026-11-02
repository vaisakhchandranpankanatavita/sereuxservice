# Routes

Single-page app: only `/` (served in production by `home.php`, which loads `/assets/build/app.css` + `/assets/build/app.js`; in dev `index.html` loads `/src/main.jsx`). Other pages are external PHP pages (not part of this repo's React app) and must stay as links:

- /home.php (brand link), /login.php, /register.php, /shop.php (Marketplace), /orders.php (My bookings), /dashboard.php, /services.php (View all services / Help & support), mailto:hello@serieux.in
- Booking link per service: `/login.php?redirect=service-request&service_id=<id>` (ids: Plumbing 1, Electrical 2, AC repair 3, Carpentry 4, Painting 5, Home cleaning 6, Appliance repair 7, Pest control 8)

Build: `vite build` -> `assets/build/app.js` + `app.css` (single entry `src/main.jsx`, fixed filenames).

## / (Home) sections, in order
Header; Hero (eyebrow, h1 'Good help for the place you love.', description, search form, note, hero photo with caption 'Plumbing From ₹500' + booking link, 'Explore services' scroll link); Services (#services, 8-row list filtered by search query, empty state, 'View all services'); WhyFixzy (photo + 3 numbered points); Marketplace (copy + photo link to /shop.php); Final CTA (dark band, 'Get started' -> /register.php); Footer.
