# Extractable components

Single-page app; Header and Footer exist only once (in `src/App.jsx`) and the redesign will restyle them, so component extraction is intentionally skipped (no multi-page reuse benefit).

- Header — `src/App.jsx` — layout — sticky nav with mobile menu (candidate if more pages are added later)
- Footer — `src/App.jsx` — layout — 4-column dark footer
