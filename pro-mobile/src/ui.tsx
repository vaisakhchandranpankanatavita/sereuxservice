import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from './api';

/* Design tokens: tinted zinc neutrals (never pure black/white), one cobalt accent reserved for primary actions and active states.
   Semantic colours are soft tinted fills with a crisp 1px border and a dark, saturated label. */
const theme = {
  bg: '#FAFAFA', card: '#FFFFFF', surface: '#F4F4F5', ink: '#09090B', body: '#3F3F46', muted: '#71717A', line: '#E4E4E7', lineStrong: '#D4D4D8',
  brand: '#2563EB', brandInk: '#FAFAFA', accent: '#2563EB', accentHover: '#1D4ED8', accentBg: 'rgba(37,99,235,0.08)', accentLine: 'rgba(37,99,235,0.22)',
  ok: '#047857', warn: '#B45309', bad: '#B91C1C', info: '#1D4ED8',
  okBg: 'rgba(16,185,129,0.10)', warnBg: 'rgba(245,158,11,0.12)', badBg: 'rgba(239,68,68,0.08)', infoBg: 'rgba(37,99,235,0.08)', idleBg: '#F4F4F5',
  okLine: 'rgba(16,185,129,0.28)', warnLine: 'rgba(245,158,11,0.32)', badLine: 'rgba(239,68,68,0.26)', infoLine: 'rgba(37,99,235,0.22)', idleLine: '#E4E4E7',
  star: '#D97706', ring: 'rgba(37,99,235,0.35)',
};
export type Theme = typeof theme;
export const useTheme = (): Theme => theme;
export const CONTENT_MAX = 1200;
export const R = { sm: 12, md: 16, lg: 20, pill: 999 };
/* Inter for UI copy; JetBrains Mono (tabular) for every number, time, date and id. `display*` keep their old names but are now Inter. */
export const font = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold', heavy: 'Inter_600SemiBold', display: 'Inter_600SemiBold', displayBold: 'Inter_600SemiBold', mono: 'JetBrainsMono_500Medium', monoRegular: 'JetBrainsMono_400Regular' };
export const mono = (size: number, extra: object = {}) => ({ fontFamily: font.mono, fontSize: size, fontVariant: ['tabular-nums' as const], ...extra });
/* Section overline / table-header style: 11px, uppercase, wide tracking, muted. */
export const overline = { fontFamily: font.semibold, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase' as const };

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
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: pad ? 16 : 0, gap: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled"
      refreshControl={refresh ? <RefreshControl refreshing={!!refreshing} onRefresh={refresh} /> : undefined}>
      {/* One shared content width for every screen, so wide browser windows are used consistently. */}
      <View style={{ width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center', gap: 16 }}>{children}</View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

export function Txt({ children, style, muted, bold, size, color, numberOfLines }: { children: ReactNode; style?: any; muted?: boolean; bold?: boolean; size?: number; color?: string; numberOfLines?: number }) {
  const t = useTheme();
  const sz = size ?? 15;
  const big = bold && sz >= 20; // headings: semibold with tight tracking (-0.02em)
  return <Text numberOfLines={numberOfLines} style={[{ color: color ?? (muted ? t.muted : t.ink), fontSize: sz, fontFamily: big ? font.semibold : bold ? font.semibold : font.regular, letterSpacing: big ? -sz * 0.02 : 0, lineHeight: big ? sz * 1.2 : undefined }, style]}>{children}</Text>;
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: ViewStyle }) {
  const t = useTheme();
  /* Crisp 1px border, no drop shadow; pressable cards shift their border on hover and dim slightly on press. */
  const s = [{ backgroundColor: t.card, borderRadius: R.md, borderWidth: 1, borderColor: t.line, padding: 18, gap: 10 }, style];
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" style={(st: any) => [...s, st.hovered && { borderColor: t.lineStrong, backgroundColor: t.bg }, st.pressed && { opacity: 0.8 }]}>{children}</Pressable> : <View style={s}>{children}</View>;
}

/* Square image tile, full-bleed background with a dark bottom scrim so light text stays readable — no white panel. */
export function Tile({ children, media, onPress }: { children: ReactNode; media: ReactNode; onPress?: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button"
    style={({ pressed }) => [{ aspectRatio: 1, borderRadius: R.md, overflow: 'hidden' }, pressed && { opacity: 0.8 }]}>
    <View style={StyleSheet.absoluteFill}>{media}</View>
    <LinearGradient colors={['rgba(9,9,11,0)', 'rgba(9,9,11,0.16)', 'rgba(9,9,11,0.78)']} locations={[0, 0.45, 1]}
      style={{ flex: 1, justifyContent: 'flex-end', padding: 12, gap: 2 }}>{children}</LinearGradient>
  </Pressable>;
}

/* Buttons: 52px tall (48dp+ touch target), 14px radius. Primary is solid ink to match the sign-in screens; ghost is a bordered surface; danger is a tinted outline. */
export function Button({ title, onPress, kind = 'primary', size = 'md', busy, disabled, style }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; size?: 'md' | 'sm'; busy?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const t = useTheme();
  const fg = kind === 'primary' ? '#FFFFFF' : kind === 'danger' ? t.bad : t.ink;
  return <Pressable onPress={onPress} disabled={busy || disabled} accessibilityRole="button" accessibilityState={{ disabled: !!(busy || disabled), busy: !!busy }}
    style={(st: any) => [{
      height: size === 'sm' ? 46 : 52, backgroundColor: kind === 'primary' ? (st.pressed || st.hovered ? '#27272A' : t.ink) : kind === 'danger' ? (st.pressed ? 'rgba(239,68,68,0.14)' : t.badBg) : st.hovered || st.pressed ? t.surface : t.card,
      borderWidth: kind === 'primary' ? 0 : 1, borderColor: kind === 'danger' ? t.badLine : t.line,
      borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1, transform: [{ scale: st.pressed ? 0.98 : 1 }],
    }, style]}>
    {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontFamily: font.semibold, fontSize: 15 }}>{title}</Text>}
  </Pressable>;
}

/* Filled field matching the sign-in screens: label above, no border until focus, 52px control, 16px text. */
export function Field({ label: l, ...p }: TextInputProps & { label: string }) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  return <View style={{ gap: 8 }}>
    <Text style={{ color: t.muted, fontFamily: font.medium, fontSize: 14 }}>{l}</Text>
    <TextInput placeholderTextColor={t.muted} accessibilityLabel={l} {...p}
      onFocus={(e) => { setFocus(true); p.onFocus?.(e); }} onBlur={(e) => { setFocus(false); p.onBlur?.(e); }}
      style={[{ minHeight: 52, borderWidth: 1.5, borderColor: focus ? t.accent : 'transparent', backgroundColor: t.surface, color: t.ink, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, fontFamily: font.regular }, p.multiline && { minHeight: 100, textAlignVertical: 'top' }, p.style, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]} />
  </View>;
}

/* Page heading used by every tab: big tight title, optional one-line subtitle, optional control on the right. */
export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingTop: 8 }}>
    <View style={{ flex: 1, gap: 4 }}>
      <Text accessibilityRole="header" style={{ color: t.ink, fontFamily: font.semibold, fontSize: 32, letterSpacing: -1, lineHeight: 36 }}>{title}</Text>
      {sub ? <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 15, lineHeight: 21 }}>{sub}</Text> : null}
    </View>
    {right}
  </View>;
}

export function Chip({ title, on, onPress, disabled }: { title: string; on?: boolean; onPress?: () => void; disabled?: boolean }) {
  const t = useTheme();
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: !!on, disabled: !!disabled }}
    style={(st: any) => ({ height: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: R.pill, borderWidth: 1, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : st.hovered || st.pressed ? t.surface : t.card, opacity: disabled ? 0.4 : 1 })}>
    <Text style={{ color: on ? '#FFFFFF' : t.body, fontSize: 14, fontFamily: font.medium }}>{title}</Text>
  </Pressable>;
}

export function Chips({ children }: { children: ReactNode }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>{children}</ScrollView>;
}

const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info'> = { DONE: 'ok', DELIVERED: 'ok', CONFIRMED: 'info', SHIPPED: 'info', ON_THE_WAY: 'info', IN_PROGRESS: 'warn', REQUESTED: 'warn', PLACED: 'warn', CANCELLED: 'bad' };
/* Status pill: soft tinted fill, crisp 1px border, saturated label. */
export const tone = (t: Theme, k?: string) => k === 'ok' ? { bg: t.okBg, fg: t.ok, bd: t.okLine } : k === 'warn' ? { bg: t.warnBg, fg: t.warn, bd: t.warnLine } : k === 'bad' ? { bg: t.badBg, fg: t.bad, bd: t.badLine } : k === 'info' ? { bg: t.infoBg, fg: t.info, bd: t.infoLine } : { bg: t.idleBg, fg: t.muted, bd: t.idleLine };
export function Badge({ v }: { v: string }) {
  const t = useTheme();
  const c = tone(t, TONE[v]);
  return <View style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.bd, paddingHorizontal: 8, height: 22, justifyContent: 'center', borderRadius: R.pill, alignSelf: 'flex-start' }}><Text style={{ color: c.fg, fontSize: 11, fontFamily: font.semibold, letterSpacing: 0.2 }}>{label(v)}</Text></View>;
}

/* Initials avatar: deterministic color per name, standing in for a profile photo. */
const AVATAR_COLORS = ['#E4E4E7', '#E0E7FF', '#DCFCE7', '#FEF3C7', '#FCE7F3', '#E0F2FE', '#F1F5F9', '#EDE9FE'];
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const bg = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderWidth: 1, borderColor: 'rgba(9,9,11,0.08)', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#27272A', fontFamily: font.semibold, fontSize: size * 0.38 }}>{initials(name)}</Text>
  </View>;
}

export function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', gap: 4 }}>{[1, 2, 3, 4, 5].map((n) =>
    <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} hitSlop={6}>
      <Text style={{ fontSize: onChange ? 30 : 15, color: n <= value ? t.star : t.lineStrong }}>★</Text>
    </Pressable>)}</View>;
}

export function Status({ error, loading, empty }: { error?: string; loading?: boolean; empty?: string }) {
  const t = useTheme();
  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={t.accent} />;
  if (error) return <Txt color={t.bad} style={{ textAlign: 'center', marginTop: 20 }}>{error}</Txt>;
  if (empty) return <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: t.lineStrong, borderRadius: R.md, paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center', marginTop: 8 }}>
    <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 360 }}>{empty}</Text>
  </View>;
  return null;
}

export const Row = ({ children, between }: { children: ReactNode; between?: boolean }) =>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: between ? 'space-between' : undefined }}>{children}</View>;

/* "fixzy." wordmark: heavy, tight tracking, tan period (web .brand + .dot). */
export function Wordmark({ size = 34 }: { size?: number }) {
  const t = useTheme();
  return <Text style={{ fontFamily: font.semibold, fontSize: size, letterSpacing: -size * 0.045, color: t.ink }}>fixzy<Text style={{ color: t.accent }}>.</Text></Text>;
}
export function Eyebrow({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[overline, { color: t.muted }]}>{children}</Text>;
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
    <Animated.View style={{ width: 44, height: 26, borderRadius: 13, justifyContent: 'center', backgroundColor: k.interpolate({ inputRange: [0, 1], outputRange: ['#D4D4D8', t.ok] }) }}>
      <Animated.View style={{ position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', shadowColor: '#09090B', shadowOpacity: 0.16, shadowRadius: 1.5, shadowOffset: { width: 0, height: 1 }, left: k.interpolate({ inputRange: [0, 1], outputRange: [3, 21] }) }} />
    </Animated.View>
  </Pressable>;
}

/* Money: mono, tabular, no marker. `dark` flips the colour for use on dark surfaces. */
export function Money({ amount, size = 16, dark, style }: { amount: number; size?: number; dark?: boolean; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ alignSelf: 'flex-start' }, style]}>
    <Text style={[mono(size, { color: dark ? t.brandInk : t.ink, letterSpacing: -size * 0.03 })]}>{money(amount)}</Text>
  </View>;
}
