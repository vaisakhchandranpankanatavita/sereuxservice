# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Field service providers ("pros": technicians and tradespeople) who work for the Fixzy home-services marketplace. Confirmed: they use the app mainly on Android phones, in the field, often outdoors or between jobs. Accounts are created by the Fixzy admin team; there is no self sign-up. Desktop web is only a testing surface.

## Product Purpose

Fixzy Pro is the provider-side app of Fixzy. A pro goes online, sees nearby job requests (nearest first), accepts jobs, travels, starts and finishes work with the customer's start/completion code and proof photos, chats with the customer, and tracks earnings and payouts. The login screen's job is to get a verified pro into their jobs quickly and reliably.

## Positioning

From the repository (not yet confirmed with the user): jobs are dispatched nearest-first to online pros, work is gated by identity verification (KYC), and start/finish are proven with a customer code plus photos.

## Operating Context

- Sign-in happens on a phone, one-handed, outdoors, in bright light, possibly on poor signal.
- Sessions persist via a stored refresh token, so sign-in is infrequent after the first time.
- Auth flows available: sign in with email and password, reset password. No sign-up.

## Capabilities and Constraints

- React Native (Expo) app, shared with a web preview on `localhost:8090`; the screen lives in `pro-mobile/app/(auth)/login.tsx`.
- Release builds start with an empty form; in dev the form is prefilled with the seeded demo pro (`__DEV__` only).
- The login page must keep: email + password fields, show/hide password, inline validation, an error banner, a "Reset your password" link, and the note that this app is for providers only (customers use the Fixzy customer app).

## Brand Commitments

- Keep the Fixzy geometric "f" wordmark and the "PRO" tag (confirmed by the user).
- Keep the dev-only demo prefill (confirmed by the user).

## Evidence on Hand

Real product flows exist in code (jobs, KYC, OTP/photo proof, earnings, chat). No customer testimonials, ratings, or statistics have been provided; none may be invented for the login page.

## Product Principles

1. Built for one-handed use in the field: large targets, thumb reach, legible in bright light.
2. Fast and forgiving: get a returning pro into their jobs with the fewest steps and clear, calm errors.
3. Trustworthy: this is where pros enter their work account, so it should feel secure and professional, not playful.
4. Honest: no invented claims or figures.

## Accessibility & Inclusion

Not specified beyond mobile best practice (contrast in sunlight, 44px+ targets, screen-reader labels, readable on small and large phones). To be refined if the user states a standard.
