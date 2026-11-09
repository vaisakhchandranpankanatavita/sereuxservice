import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from './api';

/* Flat pastel blocks on a white page, charcoal pills. Light only. */
const theme = {
  bg: '#ffffff', card: '#f4f3ef', glass: '#f4f3ef', ink: '#232323', body: '#4a4846', muted: '#8a8680', line: 'rgba(35,35,35,0.08)',
  brand: '#232323', brandInk: '#ffffff', accent: '#aaa7ff', pink: '#f8b6e8', peach: '#f4a860', teal: '#72d08c', sun: '#f4a860',
  lime: '#e3ea7c', green: '#72d08c', peri: '#aaa7ff',
  ok: '#1f8a5b', warn: '#a85d00', bad: '#d23a4a', info: '#232323',
  okBg: '#d4f2dc', warnBg: '#fbe9c9', badBg: '#fbd9dd', infoBg: '#e5e4ff', idleBg: '#f0efeb',
};
export type Theme = typeof theme;
export const useTheme = (): Theme => theme;
export const R = { sm: 16, md: 24, lg: 30, pill: 999 };
export const font = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', bold: 'Inter_700Bold', heavy: 'Inter_800ExtraBold', hand: 'ComingSoon_400Regular' };

/* Native-stack's typed headerTitleStyle only allows fontFamily/fontSize/fontWeight/color — no
   textTransform or letterSpacing — so screen headers use this as a custom headerTitle instead. */
export function HeaderTitle({ children }: { children: ReactNode }) {
  return <Text style={{ color: theme.ink, fontFamily: font.heavy, fontSize: 20, letterSpacing: -0.6 }} numberOfLines={1}>{children}</Text>;
}

/* Pressable that springs down on touch — the one tactile behaviour shared by every tappable thing. */
const OUTER = ['flex', 'flexGrow', 'flexShrink', 'width', 'alignSelf', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical'];
export function Tap({ children, onPress, style, disabled, scaleTo = 0.97, ...a }: { children: ReactNode; onPress?: () => void; style?: any; disabled?: boolean; scaleTo?: number; accessibilityRole?: any; accessibilityLabel?: string; accessibilityState?: any; hitSlop?: number }) {
  const sc = useRef(new Animated.Value(1)).current;
  const flat: any = StyleSheet.flatten(style) ?? {};
  const outer: any = {}; const inner: any = {};
  for (const k of Object.keys(flat)) (OUTER.includes(k) ? outer : inner)[k] = flat[k];
  const to = (v: number, bounce: number) => Animated.spring(sc, { toValue: v, useNativeDriver: true, speed: 40, bounciness: bounce }).start();
  return <Pressable onPress={onPress} disabled={disabled} onPressIn={() => to(scaleTo, 0)} onPressOut={() => to(1, 7)} {...a} style={outer}>
    <Animated.View style={[inner, outer.flex ? { flex: 1 } : null, { transform: [{ scale: sc }] }]}>{children}</Animated.View>
  </Pressable>;
}

/* One-shot entrance: fade + rise, staggered by index. Skipped when the OS asks for reduced motion. */
export function FadeIn({ children, i = 0, style, rise = 18 }: { children: ReactNode; i?: number; style?: ViewStyle; rise?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live) return;
      if (reduce) v.setValue(1);
      else Animated.timing(v, { toValue: 1, duration: 420, delay: Math.min(i, 8) * 60, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }).catch(() => v.setValue(1));
    return () => { live = false; };
  }, [v, i]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }] }]}>{children}</Animated.View>;
}

/* Big screen heading with an optional round action on the right. */
export function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const top = useSafeAreaInsets().top;
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: Math.max(top, 14) + 6 }}>
    <Text style={{ flex: 1, color: theme.ink, fontFamily: font.heavy, fontSize: 32, lineHeight: 35, letterSpacing: -1.4 }}>{children}</Text>
    {right}
  </View>;
}

/* Round icon button: white or black, as in the reference's filter / arrow buttons. */
export function RoundBtn({ icon, onPress, dark, size = 46, label, rotate }: { icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; dark?: boolean; size?: number; label: string; rotate?: string }) {
  return <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.9}
    style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: dark ? theme.ink : theme.card, alignItems: 'center', justifyContent: 'center' }}>
    <Ionicons name={icon} size={size * 0.46} color={dark ? '#fff' : theme.ink} style={rotate ? { transform: [{ rotate }] } : undefined} />
  </Tap>;
}

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
  /* Temporary: each time a screen is opened, hold its data for a few seconds so the shimmer shows. */
  const [shown, setShown] = useState(false);
  useFocusEffect(useCallback(() => {
    setShown(false);
    const timer = setTimeout(() => setShown(true), 2500);
    load();
    return () => clearTimeout(timer);
  }, [load]));
  useEffect(() => { if (!pollMs) return; const t = setInterval(load, pollMs); return () => clearInterval(t); }, [load, pollMs]);
  const refresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);
  return { data: shown ? data : null, error: shown ? error : '', refreshing, refresh, reload: load };
}

export function Screen({ children, refresh, refreshing, pad = true, bottomPad = 130 }: { children: ReactNode; refresh?: () => void; refreshing?: boolean; pad?: boolean; bottomPad?: number }) {
  const t = useTheme();
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
    <ScrollView contentContainerStyle={{ padding: pad ? 18 : 0, gap: 14, paddingBottom: bottomPad }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      refreshControl={refresh ? <RefreshControl refreshing={!!refreshing} onRefresh={refresh} /> : undefined}><FadeIn rise={10} style={{ gap: pad ? 14 : 0 }}>{children}</FadeIn></ScrollView>
  </KeyboardAvoidingView>;
}

export function Txt({ children, style, muted, bold, size, color, numberOfLines }: { children: ReactNode; style?: any; muted?: boolean; bold?: boolean; size?: number; color?: string; numberOfLines?: number }) {
  const t = useTheme();
  const sz = size ?? 15;
  const big = bold && sz >= 20; // headings: heavy weight, tight tracking, like the web
  return <Text numberOfLines={numberOfLines} style={[{ color: color ?? (muted ? t.muted : t.ink), fontSize: sz, fontFamily: big ? font.heavy : bold ? font.bold : font.regular, letterSpacing: big ? -sz * 0.04 : 0, lineHeight: big ? sz * 1.15 : undefined }, style]}>{children}</Text>;
}

/* A service/delivery address: plain, readable text. */
export function Address({ children, style }: { children: ReactNode; style?: any }) {
  return <Text style={[{ color: theme.ink, fontFamily: font.medium, fontSize: 16, lineHeight: 22 }, style]}>{children}</Text>;
}

/* Soft edge washout for coloured cards: the tint stays full in the middle and fades lighter towards the edges.
   Drop it as the first child of a card that has overflow hidden. */
export function Wash() {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.55)']} locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.35)']} locations={[0, 0.5, 1]}
      start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
  </View>;
}

/* A highlighted summary block (lime) holding the key facts of a booking or delivery. */
export function NoteCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ backgroundColor: theme.lime, borderRadius: R.lg, padding: 20, gap: 4, overflow: 'hidden' }, style]}><Wash />{children}</View>;
}

export function NoteLine({ children, size, bold, muted }: { children: ReactNode; size?: number; bold?: boolean; muted?: boolean; last?: boolean }) {
  const sz = size ?? (bold ? 26 : 15);
  return <Text style={{ fontFamily: bold ? font.heavy : font.medium, fontSize: sz, lineHeight: sz * (bold ? 1.1 : 1.35), letterSpacing: bold ? -sz * 0.04 : 0, color: muted ? 'rgba(35,35,35,0.62)' : theme.ink, marginBottom: bold ? 4 : 0 }}>{children}</Text>;
}

export function Card({ children, onPress, style, tint }: { children: ReactNode; onPress?: () => void; style?: ViewStyle; tint?: string }) {
  const t = useTheme();
  const washed = !!tint && tint !== '#fff' && tint !== theme.ink; // coloured cards get the soft edge washout
  const st = { backgroundColor: tint ?? t.card, borderRadius: R.md, padding: 18, gap: 6, ...(washed ? { overflow: 'hidden' as const } : null), ...style };
  const body = <>{washed && <Wash />}{children}</>;
  return onPress ? <Tap onPress={onPress} accessibilityRole="button" scaleTo={0.98} style={st}>{body}</Tap> : <View style={st}>{body}</View>;
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

/* Pill buttons: solid black primary, frosted-white ghost. Sentence case. */
export function Button({ title, onPress, kind = 'primary', busy, disabled, style }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'accent'; busy?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const t = useTheme();
  const primary = kind === 'primary';
  const fg = primary ? t.brandInk : kind === 'danger' ? t.bad : t.ink;
  return <Tap onPress={onPress} disabled={busy || disabled} accessibilityRole="button" accessibilityState={{ disabled: !!(busy || disabled), busy: !!busy }}
    style={{ backgroundColor: primary ? t.ink : kind === 'accent' ? t.lime : kind === 'danger' ? t.badBg : t.card, borderRadius: R.pill, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1, ...style }}>
    {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontFamily: font.bold, fontSize: 15, letterSpacing: -0.2 }}>{title}</Text>}
  </Tap>;
}

export function Field({ label: l, onCard, small, ...p }: TextInputProps & { label: string; onCard?: boolean; small?: boolean }) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  const [show, setShow] = useState(false);
  const secure = !!p.secureTextEntry;
  return <View style={{ gap: 6 }}>
    {!!l && <Text style={{ color: t.muted, fontSize: 13, fontFamily: font.medium, marginLeft: 6 }}>{l}</Text>}
    <View>
      <TextInput placeholderTextColor={t.muted} accessibilityLabel={l || p.placeholder} {...p} secureTextEntry={secure && !show}
        onFocus={(e) => { setFocus(true); p.onFocus?.(e); }} onBlur={(e) => { setFocus(false); p.onBlur?.(e); }}
        style={[{ backgroundColor: onCard ? '#fff' : t.card, color: t.ink, borderRadius: p.multiline ? R.md : R.pill, paddingHorizontal: small ? 16 : 20, paddingVertical: small ? 7 : 14, fontSize: small ? 14 : 16, fontFamily: font.medium, borderWidth: 2, borderColor: focus ? t.ink : 'transparent' },
          secure && { paddingRight: 54 }, p.multiline && { minHeight: 90, textAlignVertical: 'top' }]} />
      {secure && <Pressable onPress={() => setShow((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', right: 8, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={t.muted} />
      </Pressable>}
    </View>
  </View>;
}

export function Chip({ title, on, onPress, disabled, big, onCard }: { title: string; on?: boolean; onPress?: () => void; disabled?: boolean; big?: boolean; onCard?: boolean }) {
  const t = useTheme();
  return <Tap onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: !!on, disabled: !!disabled }} hitSlop={big ? 4 : undefined} scaleTo={0.94}
    style={{ paddingHorizontal: big ? 22 : 18, paddingVertical: big ? 15 : 10, borderRadius: R.pill, backgroundColor: on ? t.ink : onCard ? '#fff' : t.card, opacity: disabled ? 0.4 : 1, minWidth: big ? 60 : undefined, alignItems: 'center' }}>
    <Text style={{ color: on ? t.brandInk : t.ink, fontSize: big ? 17 : 14, fontFamily: on ? font.bold : font.medium, letterSpacing: -0.2 }}>{title}</Text>
  </Tap>;
}

export function Chips({ children }: { children: ReactNode }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>{children}</ScrollView>;
}

const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info'> = { DONE: 'ok', DELIVERED: 'ok', CONFIRMED: 'info', SHIPPED: 'info', ON_THE_WAY: 'info', IN_PROGRESS: 'warn', REQUESTED: 'warn', PLACED: 'warn', CANCELLED: 'bad' };
export function Badge({ v }: { v: string }) {
  const t = useTheme();
  const k = TONE[v];
  const [bg, fg] = k === 'ok' ? [t.okBg, t.ok] : k === 'warn' ? [t.warnBg, t.warn] : k === 'bad' ? [t.badBg, t.bad] : k === 'info' ? [t.infoBg, t.info] : [t.idleBg, t.muted];
  return <View style={{ backgroundColor: bg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: R.pill, alignSelf: 'flex-start' }}><Text style={{ color: fg, fontSize: 12, fontFamily: font.bold }}>{label(v)}</Text></View>;
}

/* Initials avatar: deterministic color per name, standing in for a profile photo. */
const AVATAR_COLORS = ['#aaa7ff', '#e3ea7c', '#f4a860', '#f8b6e8', '#72d08c', '#8fb8ff', '#ffc94a', '#5fe0d0', '#ff9a6e', '#c2a4ff', '#7fe0a0', '#ff8fb8', '#ffd86e'];
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
      <Text style={{ fontSize: onChange ? 30 : 15, color: n <= value ? t.sun : t.line }}>★</Text>
    </Pressable>)}</View>;
}

/* Loading placeholder: soft cards with a pale highlight that sweeps across them, left to right, on repeat. */
function ShimmerBlock({ height }: { height: number }) {
  const t = useTheme();
  const [w, setW] = useState(300);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x]);
  return <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height, borderRadius: R.md, backgroundColor: t.card, overflow: 'hidden' }}>
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: w * 0.6,
      transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-w * 0.6, w] }) }] }}>
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  </View>;
}

export function Skeleton({ count = 3, height = 96 }: { count?: number; height?: number }) {
  return <View style={{ gap: 12 }}>{Array.from({ length: count }, (_, i) => <ShimmerBlock key={i} height={height} />)}</View>;
}

export function Status({ error, loading, empty }: { error?: string; loading?: boolean; empty?: string }) {
  const t = useTheme();
  if (loading) return <Skeleton />;
  if (error) return <Banner kind="bad">{error}</Banner>;
  if (empty) return <Txt muted style={{ textAlign: 'center', marginTop: 30 }}>{empty}</Txt>;
  return null;
}

/* Inline message: tinted block with an icon — used for errors, confirmations and tips. */
export function Banner({ kind = 'info', children }: { kind?: 'ok' | 'bad' | 'info'; children: ReactNode }) {
  const t = useTheme();
  const [bg, fg, icon] = kind === 'ok' ? [t.okBg, t.ok, 'checkmark-circle'] : kind === 'bad' ? [t.badBg, t.bad, 'alert-circle'] : [t.infoBg, t.ink, 'information-circle'];
  return <FadeIn rise={6}><View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: bg, borderRadius: 18, padding: 14 }}>
    <Ionicons name={icon as any} size={20} color={fg} />
    <Text style={{ flex: 1, color: fg, fontFamily: font.medium, fontSize: 14, lineHeight: 20 }}>{children}</Text>
  </View></FadeIn>;
}

/* Friendly empty state with one clear next step. */
export function Empty({ icon, title, text, action, onAction, tint }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; action?: string; onAction?: () => void; tint?: string }) {
  const t = useTheme();
  return <View style={{ alignItems: 'center', gap: 10, paddingVertical: 36, paddingHorizontal: 12 }}>
    <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: tint ?? t.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
      <Ionicons name={icon} size={36} color={t.ink} />
    </View>
    <Txt bold size={22} style={{ textAlign: 'center' }}>{title}</Txt>
    <Txt muted style={{ textAlign: 'center', maxWidth: 280 }}>{text}</Txt>
    {!!action && !!onAction && <Button title={action} onPress={onAction} style={{ marginTop: 8, alignSelf: 'center' }} />}
  </View>;
}

/* Two-or-more way switch with a highlight that glides between options. */
export function Segmented({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  const seg = w ? (w - 8) / options.length : 0;
  useEffect(() => { if (seg) Animated.spring(x, { toValue: idx * seg, useNativeDriver: true, speed: 18, bounciness: 5 }).start(); }, [idx, seg, x]);
  return <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', backgroundColor: t.card, borderRadius: R.pill, padding: 4 }}>
    {!!seg && <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 4, bottom: 4, left: 4, width: seg, borderRadius: R.pill, backgroundColor: t.ink, transform: [{ translateX: x }] }} />}
    {options.map((o) => <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="button" accessibilityState={{ selected: o.key === value }} style={{ flex: 1, paddingVertical: 11, alignItems: 'center' }}>
      <Text style={{ fontFamily: font.bold, fontSize: 14, color: o.key === value ? t.brandInk : t.ink }}>{o.label}</Text>
    </Pressable>)}
  </View>;
}

/* Settings-style list row: tinted icon disc, label, optional count, chevron. */
export function MenuRow({ icon, label: text, tint, count, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; tint?: string; count?: number; onPress: () => void }) {
  const t = useTheme();
  return <Tap onPress={onPress} accessibilityRole="button" scaleTo={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.card, borderRadius: R.md, padding: 14 }}>
    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: tint ?? t.lime, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={20} color={t.ink} /></View>
    <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 16, color: t.ink }}>{text}</Text>
    {!!count && <View style={{ backgroundColor: t.ink, borderRadius: 10, minWidth: 22, height: 22, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: font.bold, fontSize: 12 }}>{count}</Text></View>}
    <Ionicons name="chevron-forward" size={18} color={t.muted} />
  </Tap>;
}

/* − qty + control. */
export function Stepper({ value, onChange, max = 20 }: { value: number; onChange: (n: number) => void; max?: number }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: R.pill, padding: 4 }}>
    <RoundBtn icon="remove" size={34} label="Decrease quantity" onPress={() => onChange(value - 1)} />
    <Text style={{ minWidth: 32, textAlign: 'center', fontFamily: font.heavy, fontSize: 16, color: t.ink }}>{value}</Text>
    <RoundBtn icon="add" size={34} dark label="Increase quantity" onPress={() => value < max && onChange(value + 1)} />
  </View>;
}

/* Section heading. */
export const H = ({ children }: { children: ReactNode }) => <Txt bold size={22} style={{ marginTop: 6 }}>{children}</Txt>;

export const Row = ({ children, between, style }: { children: ReactNode; between?: boolean; style?: ViewStyle }) =>
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: between ? 'space-between' : undefined }, style]}>{children}</View>;

/* "fixzy." wordmark: heavy, tight tracking, tan period (web .brand + .dot). */
export function Wordmark({ size = 34 }: { size?: number }) {
  const t = useTheme();
  return <Text style={{ fontFamily: font.heavy, fontSize: size, letterSpacing: -size * 0.06, color: t.ink }}>fixzy<Text style={{ color: t.accent }}>.</Text></Text>;
}
export function Eyebrow({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, fontSize: 14, fontFamily: font.medium }}>{children}</Text>;
}
