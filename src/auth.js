import { actions, getState, setState } from './store.js';

/* Mock auth for the front-end demo: accounts live in this browser's localStorage only.
   Passwords are hashed (not stored in plain text), but this is NOT real security; replace with a server API. */

const hash = async (email, password) => {
  const data = new TextEncoder().encode(`${email.toLowerCase()}:${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

const publicUser = ({ name, email, phone }) => ({ name, email, phone });

export async function register({ name, email, phone, password }) {
  const key = email.trim().toLowerCase();
  if (getState().users.some((u) => u.email === key)) return 'An account with this email already exists.';
  const user = { name: name.trim(), email: key, phone: phone.trim(), pw: await hash(key, password) };
  setState((s) => ({ users: [...s.users, user], user: publicUser(user) }));
  return null;
}

export async function login({ email, password }) {
  const key = email.trim().toLowerCase();
  const found = getState().users.find((u) => u.email === key);
  if (!found || found.pw !== await hash(key, password)) return 'Email or password is incorrect.';
  actions.signIn(publicUser(found));
  return null;
}

export async function resetPassword({ email, password }) {
  const key = email.trim().toLowerCase();
  if (!getState().users.some((u) => u.email === key)) return false;
  const pw = await hash(key, password);
  setState((s) => ({ users: s.users.map((u) => (u.email === key ? { ...u, pw } : u)) }));
  return true;
}

export const passwordStrength = (pw) => {
  let n = 0;
  if (pw.length >= 8) n++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) n++;
  if (/\d/.test(pw)) n++;
  if (/[^A-Za-z0-9]/.test(pw)) n++;
  return n; // 0-4
};

/* Only same-site pages from this whitelist are valid redirect targets (no open redirect). */
const REDIRECTS = ['orders', 'dashboard', 'checkout', 'service-request', 'shop', 'services'];
export function redirectTarget(fallback = '/dashboard.php') {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('redirect');
  if (!REDIRECTS.includes(slug)) return fallback;
  const sid = params.get('service_id');
  return `/${slug}.php${slug === 'service-request' && /^\d+$/.test(sid || '') ? `?service_id=${sid}` : ''}`;
}

/* Send signed-out visitors to login, remembering where they were headed. */
export function loginUrl(slug, extra = '') {
  return `/login.php?redirect=${slug}${extra}`;
}
