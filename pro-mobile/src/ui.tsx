import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, KeyboardAvoidingView, PanResponder, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from './api';
import { onBarScroll, showBar } from './barscroll';

/* Design tokens: tinted zinc neutrals (never pure black/white), one cobalt accent reserved for primary actions and active states.
   Semantic colours are soft tinted fills with a crisp 1px border and a dark, saturated label. */
const theme = {
  bg: '#FFFFFF', card: '#F3F4FB', surface: '#ECEEF8', ink: '#141B34', body: '#434A63', muted: '#7A819B', line: 'rgba(20,27,52,0.08)', lineStrong: 'rgba(20,27,52,0.16)',
  peri: '#C8CBFF', sky: '#BFD8FF', plum: '#E3C9F5', mint: '#C9EFD9',
  brand: '#2563EB', brandInk: '#FAFAFA', accent: '#2563EB', accentHover: '#1D4ED8', accentBg: 'rgba(37,99,235,0.08)', accentLine: 'rgba(37,99,235,0.22)',
  ok: '#047857', warn: '#B45309', bad: '#B91C1C', info: '#1D4ED8',
  okBg: 'rgba(16,185,129,0.10)', warnBg: 'rgba(245,158,11,0.12)', badBg: 'rgba(239,68,68,0.08)', infoBg: 'rgba(37,99,235,0.08)', idleBg: '#ECEEF8',
  okLine: 'rgba(16,185,129,0.28)', warnLine: 'rgba(245,158,11,0.32)', badLine: 'rgba(239,68,68,0.26)', infoLine: 'rgba(37,99,235,0.22)', idleLine: 'rgba(20,27,52,0.08)',
  star: '#D97706', ring: 'rgba(37,99,235,0.35)',
};
export type Theme = typeof theme;
export const useTheme = (): Theme => theme;
export const CONTENT_MAX = 1200;
export const R = { sm: 16, md: 24, lg: 30, pill: 999 };
/* Inter throughout the app; tabular numerals keep times and amounts aligned without changing the typeface. */
export const font = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold', heavy: 'Inter_800ExtraBold', display: 'Inter_800ExtraBold', displayBold: 'Inter_800ExtraBold', mono: 'Inter_500Medium', monoRegular: 'Inter_400Regular' };
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

/* One-shot entrance: fade + rise, staggered by index. Skipped when the OS asks for reduced motion. */
export function FadeIn({ children, i = 0, style, rise = 18 }: { children: ReactNode; i?: number; style?: ViewStyle; rise?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live) return;
      if (reduce) v.setValue(1);
      else Animated.timing(v, { toValue: 1, duration: 420, delay: Math.min(i, 8) * 60, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
    }).catch(() => v.setValue(1));
    return () => { live = false; };
  }, [v, i]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }] }]}>{children}</Animated.View>;
}

export function Screen({ children, header, footer, refresh, refreshing, pad = true }: { children: ReactNode; header?: ReactNode; footer?: ReactNode; refresh?: () => void; refreshing?: boolean; pad?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = insets.top; /* the topbar floats over the page, so content starts below it */
  useFocusEffect(useCallback(() => { showBar(); }, [])); /* each screen opens with the nav bar visible */
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
    {header ? <View style={{ position: 'absolute', top: top + 84, left: 0, right: Platform.OS === 'web' ? 16 : 0, zIndex: 20, minHeight: 80, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderBottomWidth: 1, borderBottomColor: t.line }}>
      <View style={{ width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center', paddingHorizontal: 16 }}>{header}</View>
    </View> : null}
    {footer ? <View style={{ position: 'absolute', left: 0, right: Platform.OS === 'web' ? 16 : 0, bottom: Math.max(insets.bottom, 12) + 66 + 8, zIndex: 25, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.88)' }}>
      <View style={{ width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' }}>{footer}</View>
    </View> : null}
    <ScrollView style={[{ backgroundColor: 'transparent' }, Platform.OS === 'web' ? ({ scrollBehavior: 'smooth', overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' } as any) : null]} onScroll={onBarScroll} scrollEventThrottle={16} contentContainerStyle={{ padding: pad ? 16 : 0, paddingTop: header ? top + 84 + 80 + 16 : top + 84 + 16, gap: 16, paddingBottom: footer ? Math.max(180, insets.bottom + 66 + 8 + 60 + 16) : 120 }} keyboardShouldPersistTaps="handled"
      refreshControl={refresh ? <RefreshControl refreshing={!!refreshing} onRefresh={refresh} /> : undefined}>
      {/* One shared content width for every screen, so wide browser windows are used consistently. */}
      <FadeIn rise={10} style={{ width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center', gap: 16 }}>{children}</FadeIn>
    </ScrollView>
  </KeyboardAvoidingView>;
}

export function Txt({ children, style, muted, bold, size, color, numberOfLines }: { children: ReactNode; style?: any; muted?: boolean; bold?: boolean; size?: number; color?: string; numberOfLines?: number }) {
  const t = useTheme();
  const sz = size ?? 15;
  const big = bold && sz >= 20; // headings: semibold with tight tracking (-0.02em)
  return <Text numberOfLines={numberOfLines} style={[{ color: color ?? (muted ? t.muted : t.ink), fontSize: sz, fontFamily: big ? font.heavy : bold ? font.bold : font.regular, letterSpacing: big ? -sz * 0.04 : 0, lineHeight: big ? sz * 1.15 : undefined }, style]}>{children}</Text>;
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: ViewStyle }) {
  const t = useTheme();
  /* Soft cool-tinted block on the white page: no border, no shadow; pressable cards darken slightly on hover and dim on press. */
  const s = [{ backgroundColor: t.card, borderRadius: R.md, padding: 18, gap: 10 }, style];
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" style={(st: any) => [...s, st.hovered && { backgroundColor: t.surface }, st.pressed && { opacity: 0.8 }]}>{children}</Pressable> : <View style={s}>{children}</View>;
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
export function Button({ title, onPress, kind = 'primary', size = 'md', busy, disabled, style, icon, iconOnly }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; size?: 'md' | 'sm'; busy?: boolean; disabled?: boolean; style?: ViewStyle; icon?: keyof typeof Ionicons.glyphMap; iconOnly?: boolean }) {
  const t = useTheme();
  const fg = kind === 'primary' ? '#FFFFFF' : kind === 'danger' ? t.bad : t.ink;
  const h = size === 'sm' ? 46 : 54;
  /* iconOnly: a round glyph button (the title stays as its accessibility label); otherwise an optional leading icon + bold label. */
  return <Pressable onPress={onPress} disabled={busy || disabled} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!(busy || disabled), busy: !!busy }}
    style={(st: any) => [{
      height: h, backgroundColor: kind === 'primary' ? (st.pressed || st.hovered ? '#232C4D' : t.ink) : kind === 'danger' ? (st.pressed ? 'rgba(239,68,68,0.18)' : t.badBg) : st.hovered || st.pressed ? t.surface : t.card,
      borderWidth: 0, borderRadius: R.pill, paddingHorizontal: iconOnly ? 0 : 22, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? 0.45 : 1, transform: [{ scale: st.pressed ? 0.96 : st.hovered ? 1.02 : 1 }],
      ...(kind === 'primary' ? { shadowColor: '#141B34', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 } : null),
    }, iconOnly ? { width: h, flexGrow: 0, flexShrink: 0, flexBasis: h } : null, style, iconOnly ? { flex: undefined, flexGrow: 0, flexBasis: h, width: h } : null]}>
    {busy ? <ActivityIndicator color={fg} /> : <>
      {icon ? <Ionicons name={icon} size={iconOnly ? 22 : 18} color={fg} /> : null}
      {iconOnly ? null : <Text style={{ color: fg, fontFamily: font.bold, fontSize: 15, letterSpacing: -0.2 }}>{title}</Text>}
    </>}
  </Pressable>;
}

/* Slide-to-confirm: for actions that start something real (trip, work, accepting a job). A tap does nothing; the pro has to drag the thumb
   all the way across, so it can't be triggered by accident. Screen readers get a plain "activate" action instead. */
export function SlideToConfirm({ label, onConfirm, busy, disabled, icon = 'chevron-forward', style }: { label: string; onConfirm: () => void; busy?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap; style?: ViewStyle }) {
  const t = useTheme();
  const THUMB = 46, PAD = 4;
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const max = Math.max(0, w - THUMB - PAD * 2);
  const live = useRef({ max: 0, off: false, onConfirm });
  live.current = { max, off: !!(busy || disabled), onConfirm };
  const native = Platform.OS !== 'web';

  const reset = () => Animated.spring(x, { toValue: 0, useNativeDriver: native, speed: 14, bounciness: 6 }).start();
  useEffect(() => { if (!busy) reset(); }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !live.current.off,
    onMoveShouldSetPanResponder: () => !live.current.off,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => x.setValue(Math.min(live.current.max, Math.max(0, g.dx))),
    onPanResponderRelease: (_, g) => {
      const m = live.current.max;
      if (m > 0 && g.dx >= m * 0.85) {
        Animated.timing(x, { toValue: m, duration: 120, useNativeDriver: native }).start(() => { live.current.onConfirm(); setTimeout(reset, 900); });
      } else reset();
    },
    onPanResponderTerminate: reset,
  })).current;

  const fade = x.interpolate({ inputRange: [0, Math.max(1, max * 0.6)], outputRange: [1, 0], extrapolate: 'clamp' });
  return <View accessible accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Double tap to confirm" accessibilityState={{ disabled: !!(busy || disabled), busy: !!busy }}
    accessibilityActions={[{ name: 'activate', label }]} onAccessibilityAction={() => { if (!busy && !disabled) onConfirm(); }}
    onLayout={(e) => setW(e.nativeEvent.layout.width)}
    style={[{ height: 54, borderRadius: R.pill, backgroundColor: t.ink, justifyContent: 'center', overflow: 'hidden', opacity: disabled ? 0.45 : 1, minWidth: 140 }, style]}>
    <Animated.Text numberOfLines={1} style={{ textAlign: 'center', color: '#FFFFFF', fontFamily: font.bold, fontSize: 15, letterSpacing: -0.2, paddingLeft: THUMB + PAD * 2, paddingRight: 16, opacity: fade }}>{busy ? 'Updating…' : label}</Animated.Text>
    <Animated.View {...pan.panHandlers} style={{ position: 'absolute', left: PAD, top: PAD, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', transform: [{ translateX: x }],
      ...(Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none' } as any) : null) }}>
      {busy ? <ActivityIndicator color={t.ink} /> : <Ionicons name={icon} size={22} color={t.ink} />}
    </Animated.View>
  </View>;
}

/* Filled field matching the sign-in screens: label above, no border until focus, 52px control, 16px text. */
export function Field({ label: l, ...p }: TextInputProps & { label: string }) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  return <View style={{ gap: 8 }}>
    <Text style={{ color: t.muted, fontFamily: font.medium, fontSize: 14 }}>{l}</Text>
    <TextInput placeholderTextColor={t.muted} accessibilityLabel={l} {...p}
      onFocus={(e) => { setFocus(true); p.onFocus?.(e); }} onBlur={(e) => { setFocus(false); p.onBlur?.(e); }}
      style={[{ minHeight: 52, borderWidth: 1.5, borderColor: focus ? t.accent : 'transparent', backgroundColor: t.surface, color: t.ink, borderRadius: R.sm, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, fontFamily: font.regular }, p.multiline && { minHeight: 100, textAlignVertical: 'top' }, p.style, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]} />
  </View>;
}

/* Page heading used by every tab: big tight title, optional one-line subtitle, optional control on the right. */
export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingTop: 8 }}>
    <View style={{ flex: 1, gap: 4 }}>
      <Text accessibilityRole="header" style={{ color: t.ink, fontFamily: font.display, fontSize: 32, letterSpacing: -1.4, lineHeight: 36 }}>{title}</Text>
      {sub ? <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 15, lineHeight: 21 }}>{sub}</Text> : null}
    </View>
    {right}
  </View>;
}

export function Chip({ title, on, onPress, disabled }: { title: string; on?: boolean; onPress?: () => void; disabled?: boolean }) {
  const t = useTheme();
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: !!on, disabled: !!disabled }}
    style={(st: any) => ({ height: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: R.pill, backgroundColor: on ? t.ink : st.hovered || st.pressed ? t.surface : t.card, opacity: disabled ? 0.4 : 1 })}>
    <Text style={{ color: on ? '#FFFFFF' : t.body, fontSize: 14, fontFamily: font.bold }}>{title}</Text>
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
  return <View style={{ backgroundColor: c.bg, paddingHorizontal: 10, height: 24, justifyContent: 'center', borderRadius: R.pill, alignSelf: 'flex-start' }}><Text style={{ color: c.fg, fontSize: 11, fontFamily: font.semibold, letterSpacing: 0.2 }}>{label(v)}</Text></View>;
}

/* Initials avatar: deterministic color per name, standing in for a profile photo. */
const AVATAR_COLORS = ['#C8CBFF', '#BFD8FF', '#C9EFD9', '#FBE3B5', '#F8C9EA', '#E3C9F5', '#D9E1FA', '#EDE9FE'];
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const bg = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
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

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReduced(query.matches);
      update();
      query.addEventListener?.('change', update);
      return () => query.removeEventListener?.('change', update);
    }
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}

export function LoadingIndicator({ label: message = 'Loading your workspace', fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  const t = useTheme();
  const reduceMotion = useReducedMotionPreference();
  const spin = useRef(new Animated.Value(0)).current;
  const counterSpin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      spin.setValue(0); counterSpin.setValue(0); pulse.setValue(0);
      return undefined;
    }
    const native = Platform.OS !== 'web';
    const mainLoop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1450, easing: Easing.linear, useNativeDriver: native, isInteraction: false }));
    const innerLoop = Animated.loop(Animated.timing(counterSpin, { toValue: 1, duration: 2100, easing: Easing.linear, useNativeDriver: native, isInteraction: false }));
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: native, isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 760, easing: Easing.inOut(Easing.quad), useNativeDriver: native, isInteraction: false }),
    ]));
    mainLoop.start(); innerLoop.start(); pulseLoop.start();
    return () => { mainLoop.stop(); innerLoop.stop(); pulseLoop.stop(); };
  }, [reduceMotion, spin, counterSpin, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counterRotate = counterSpin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.16] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  return <View style={{ flex: fullScreen ? 1 : undefined, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: fullScreen ? undefined : 190, gap: 16, backgroundColor: fullScreen ? t.bg : t.card, borderRadius: R.lg, borderCurve: 'continuous' }}>
    <View accessible accessibilityRole="progressbar" accessibilityLabel={message} style={{ width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: t.line }} />
      <Animated.View style={{ position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'transparent', borderTopColor: t.accent, borderRightColor: t.accent, transform: [{ rotate }] }} />
      <Animated.View style={{ position: 'absolute', width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent', borderBottomColor: t.accentLine, borderLeftColor: t.accentLine, transform: [{ rotate: counterRotate }] }} />
      <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent, opacity, transform: [{ scale }] }} />
    </View>
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Text style={{ color: t.ink, fontFamily: font.semibold, fontSize: 15 }}>{message}</Text>
      <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 13 }}>Just a moment</Text>
    </View>
  </View>;
}

export function Status({ error, loading, empty, loadingLabel }: { error?: string; loading?: boolean; empty?: string; loadingLabel?: string }) {
  const t = useTheme();
  if (loading) return <LoadingIndicator label={loadingLabel} />;
  if (error) return <Txt color={t.bad} style={{ textAlign: 'center', marginTop: 20 }}>{error}</Txt>;
  if (empty) return <View style={{ backgroundColor: t.card, borderRadius: R.md, paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center', marginTop: 8 }}>
    <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 360 }}>{empty}</Text>
  </View>;
  return null;
}

export const Row = ({ children, between }: { children: ReactNode; between?: boolean }) =>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: between ? 'space-between' : undefined }}>{children}</View>;

/* "fixzy." wordmark: heavy, tight tracking, tan period (web .brand + .dot). */
export function Wordmark({ size = 34, color }: { size?: number; color?: string }) {
  const t = useTheme();
  return <Text style={{ fontFamily: font.heavy, fontSize: size, letterSpacing: -size * 0.045, color: color || t.ink }}>fixzy<Text style={{ color: t.accent }}>.</Text></Text>;
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
