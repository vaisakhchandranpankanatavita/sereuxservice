import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from './api';

/* Tokens mirror the web app (assets/css/redesign.css): cream surface, ink, tan accent, light only. */
const theme = {
  bg: '#f9f5f2', card: '#ffffff', ink: '#141412', body: '#4a4741', muted: '#6f6b63', line: 'rgba(20,20,18,0.13)',
  brand: '#141412', brandInk: '#f9f5f2', accent: '#b8956a',
  ok: '#2f6b4f', warn: '#9a6a1c', bad: '#a13a2a',
  okBg: '#e4eee7', warnBg: '#f4ead7', badBg: '#f3dfda', infoBg: '#ece4d9', idleBg: '#efe9e2',
};
export type Theme = typeof theme;
export const useTheme = (): Theme => theme;
export const CONTENT_MAX = 1200;
export const R = { sm: 10, md: 18, lg: 24, pill: 999 };
export const font = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', bold: 'Inter_700Bold', heavy: 'Inter_800ExtraBold', display: 'Fraunces_600SemiBold', displayBold: 'Fraunces_700Bold' };

export const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
export const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const when = (d: string) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const dayLabel = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/* Fetch on focus (so lists refresh when you come back), with pull-to-refresh state. */
export function useFetch<T = any>(path: string | null, pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!path) return;
    try { setData(await api(path)); setError(''); } catch (e: any) { setError(e.message); }
  }, [path]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { if (!pollMs) return; const t = setInterval(load, pollMs); return () => clearInterval(t); }, [load, pollMs]);
  const refresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);
  return { data, error, refreshing, refresh, reload: load };
}

export function Screen({ children, refresh, refreshing, pad = true }: { children: ReactNode; refresh?: () => void; refreshing?: boolean; pad?: boolean }) {
  const t = useTheme();
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: pad ? 16 : 0, gap: 12, paddingBottom: 120 }} keyboardShouldPersistTaps="handled"
      refreshControl={refresh ? <RefreshControl refreshing={!!refreshing} onRefresh={refresh} /> : undefined}>
      {/* One shared content width for every screen, so wide browser windows are used consistently. */}
      <View style={{ width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center', gap: 12 }}>{children}</View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

export function Txt({ children, style, muted, bold, size, color, numberOfLines }: { children: ReactNode; style?: any; muted?: boolean; bold?: boolean; size?: number; color?: string; numberOfLines?: number }) {
  const t = useTheme();
  const sz = size ?? 15;
  const big = bold && sz >= 20; // headings: heavy weight, tight tracking, like the web
  return <Text numberOfLines={numberOfLines} style={[{ color: color ?? (muted ? t.muted : t.ink), fontSize: sz, fontFamily: big ? font.heavy : bold ? font.bold : font.regular, letterSpacing: big ? -sz * 0.04 : 0, lineHeight: big ? sz * 1.15 : undefined }, style]}>{children}</Text>;
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: ViewStyle }) {
  const t = useTheme();
  const s = [{ backgroundColor: t.card, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: t.line, padding: 16, gap: 6, shadowColor: '#141412', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 1 }, style];
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [...s, pressed && { opacity: 0.75 }]}>{children}</Pressable> : <View style={s}>{children}</View>;
}

/* Square image tile, full-bleed background with a dark bottom scrim so light text stays readable — no white panel. */
export function Tile({ children, media, onPress }: { children: ReactNode; media: ReactNode; onPress?: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button"
    style={({ pressed }) => [{ aspectRatio: 1, borderRadius: R.md, overflow: 'hidden' }, pressed && { opacity: 0.8 }]}>
    <View style={StyleSheet.absoluteFill}>{media}</View>
    <LinearGradient colors={['rgba(20,19,15,0)', 'rgba(20,19,15,0.18)', 'rgba(20,19,15,0.82)']} locations={[0, 0.45, 1]}
      style={{ flex: 1, justifyContent: 'flex-end', padding: 12, gap: 2 }}>{children}</LinearGradient>
  </Pressable>;
}

/* Pill buttons, uppercase and tracked like the web's .pill / .pill-outline. */
export function Button({ title, onPress, kind = 'primary', busy, disabled, style }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; busy?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const t = useTheme();
  const fg = kind === 'primary' ? t.brandInk : kind === 'danger' ? t.bad : t.ink;
  return <Pressable onPress={onPress} disabled={busy || disabled} accessibilityRole="button" accessibilityState={{ disabled: !!(busy || disabled), busy: !!busy }}
    style={({ pressed }) => [{
      backgroundColor: kind === 'primary' ? (pressed ? t.accent : t.ink) : 'transparent', borderWidth: kind === 'primary' ? 0 : 1.5, borderColor: kind === 'danger' ? t.bad : t.ink,
      borderRadius: R.pill, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1,
    }, style]}>
    {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontFamily: font.bold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>{title}</Text>}
  </Pressable>;
}

export function Field({ label: l, ...p }: TextInputProps & { label: string }) {
  const t = useTheme();
  return <View style={{ gap: 5 }}>
    <Text style={{ color: t.muted, fontSize: 11, fontFamily: font.bold, letterSpacing: 1, textTransform: 'uppercase' }}>{l}</Text>
    <TextInput placeholderTextColor={t.muted} accessibilityLabel={l} {...p}
      style={[{ borderWidth: 1, borderColor: t.line, backgroundColor: t.card, color: t.ink, borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: font.regular }, p.multiline && { minHeight: 80, textAlignVertical: 'top' }]} />
  </View>;
}

export function Chip({ title, on, onPress, disabled }: { title: string; on?: boolean; onPress?: () => void; disabled?: boolean }) {
  const t = useTheme();
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: !!on, disabled: !!disabled }}
    style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.card, opacity: disabled ? 0.4 : 1 }}>
    <Text style={{ color: on ? t.brandInk : t.ink, fontSize: 13, fontFamily: font.medium }}>{title}</Text>
  </Pressable>;
}

export function Chips({ children }: { children: ReactNode }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>{children}</ScrollView>;
}

const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info'> = { DONE: 'ok', DELIVERED: 'ok', CONFIRMED: 'info', SHIPPED: 'info', ON_THE_WAY: 'info', IN_PROGRESS: 'warn', REQUESTED: 'warn', PLACED: 'warn', CANCELLED: 'bad' };
export function Badge({ v }: { v: string }) {
  const t = useTheme();
  const k = TONE[v];
  const [bg, fg] = k === 'ok' ? [t.okBg, t.ok] : k === 'warn' ? [t.warnBg, t.warn] : k === 'bad' ? [t.badBg, t.bad] : k === 'info' ? [t.infoBg, t.ink] : [t.idleBg, t.muted];
  return <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: R.pill, alignSelf: 'flex-start' }}><Text style={{ color: fg, fontSize: 11, fontFamily: font.bold, letterSpacing: 0.6, textTransform: 'uppercase' }}>{label(v)}</Text></View>;
}

/* Initials avatar: deterministic color per name, standing in for a profile photo. */
const AVATAR_COLORS = ['#8fb8d6', '#e0b94a', '#8fd0c9', '#c8a373', '#b494d9', '#8fd6a3', '#9ea3c2', '#b7ab6a'];
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const bg = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#17160f', fontFamily: font.bold, fontSize: size * 0.38 }}>{initials(name)}</Text>
  </View>;
}

export function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', gap: 4 }}>{[1, 2, 3, 4, 5].map((n) =>
    <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} hitSlop={6}>
      <Text style={{ fontSize: onChange ? 30 : 15, color: n <= value ? t.accent : t.line }}>★</Text>
    </Pressable>)}</View>;
}

export function Status({ error, loading, empty }: { error?: string; loading?: boolean; empty?: string }) {
  const t = useTheme();
  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={t.brand} />;
  if (error) return <Txt color={t.bad} style={{ textAlign: 'center', marginTop: 20 }}>{error}</Txt>;
  if (empty) return <Txt muted style={{ textAlign: 'center', marginTop: 30 }}>{empty}</Txt>;
  return null;
}

export const Row = ({ children, between }: { children: ReactNode; between?: boolean }) =>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: between ? 'space-between' : undefined }}>{children}</View>;

/* "fixzy." wordmark: heavy, tight tracking, tan period (web .brand + .dot). */
export function Wordmark({ size = 34 }: { size?: number }) {
  const t = useTheme();
  return <Text style={{ fontFamily: font.heavy, fontSize: size, letterSpacing: -size * 0.06, color: t.ink }}>fixzy<Text style={{ color: t.accent }}>.</Text></Text>;
}
export function Eyebrow({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, fontSize: 11, fontFamily: font.bold, letterSpacing: 1.6, textTransform: 'uppercase' }}>{children}</Text>;
}

/* Online status shared between screens and the topbar (tiny store, no extra dependency). */
let onlineNow: boolean | null = null;
const onlineSubs = new Set<(v: boolean | null) => void>();
export const setOnlineFlag = (v: boolean | null) => { onlineNow = v; onlineSubs.forEach((f) => f(v)); };
export function useOnlineFlag() {
  const [v, setV] = useState(onlineNow);
  useEffect(() => { onlineSubs.add(setV); setV(onlineNow); return () => { onlineSubs.delete(setV); }; }, []);
  return v;
}

/* Live dot: two staggered rings radiate outward on a loop, and the core breathes, so "online" reads at a glance. */
export function PulseDot({ on, size = 10, color, ringColor }: { on: boolean; size?: number; color?: string; ringColor?: string }) {
  const t = useTheme();
  const k = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) { k.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(k, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [on, k]);
  const c = color ?? (on ? t.ok : t.muted), rc = ringColor ?? c;
  const ring = (delay: number) => {
    const phase: Animated.Value = (delay ? Animated.modulo(Animated.add(k, 0.5), 1) : k) as any;
    return { position: 'absolute' as const, width: size, height: size, borderRadius: size, backgroundColor: rc,
      opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
      transform: [{ scale: phase.interpolate({ inputRange: [0, 1], outputRange: [1, 3.4] }) }] };
  };
  const core = { width: size, height: size, borderRadius: size, backgroundColor: c, transform: [{ scale: k.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 1] }) }] };
  return <View style={{ width: size * 3.4, height: size * 3.4, alignItems: 'center', justifyContent: 'center' }}>
    {on && <Animated.View style={ring(0)} />}
    {on && <Animated.View style={ring(1)} />}
    <Animated.View style={on ? core : { width: size, height: size, borderRadius: size, backgroundColor: c }} />
  </View>;
}

/* Minimal switch: a small rounded track, a white knob that slides, and a quiet text label beside it. */
export function OnlineSwitch({ on, onToggle, busy }: { on: boolean; onToggle: () => void; busy?: boolean }) {
  const t = useTheme();
  const k = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => { Animated.timing(k, { toValue: on ? 1 : 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [on, k]);
  return <Pressable onPress={onToggle} disabled={busy} accessibilityRole="switch" accessibilityState={{ checked: on, busy: !!busy }} accessibilityLabel={on ? 'Go offline' : 'Go online'}
    hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: busy ? 0.6 : 1 }}>
    <Text style={{ color: on ? t.ok : t.muted, fontFamily: font.medium, fontSize: 13 }}>{on ? 'Online' : 'Offline'}</Text>
    <Animated.View style={{ width: 44, height: 26, borderRadius: 13, justifyContent: 'center', backgroundColor: k.interpolate({ inputRange: [0, 1], outputRange: ['#d9d4cc', t.ok] }) }}>
      <Animated.View style={{ position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#141412', shadowOpacity: 0.18, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, left: k.interpolate({ inputRange: [0, 1], outputRange: [3, 21] }) }} />
    </Animated.View>
  </Pressable>;
}

/* Money is always highlighted: a tan marker behind bold figures, so amounts stand out wherever they appear. */
export function Money({ amount, size = 16, dark, style }: { amount: number; size?: number; dark?: boolean; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ alignSelf: 'flex-start', backgroundColor: dark ? 'rgba(184,149,106,0.35)' : 'rgba(184,149,106,0.24)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }, style]}>
    <Text style={{ color: dark ? t.brandInk : t.ink, fontFamily: font.heavy, fontSize: size, letterSpacing: -size * 0.02, fontVariant: ['tabular-nums'] }}>{money(amount)}</Text>
  </View>;
}
