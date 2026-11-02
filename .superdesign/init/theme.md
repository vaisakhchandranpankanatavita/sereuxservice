# Theme

## Part 1 — Token summary
- Colors: ink #20231f, muted #737770, soft #f5f5f2, line #e5e6e1, white #fff, accent (sage green) #66734b, accent-dark #4d5a36; dark band #242722, footer #1d201c, footer text #a4a89f/#b9bcb6, CTA em #c9d4aa
- Fonts: Inter (Google Fonts 400-700) for UI; Georgia/Times serif italic-style accent on `<em>` inside headings
- Type: h1 clamp(46px,5.2vw,68px) weight 540 letter-spacing -.065em; h2 ~38-43px; body 10-14px (small); eyebrow 10px uppercase-style .11em tracking
- Layout: .wrap max 1160px (side margin 64px, 40px <=700px, 32px <=390px); header inner max 1320px; section padding 94px (67px mobile)
- Radius: 4px buttons, 50% round icon button; otherwise square edges. Borders 1px var(--line)
- Breakpoints: 960px, 700px, 390px
- Motion: 160ms ease-out hovers; prefers-reduced-motion block present (keep it)

## Part 2 — Raw source
### assets/css/redesign.css
```css
:root {
  color-scheme: light;
  --ink: #20231f;
  --muted: #737770;
  --soft: #f5f5f2;
  --line: #e5e6e1;
  --white: #fff;
  --accent: #66734b;
  --accent-dark: #4d5a36;
  --font: Inter, "Helvetica Neue", Arial, sans-serif;
  font-family: var(--font);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 84px; }
body { margin: 0; background: var(--white); color: var(--ink); font-family: var(--font); }
body, button, input { font-family: var(--font); }
a { color: inherit; text-decoration: none; }
button, a, input { -webkit-tap-highlight-color: transparent; }
a:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
img { display: block; max-width: 100%; }
.wrap { width: min(1160px, calc(100% - 64px)); margin-inline: auto; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

.site-header { height: 76px; position: sticky; top: 0; z-index: 20; background: rgb(255 255 255 / 94%); border-bottom: 1px solid var(--line); backdrop-filter: blur(12px); }
.header-inner { width: min(1320px, calc(100% - 64px)); height: 100%; margin: auto; display: flex; align-items: center; }
.brand { font-size: 23px; line-height: 1; font-weight: 750; letter-spacing: -1.4px; }
.brand span { color: var(--accent); }
.main-nav { display: flex; align-items: center; gap: 34px; margin-left: 78px; }
.main-nav a, .header-actions { font-size: 12px; font-weight: 550; }
.main-nav a { color: #62665f; transition: color 160ms ease-out; }
.main-nav a:hover, .sign-in:hover { color: var(--accent-dark); }
.header-actions { margin-left: auto; display: flex; align-items: center; gap: 25px; }
.button { min-height: 48px; padding: 0 19px; display: inline-flex; align-items: center; justify-content: center; gap: 22px; border: 1px solid transparent; border-radius: 4px; font-size: 12px; line-height: 1; font-weight: 600; transition: background 160ms ease-out, color 160ms ease-out, border-color 160ms ease-out, transform 160ms ease-out; }
.button:hover { transform: translateY(-1px); }
.button:active { transform: scale(.98); }
.button-accent { background: var(--accent); color: var(--white); }
.button-accent:hover { background: var(--accent-dark); }
.button-small { min-height: 39px; padding-inline: 15px; gap: 13px; }
.menu-toggle { display: none; }

.hero { min-height: 600px; padding-top: 62px; padding-bottom: 22px; display: grid; grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); grid-template-rows: 1fr auto; column-gap: 64px; }
.hero-copy { align-self: center; padding-bottom: 20px; }
.eyebrow { margin: 0; color: var(--accent); font-size: 10px; line-height: 1.4; font-weight: 650; letter-spacing: .11em; }
.hero h1, .section-heading h2, .promise-copy h2, .marketplace-copy h2, .cta-inner h2 { margin: 20px 0 16px; font-size: clamp(46px, 5.2vw, 68px); line-height: 1.04; font-weight: 540; letter-spacing: -.065em; }
.hero h1 em, .section-heading h2 em, .promise-copy h2 em, .marketplace-copy h2 em, .cta-inner h2 em { color: var(--accent); font-family: Georgia, "Times New Roman", serif; font-weight: 400; letter-spacing: -.055em; }
.hero-description { max-width: 440px; margin: 0; color: var(--muted); font-size: 14px; line-height: 1.75; }
.search-box { width: min(100%, 490px); min-height: 58px; margin-top: 27px; padding: 5px 5px 5px 15px; display: flex; align-items: center; gap: 9px; background: var(--white); border: 1px solid #d8dad4; transition: border-color 160ms ease-out; }
.search-box:focus-within { border-color: var(--accent); }
.search-icon { color: #747970; font-size: 26px; line-height: 1; transform: rotate(-15deg); }
.search-box input { min-width: 0; flex: 1; height: 44px; padding: 0; border: 0; outline: 0; color: var(--ink); font-size: 12px; background: transparent; }
.search-box input::placeholder { color: #8b8f88; opacity: 1; }
.search-box input:focus-visible { outline: 0; }
.search-box .button { min-height: 46px; white-space: nowrap; padding-inline: 15px; }
.hero-note { margin: 15px 0 0; color: var(--muted); font-size: 10px; line-height: 1.5; }
.hero-note span { margin-right: 6px; color: var(--accent); }
.hero-image { min-width: 0; height: 430px; margin: 0; position: relative; align-self: center; overflow: hidden; background: var(--soft); }
.hero-image img { width: 100%; height: 100%; object-fit: cover; object-position: 52% center; }
.hero-image figcaption { position: absolute; right: 0; bottom: 0; left: 0; min-height: 56px; padding: 0 17px; display: flex; align-items: center; gap: 17px; color: var(--white); background: rgb(24 27 23 / 82%); font-size: 11px; }
.hero-image figcaption span:nth-child(2) { color: #e0e2dc; }
.image-link { width: 32px; height: 32px; margin-left: auto; display: grid; place-items: center; border: 1px solid rgb(255 255 255 / 40%); border-radius: 50%; transition: background 160ms ease-out; }
.image-link:hover { background: rgb(255 255 255 / 15%); }
.hero-scroll { grid-column: 1 / -1; padding: 17px 0 3px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--line); color: #777b74; font-size: 10px; }
.hero-scroll span { color: var(--accent); font-size: 16px; transition: transform 160ms ease-out; }
.hero-scroll:hover span { transform: translateY(3px); }

.section-pad { padding: 94px 0; }
.services-section { background: var(--soft); }
.section-heading { margin-bottom: 32px; display: flex; justify-content: space-between; align-items: end; gap: 30px; }
.section-heading h2, .promise-copy h2, .marketplace-copy h2 { margin: 14px 0 0; font-size: 40px; line-height: 1.12; letter-spacing: -.055em; }
.section-intro { max-width: 310px; margin: 0 0 4px; color: var(--muted); font-size: 12px; line-height: 1.65; }
.service-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 44px; border-top: 1px solid #dfe1da; }
.service-row { min-width: 0; border-bottom: 1px solid #dfe1da; }
.service-link { min-height: 100px; padding: 18px 2px; display: grid; grid-template-columns: minmax(120px, .85fr) minmax(130px, 1.3fr) auto 19px; gap: 15px; align-items: center; }
.service-name { font-size: 14px; font-weight: 620; letter-spacing: -.02em; transition: color 160ms ease-out; }
.service-description { color: var(--muted); font-size: 10px; line-height: 1.55; }
.service-price { white-space: nowrap; color: #555a52; font-size: 10px; }
.service-arrow { justify-self: end; color: #777d70; font-size: 15px; transition: color 160ms ease-out, transform 160ms ease-out; }
.service-link:hover .service-name, .service-link:hover .service-arrow { color: var(--accent-dark); }
.service-link:hover .service-arrow { transform: translate(2px, -2px); }
.empty-search { padding: 25px 0; color: var(--muted); font-size: 12px; }
.service-bottom { margin-top: 19px; display: flex; justify-content: space-between; align-items: center; color: var(--muted); font-size: 10px; }
.service-bottom p { margin: 0; }
.service-bottom a, .text-link { color: var(--accent-dark); font-size: 11px; font-weight: 600; }
.service-bottom a span, .text-link span { margin-left: 9px; }

.promise-section { background: var(--white); }
.promise-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .9fr); gap: 11%; align-items: center; }
.promise-image { height: 450px; margin: 0; background: var(--soft); }
.promise-image img { width: 100%; height: 100%; object-fit: cover; }
.promise-copy h2 { margin-top: 15px; font-size: 38px; }
.promise-intro { max-width: 440px; margin: 13px 0 23px; color: var(--muted); font-size: 12px; line-height: 1.75; }
.promise-list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
.promise-list li { padding: 15px 0; display: grid; grid-template-columns: 32px 1fr; gap: 8px; border-bottom: 1px solid var(--line); }
.promise-list li > span { padding-top: 1px; color: var(--accent); font-size: 9px; font-weight: 650; }
.promise-list h3 { margin: 0 0 4px; font-size: 12px; font-weight: 620; }
.promise-list p { margin: 0; color: var(--muted); font-size: 10px; line-height: 1.55; }

.marketplace-section { padding-top: 18px; background: var(--white); }
.marketplace-layout { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 10%; align-items: center; border-top: 1px solid var(--line); padding-top: 62px; }
.marketplace-copy h2 { margin-bottom: 12px; }
.marketplace-copy > p:not(.eyebrow) { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.text-link { display: inline-flex; align-items: center; margin-top: 23px; transition: color 160ms ease-out; }
.text-link:hover, .service-bottom a:hover { color: var(--accent); }
.marketplace-image { height: 300px; position: relative; overflow: hidden; background: var(--soft); }
.marketplace-image img { width: 100%; height: 100%; object-fit: cover; transition: transform 400ms cubic-bezier(.2,.7,.2,1); }
.marketplace-image:hover img { transform: scale(1.025); }
.marketplace-image > span { position: absolute; right: 0; bottom: 0; left: 0; min-height: 48px; padding: 0 15px; display: flex; align-items: center; justify-content: space-between; color: var(--white); background: rgb(24 27 23 / 78%); font-size: 10px; }

.final-cta { padding: 67px 0; color: var(--white); background: #242722; }
.cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 28px; }
.cta-inner .eyebrow { color: #c5cabb; }
.cta-inner h2 { margin: 14px 0 0; font-size: 43px; }
.cta-inner h2 em { color: #c9d4aa; }
.cta-inner .button { min-width: 168px; }

.site-footer { padding: 44px 0 18px; color: var(--white); background: #1d201c; }
.footer-main { padding-bottom: 34px; display: grid; grid-template-columns: 2fr 1fr 1.15fr 1fr; gap: 25px; }
.brand-footer { color: var(--white); }
.footer-brand-block p { margin: 11px 0 0; color: #a4a89f; font-size: 10px; }
.footer-column { display: flex; flex-direction: column; align-items: flex-start; gap: 11px; }
.footer-column h2 { margin: 4px 0 3px; font-size: 10px; font-weight: 650; }
.footer-column a { color: #b9bcb6; font-size: 10px; transition: color 160ms ease-out; }
.footer-column a:hover { color: var(--white); }
.footer-bottom { padding-top: 15px; display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid #ffffff21; color: #a4a89f; font-size: 9px; }

@media (max-width: 960px) {
  .main-nav { margin-left: 48px; gap: 23px; }
  .hero { min-height: 560px; column-gap: 38px; }
  .hero-image { height: 390px; }
  .service-list { column-gap: 25px; }
  .service-link { grid-template-columns: minmax(110px, .8fr) minmax(110px, 1.2fr) auto 15px; gap: 10px; }
  .promise-layout { gap: 8%; }
}

@media (max-width: 700px) {
  .wrap { width: calc(100% - 40px); }
  .site-header { height: 66px; }
  .header-inner { width: calc(100% - 40px); }
  .brand { font-size: 21px; }
  .menu-toggle { width: 38px; height: 38px; margin-left: auto; padding: 9px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; border: 0; background: transparent; cursor: pointer; }
  .menu-toggle span { width: 19px; height: 1.5px; background: var(--ink); }
  .main-nav { display: none; position: absolute; top: 65px; right: 0; left: 0; margin: 0; padding: 9px 20px 15px; flex-direction: column; align-items: stretch; gap: 0; border-bottom: 1px solid var(--line); background: var(--white); }
  .main-nav.open { display: flex; }
  .main-nav a { padding: 13px 0; border-bottom: 1px solid var(--line); }
  .main-nav a:last-child { border-bottom: 0; }
  .header-actions { margin-left: 9px; gap: 0; }
  .sign-in { display: none; }
  .button-small { min-height: 35px; padding-inline: 11px; gap: 9px; font-size: 10px; }
  .hero { min-height: auto; padding-top: 46px; grid-template-columns: 1fr; grid-template-rows: auto auto auto; row-gap: 24px; }
  .hero-copy { padding-bottom: 0; }
  .eyebrow { font-size: 9px; }
  .hero h1 { margin: 17px 0 13px; font-size: clamp(43px, 12vw, 58px); }
  .hero-description { max-width: 390px; font-size: 13px; }
  .search-box { min-height: 54px; margin-top: 21px; padding-left: 11px; gap: 6px; }
  .search-box input { font-size: 11px; }
  .search-box .button { min-height: 42px; padding-inline: 10px; gap: 8px; font-size: 10px; }
  .hero-note { margin-top: 11px; font-size: 9px; }
  .hero-image { height: min(76vw, 350px); }
  .hero-scroll { grid-column: 1; padding: 15px 0 3px; }
  .section-pad { padding: 67px 0; }
  .section-heading { display: block; margin-bottom: 24px; }
  .section-heading h2, .promise-copy h2, .marketplace-copy h2 { font-size: 34px; }
  .section-intro { max-width: 360px; margin: 11px 0 0; font-size: 11px; }
  .service-list { grid-template-columns: 1fr; }
  .service-link { min-height: 82px; grid-template-columns: minmax(110px, .8fr) minmax(110px, 1.2fr) auto 16px; gap: 10px; padding: 14px 2px; }
  .service-name { font-size: 12px; }
  .service-description, .service-price { font-size: 9px; }
  .service-arrow { font-size: 13px; }
  .service-bottom { align-items: flex-start; font-size: 9px; }
  .service-bottom a { white-space: nowrap; font-size: 10px; }
  .promise-layout { grid-template-columns: 1fr; gap: 30px; }
  .promise-image { height: 310px; }
  .promise-intro { margin-bottom: 18px; }
  .marketplace-section { padding-top: 5px; }
  .marketplace-layout { grid-template-columns: 1fr; gap: 25px; padding-top: 41px; }
  .marketplace-copy h2 { margin-top: 13px; }
  .marketplace-image { height: 245px; }
  .final-cta { padding: 49px 0; }
  .cta-inner { display: block; }
  .cta-inner h2 { font-size: 38px; }
  .cta-inner .button { margin-top: 22px; }
  .site-footer { padding-top: 35px; }
  .footer-main { grid-template-columns: 1fr 1fr; gap: 27px 18px; padding-bottom: 27px; }
  .footer-brand-block { grid-column: 1 / -1; }
  .footer-bottom { flex-direction: column; font-size: 8px; }
}

@media (max-width: 390px) {
  .wrap, .header-inner { width: calc(100% - 32px); }
  .service-link { grid-template-columns: 1fr auto 15px; gap: 8px; }
  .service-description { grid-column: 1; grid-row: 2; }
  .service-price { grid-column: 2; grid-row: 1 / span 2; }
  .service-arrow { grid-column: 3; grid-row: 1 / span 2; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
}
```
### vite.config.js
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'assets/build',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/main.jsx',
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css') ? 'app.css' : 'assets/[name][extname]',
      },
    },
  },
});
```
### index.html
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f8f8f5" />
    <title>Fixzy — Home services, sorted.</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```
