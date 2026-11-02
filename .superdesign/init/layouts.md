# Layouts

No separate layout files. Shell = `Header` (sticky, mobile hamburger menu via useState) + `<main>` + `Footer`, all in `src/App.jsx` (see components.md for full source). Styles for header/footer are in `assets/css/redesign.css` (full file in theme.md Part 2).

- Header: sticky 76px bar, brand wordmark 'fixzy.', nav (Services anchor, Marketplace /shop.php, My bookings /orders.php), Sign in /login.php, 'Create an account' /register.php; collapses to hamburger <=700px.
- Footer: dark (#1d201c) 4-column footer (brand, Explore, Your account, Support) + bottom bar.
