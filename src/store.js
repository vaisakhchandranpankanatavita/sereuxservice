import { useSyncExternalStore } from 'react';

/* Tiny persisted store acting as a mock backend; swap the load/save pair for an API later. */
const KEY = 'fixzy:v1';
const empty = { user: null, users: [], reviews: [], notifications: [], messages: [], cart: [], bookings: [], wishlist: [], recent: [] };

const load = () => {
  try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...empty }; }
};
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } };

let state = load();

const STATUS_TEXT = { confirmed: 'Your booking is confirmed.', on_the_way: 'Your pro is on the way.', in_progress: 'Work has started.', done: 'Your job is complete. How did it go?', cancelled: 'Your booking was cancelled.' };
const note = (owner, text, href) => ({ id: Math.random().toString(36).slice(2), owner, text, href, at: Date.now(), read: false });
const listeners = new Set();

export const getState = () => state;
export const setState = (patch) => {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  save(state);
  listeners.forEach((l) => l());
};
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

window.addEventListener('storage', (e) => {
  if (e.key === KEY) { state = load(); listeners.forEach((l) => l()); }
});

export const useStore = (select = (s) => s) => useSyncExternalStore(subscribe, () => select(state));

export const actions = {
  addToCart: (id, qty = 1) => setState((s) => {
    const hit = s.cart.find((i) => i.id === id);
    return { cart: hit ? s.cart.map((i) => (i.id === id ? { ...i, qty: i.qty + qty } : i)) : [...s.cart, { id, qty }] };
  }),
  setQty: (id, qty) => setState((s) => ({ cart: qty < 1 ? s.cart.filter((i) => i.id !== id) : s.cart.map((i) => (i.id === id ? { ...i, qty } : i)) })),
  removeFromCart: (id) => setState((s) => ({ cart: s.cart.filter((i) => i.id !== id) })),
  clearCart: () => setState({ cart: [] }),
  toggleWishlist: (id) => setState((s) => ({ wishlist: s.wishlist.includes(id) ? s.wishlist.filter((x) => x !== id) : [...s.wishlist, id] })),
  addRecent: (q) => setState((s) => ({ recent: [q, ...s.recent.filter((x) => x !== q)].slice(0, 5) })),
  addBooking: (b) => setState((s) => {
    const id = 'FX' + Date.now().toString(36).toUpperCase();
    return {
      bookings: [{ id, status: 'requested', createdAt: Date.now(), ...b }, ...s.bookings],
      notifications: [note(b.owner, `Booking #${id} received. We'll confirm shortly.`, '/orders.php'), ...s.notifications],
    };
  }),
  updateBooking: (id, patch) => setState((s) => {
    const old = s.bookings.find((b) => b.id === id);
    const text = patch.status && old && patch.status !== old.status && STATUS_TEXT[patch.status];
    return {
      bookings: s.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      notifications: text ? [note(old.owner, `#${id}: ${text}`, '/orders.php'), ...s.notifications] : s.notifications,
    };
  }),
  addReview: (r) => setState((s) => ({ reviews: [{ id: Math.random().toString(36).slice(2), at: Date.now(), ...r }, ...s.reviews] })),
  markAllRead: (owner) => setState((s) => ({ notifications: s.notifications.map((n) => (n.owner === owner ? { ...n, read: true } : n)) })),
  addMessage: (m) => setState((s) => ({ messages: [{ at: Date.now(), ...m }, ...s.messages] })),
  signIn: (user) => setState({ user }),
  signOut: () => setState({ user: null }),
};
