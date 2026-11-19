import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { api } from './api';
import { PulseDot, font, useOnlineFlag } from './ui';

/* Tiny persistent store: when the pro went online survives reloads (localStorage on web, SecureStore on device). */
const KEY = 'fixzy_pro_online_since';
const kv = {
  get: async () => (Platform.OS === 'web' ? localStorage.getItem(KEY) : SecureStore.getItemAsync(KEY)),
  set: async (v: string) => { if (Platform.OS === 'web') localStorage.setItem(KEY, v); else await SecureStore.setItemAsync(KEY, v); },
  del: async () => { if (Platform.OS === 'web') localStorage.removeItem(KEY); else await SecureStore.deleteItemAsync(KEY); },
};

/* Lets screens ask the timer to re-check jobs right after a status change (Start trip, Mark complete…). */
const subs = new Set<() => void>();
export const pingLive = () => subs.forEach((f) => f());

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
const mono = { fontFamily: font.mono, fontVariant: ['tabular-nums' as const], letterSpacing: 0 };

/* Always-on floating timer, kept minimal: a small translucent pill with time online and the running trip / job time. */
export function LiveTimer() {
  const router = useRouter();
  const online = useOnlineFlag();
  const [since, setSince] = useState<number | null>(null);
  const [job, setJob] = useState<any | null>(null);
  const [now, setNow] = useState(Date.now());
  const [closedFor, setClosedFor] = useState<string | null>(null);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      if (online === null) return;
      if (!online) { await kv.del(); if (live) setSince(null); return; }
      const saved = Number(await kv.get());
      const start = saved > 0 ? saved : Date.now();
      if (!(saved > 0)) await kv.set(String(start));
      if (live) setSince(start);
    })().catch(() => {});
    return () => { live = false; };
  }, [online]);

  const loadJob = useCallback(async () => {
    try {
      const list: any[] = await api('/pro/jobs');
      const cur = list.filter((j) => j.status === 'ON_THE_WAY' || j.status === 'IN_PROGRESS')
        .sort((a, b) => (b.status === 'IN_PROGRESS' ? 1 : 0) - (a.status === 'IN_PROGRESS' ? 1 : 0))[0];
      setJob(cur ?? null);
    } catch { /* keep last value */ }
  }, []);
  useEffect(() => { loadJob(); const i = setInterval(loadJob, 15000); subs.add(loadJob); return () => { clearInterval(i); subs.delete(loadJob); }; }, [loadJob]);

  /* Closing hides it until something changes (going online/offline, or a job moving to a new step). */
  const state = `${online ? 'on' : 'off'}:${job ? job.id + job.status : '-'}`;
  if ((!online && !job) || closedFor === state) return null;
  const trip = job?.status === 'ON_THE_WAY';

  const item = (label: string, value: string, dot?: boolean) => <View style={{ gap: 1 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {dot && <PulseDot on size={4} color="#34D399" />}
      <Text style={{ color: '#A1A1AA', fontFamily: font.medium, fontSize: 11 }}>{label}</Text>
    </View>
    <Text style={[mono, { color: '#FAFAFA', fontSize: 16 }]}>{value}</Text>
  </View>;

  return <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 96, alignItems: 'center', zIndex: 50 }}>
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#18181B', borderRadius: 12, paddingVertical: 8, paddingLeft: 16, paddingRight: 8, borderWidth: 1, borderColor: '#27272A' }]}>
      <Pressable disabled={!job} onPress={() => job && router.push(`/job/${job.id}`)} accessibilityRole="button" accessibilityLabel="Live timers" style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        {online && since != null && item('Online', clock(now - since), true)}
        {online && since != null && job && <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: '#27272A' }} />}
        {job && item(trip ? 'On the way' : 'Working', clock(now - new Date(job.updatedAt).getTime()))}
      </Pressable>
      <Pressable onPress={() => setClosedFor(state)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Hide timer" style={{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#27272A' }}>
        <Ionicons name="close" size={16} color="#FAFAFA" />
      </Pressable>
    </View>
  </View>;
}
