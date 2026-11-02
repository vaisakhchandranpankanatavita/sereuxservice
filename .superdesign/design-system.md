# Fixzy Design System

## Product context
Fixzy is a home-services booking site (India, prices in ₹): users search/browse 8 services (AC repair, Appliance repair, Carpentry, Home cleaning, Electrical work, Painting, Pest control, Plumbing), see "From ₹X" starting prices, and continue to sign in / book. Also a product marketplace (/shop.php). Single landing page: header, hero with live search, services list, "why Fixzy" 3-step promise, marketplace teaser, final CTA, footer. Voice: warm, calm, plain-spoken ("Good help for the place you love.").

## Hard functional constraints (never change)
- Header nav: Services (#services anchor), Marketplace, My bookings; Sign in; "Create an account" button; hamburger menu on mobile.
- Hero search form filters the 8 services live; an empty-state message shows when nothing matches.
- Every service links to a booking URL; keep all 8 services, descriptions and prices exactly: Plumbing ₹500, Electrical work ₹600, AC repair ₹800, Carpentry ₹700, Painting ₹1,000, Home cleaning ₹400, Appliance repair ₹550, Pest control ₹450.
- Keep all existing copy meaning, footer columns and links.

## Brand & color (sage/forest family, evolved richer)
- Brand wordmark: "fixzy" in Inter bold, tight tracking, with an accent-colored period.
- Primary accent sage green #66734b; dark #4d5a36; deep forest #1d201c / #242722 for dark sections; ink #20231f; muted #737770.
- Neutrals: warm off-white #f8f8f5, soft #f5f5f2, line #e5e6e1.
- Highlight tints allowed for decoration only: pale sage #c9d4aa, light sage #e8ecdc. Use the sage family as the single hue; no purple/pink/neon.

## Typography
Inter (400-700) for everything; Georgia/serif italic-style for the emphasized word (<em>) inside large headings. Tight negative letter-spacing on headings, small eyebrow labels with wide tracking.

## Shape, spacing, depth
4px-radius buttons (may soften to pill/rounded for cards), 1px hairline borders, generous section padding (~94px desktop), 1160px content width. Soft, low-opacity shadows only.

## Imagery & icons
Warm, natural-light photography of home professionals and calm interiors (Unsplash). Icons: clean 1.5px-stroke line icons (Lucide-style inline SVG), one per service, sage-colored in soft rounded tiles.

## Motion patterns
Subtle and purposeful: 160-400ms ease-out hovers and lifts, staggered fade/slide-up reveals on scroll, gentle floating accents, animated arrow nudges, marquee/count-up allowed. Always respect prefers-reduced-motion.
