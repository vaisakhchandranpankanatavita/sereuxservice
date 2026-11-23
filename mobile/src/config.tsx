import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { API } from './api';
import { font, useTheme } from './ui';

const APP: 'customer' | 'pro' = 'customer';
const CACHE_KEY = 'fixzy_config_customer';

/* Must mirror the server registry defaults (backend/src/config/config.module.ts): used until the host answers, and offline. */
export const DEFAULTS: Record<string, any> = {
  'content.faq': [
    { q: 'How do I reschedule a booking?', a: 'Open the booking from Activity and choose a new day and slot. You can move it until the pro is confirmed.' },
    { q: 'When do I pay for a service?', a: 'You see the price before you book. Pay once the job is done, using the method you picked at checkout.' },
    { q: 'Can I cancel an order or booking?', a: 'Bookings can be cancelled from their page while still open. Shop orders can be cancelled before they ship.' },
    { q: 'How are pros verified?', a: 'Every pro is identity-checked and reviewed before they can take jobs. Ratings from past customers are shown on each service.' },
  ],
  'rules.maxDaysAhead': 60,
  'content.supportEmail': '',
  'content.supportPhone': '',
  'content.termsUrl': '',
  'content.privacyUrl': '',
  'content.customer.welcomeTitle': '',
  'rules.dispatchRadiusKm': 0,
  'rules.minPayout': 0,
  'rules.kycRequired': true,
  'flags.maintenanceMode': false,
  'flags.maintenanceMessage': '',
  'flags.minAppVersion.customer': '',
  'flags.minAppVersion.pro': '',
  'flags.shopEnabled': true,
  'flags.chatEnabled': true,
  'regions.cities': [],
};

const store = {
  get: async (): Promise<string | null> => { try { return Platform.OS === 'web' ? localStorage.getItem(CACHE_KEY) : await SecureStore.getItemAsync(CACHE_KEY); } catch { return null; } },
  set: async (v: string) => { try { if (Platform.OS === 'web') localStorage.setItem(CACHE_KEY, v); else await SecureStore.setItemAsync(CACHE_KEY, v); } catch { /* cache is best-effort */ } },
};

async function fetchConfig(ms: number): Promise<Record<string, any> | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(`${API}/config`, { signal: ctl.signal, headers: { 'x-client': 'mobile' } });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.settings && typeof body.settings === 'object' ? body.settings : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

/* 1.2.10 >= 1.2.9; blank minimum means no requirement. */
const atLeast = (have: string, min: string) => {
  const a = String(have).split('.').map((n) => parseInt(n, 10) || 0);
  const b = String(min).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? 0) - (b[i] ?? 0); if (d) return d > 0; }
  return true;
};

type Ctx = { get: <T = any>(key: string) => T; ready: boolean };
const ConfigCtx = createContext<Ctx>({ get: (k) => DEFAULTS[k], ready: false });
export const useConfig = () => useContext(ConfigCtx);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, any>>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    const adopt = (s: Record<string, any>) => setSettings({ ...DEFAULTS, ...s });
    (async () => {
      const raw = await store.get();
      let cached: Record<string, any> | null = null;
      try { cached = raw ? JSON.parse(raw) : null; } catch { cached = null; }
      if (cached && live) { adopt(cached); setReady(true); }
      /* No cache yet: give the host a short window so the first launch already has live settings. */
      const fresh = await fetchConfig(cached ? 6000 : 2500);
      if (!live) return;
      if (fresh) { adopt(fresh); store.set(JSON.stringify(fresh)); }
      else if (!cached) adopt({});
      setReady(true);
    })();
    return () => { live = false; };
  }, []);

  const value = useMemo<Ctx>(() => ({ get: (k) => (settings[k] ?? DEFAULTS[k]) as any, ready }), [settings, ready]);
  return <ConfigCtx.Provider value={value}>{children}</ConfigCtx.Provider>;
}

/* Full-screen stop for maintenance mode or a too-old app build; otherwise renders the app. */
export function ConfigGate({ children }: { children: ReactNode }) {
  const { get } = useConfig();
  const t = useTheme();
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const min = String(get(`flags.minAppVersion.${APP}`) || '');
  const maintenance = !!get('flags.maintenanceMode');
  const outdated = !!min && !atLeast(version, min);
  if (!maintenance && !outdated) return <>{children}</>;
  const title = maintenance ? 'We’ll be right back' : 'Update required';
  const text = maintenance
    ? String(get('flags.maintenanceMessage') || 'Fixzy is down for a quick bit of maintenance. Please try again shortly.')
    : `This version of the app (${version}) is no longer supported. Please update to version ${min} or newer to continue.`;
  return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }} accessibilityRole="alert">
    <Text style={{ color: t.ink, fontFamily: font.heavy, fontSize: 26, letterSpacing: -0.6, textAlign: 'center' }}>{title}</Text>
    <Text style={{ color: t.body, fontFamily: font.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, maxWidth: 340 }}>{text}</Text>
  </View>;
}
