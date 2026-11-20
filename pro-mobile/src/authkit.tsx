import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { font } from './ui';

/* Shared by the signed-out screens (sign in, reset password): same photo hero, palette, fields and staggered entrance. */
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const NATIVE = Platform.OS !== 'web'; /* the web build has no native animation driver, RN falls back to JS there */

/* Two surfaces, one ink, one accent used only for focus and the logo dot. */
export const palette = (dark: boolean) => dark
  ? { bg: '#0B0B0C', field: '#18181B', ink: '#FAFAFA', body: '#A1A1AA', accent: '#60A5FA', btn: '#FAFAFA', btnInk: '#09090B', bad: '#F87171' }
  : { bg: '#FFFFFF', field: '#F4F4F5', ink: '#09090B', body: '#52525B', accent: '#2563EB', btn: '#09090B', btnInk: '#FFFFFF', bad: '#B91C1C' };
export type P = ReturnType<typeof palette>;

/* Respect the OS "reduce motion" setting: no Ken Burns drift, no entrance travel. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

/* One 0→1 progress value drives every element: each row reads its own slice of it, so the whole form staggers in from a single native animation. */
export function useStagger(reduced: boolean) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) { t.setValue(1); return; }
    Animated.timing(t, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: NATIVE }).start();
  }, [reduced, t]);
  return (i: number) => {
    const s = Math.min(i * 0.09, 0.5), e = s + 0.45;
    return { opacity: t.interpolate({ inputRange: [s, e], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ translateY: t.interpolate({ inputRange: [s, e], outputRange: [18, 0], extrapolate: 'clamp' }) }] };
  };
}

/* The Fixzy "f" mark, name and PRO tag. */
export function Brand({ ink, bg, accent, tag }: { ink: string; bg: string; accent: string; tag: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <Svg width={30} height={30} viewBox="0 0 28 28" accessibilityLabel="Fixzy">
      <Rect width={28} height={28} rx={7} fill={ink} />
      <Rect x={11} y={7} width={3} height={14} fill={bg} />
      <Rect x={8} y={11} width={9} height={3} fill={bg} />
      <Rect x={14} y={7} width={5} height={3} fill={bg} />
      <Circle cx={21} cy={20} r={2} fill={accent} />
    </Svg>
    <Text style={{ color: ink, fontFamily: font.semibold, fontSize: 19, letterSpacing: -0.6 }}>fixzy</Text>
    <View style={{ borderWidth: 1, borderColor: tag, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: tag, fontFamily: font.medium, fontSize: 11, letterSpacing: 1 }}>PRO</Text>
    </View>
  </View>;
}

/* Dispatch-radar backdrop, all SVG, all transform/opacity: a dot grid that drifts one cell and loops seamlessly, and rings that expand
   from one point (the "job nearby" idea) with staggered phases. Static when the OS asks for reduced motion. */
const GRID = 24;
function Backdrop({ reduced }: { reduced: boolean }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const drift = useRef(new Animated.Value(0)).current;
  const ring = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (reduced) { ring.forEach((r, i) => r.setValue(0.25 + i * 0.3)); return; }
    const d = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: NATIVE }));
    const rs = ring.map((r, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 1600),
      Animated.timing(r, { toValue: 1, duration: 4800, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
    ])));
    d.start(); rs.forEach((x) => x.start());
    return () => { d.stop(); rs.forEach((x) => x.stop()); };
  }, [reduced, drift, ring]);
  /* Everything is sized from the panel's own measured box, so the grid and rings fit a phone, a tablet or a desktop split alike. */
  const W = box.w + GRID * 2, H = box.h + GRID * 2;
  const R0 = Math.round(Math.min(Math.max(Math.max(box.w, box.h) * 0.95, 280), 1000));
  const ox = box.w * (box.w >= box.h * 1.4 ? 0.62 : 0.74), oy = box.h * 0.4;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => { const { width: w, height: h } = e.nativeEvent.layout; setBox((b) => (b.w === w && b.h === h ? b : { w, h })); }}>
    <Animated.View style={{ position: 'absolute', left: -GRID, top: -GRID, transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, GRID] }) }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, GRID] }) }] }}>
      <Svg width={W} height={H}><Defs><Pattern id="dots" width={GRID} height={GRID} patternUnits="userSpaceOnUse"><Circle cx={GRID / 2} cy={GRID / 2} r={1.1} fill="rgba(250,250,250,0.18)" /></Pattern></Defs><Rect width={W} height={H} fill="url(#dots)" /></Svg>
    </Animated.View>
    {box.w > 0 ? <View style={{ position: 'absolute', left: ox, top: oy, width: 0, height: 0, alignItems: 'center', justifyContent: 'center' }}>
      {ring.map((r, i) => <Animated.View key={i} style={{ position: 'absolute', width: R0, height: R0, borderRadius: R0 / 2, borderWidth: 1.5, borderColor: '#60A5FA',
        opacity: r.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.7, 0] }), transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.08, 1] }) }] }} />)}
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#60A5FA' }} />
    </View> : null}
  </View>;
}

/* Soft sky-to-blush gradient with two large light blobs that drift very slowly (≈16s, a few dozen px). Static under reduced motion. */
export function GradientBackdrop({ dark, reduced }: { dark: boolean; reduced: boolean }) {
  const { width, height } = useWindowDimensions();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) { a.setValue(0); return; }
    const l = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 16000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      Animated.timing(a, { toValue: 0, duration: 16000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
    ]));
    l.start();
    return () => l.stop();
  }, [reduced, a]);
  const base = dark ? ['#16233F', '#1E2238', '#0F1017'] : ['#7DA9E3', '#D9DDEE', '#F1EFF6'];
  const blobA = dark ? '#3B6FD0' : '#8DB4EC', blobB = dark ? '#5A3B6B' : '#F0DCE6';
  const S = Math.max(width, height) * 0.9;
  const blob = (id: string, color: string, op: number) => <Svg width={S} height={S}><Defs><RadialGradient id={id} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={color} stopOpacity={op} /><Stop offset="1" stopColor={color} stopOpacity={0} /></RadialGradient></Defs><Rect width={S} height={S} fill={`url(#${id})`} /></Svg>;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
    <LinearGradient colors={base as any} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <Animated.View style={{ position: 'absolute', left: -S * 0.4, top: -S * 0.35, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) }, { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, 28] }) }] }}>{blob('ga', blobA, 0.9)}</Animated.View>
    <Animated.View style={{ position: 'absolute', right: -S * 0.45, top: height * 0.1, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) }, { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, 34] }) }] }}>{blob('gb', blobB, 0.85)}</Animated.View>
  </View>;
}

/* Hero panel: ink surface with the animated pattern, a fade so copy stays legible, brand and one line of copy on top. */
export function Hero({ c, reduced, fill }: { c: P; reduced: boolean; fill: boolean }) {
  const { width } = useWindowDimensions();
  return <View style={[{ overflow: 'hidden', backgroundColor: '#09090B' }, fill ? { flex: 1.15 } : { height: Math.round(Math.min(Math.max(width * 0.9, 300), 420)) }]}>
    <Backdrop reduced={reduced} />
    <LinearGradient pointerEvents="none" colors={['rgba(9,9,11,0)', 'rgba(9,9,11,0)', 'rgba(9,9,11,0.7)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
    <View style={{ flex: 1, padding: fill ? 40 : 24, paddingTop: fill ? 40 : 32, justifyContent: 'space-between' }}>
      <Brand ink="#FFFFFF" bg="#09090B" accent={c.accent} tag="rgba(255,255,255,0.8)" />
      <Text style={{ color: '#FFFFFF', fontFamily: font.semibold, fontSize: fill ? 40 : 26, lineHeight: fill ? 44 : 30, letterSpacing: -1, maxWidth: 420, paddingBottom: fill ? 0 : 36 }}>Your next job is already nearby.</Text>
    </View>
  </View>;
}

/* Filled field: label above, no border until focus, error text fades in without moving the layout. */
export function Field({ c, label, error, right, inputRef, onBlurValidate, ...p }: any) {
  const [focus, setFocus] = useState(false);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: error ? 1 : 0, duration: 240, easing: EASE, useNativeDriver: NATIVE }).start(); }, [error, a]);
  return <View style={{ marginBottom: 4 }}>
    <Text style={{ color: c.body, fontFamily: font.medium, fontSize: 14, marginBottom: 8 }}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.field, borderRadius: 14, height: 56, paddingHorizontal: 16, borderWidth: 1.5, borderColor: error ? c.bad : focus ? c.accent : 'transparent' }}>
      <TextInput ref={inputRef} accessibilityLabel={label} placeholderTextColor={c.body} onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); onBlurValidate?.(); }}
        {...p} style={[{ flex: 1, height: 56, fontSize: 16, fontFamily: font.regular, color: c.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]} />
      {right}
    </View>
    <View style={{ minHeight: 24, paddingTop: 4 }}>
      <Animated.Text accessibilityLiveRegion="polite" style={{ color: c.bad, fontFamily: font.regular, fontSize: 13, opacity: a }}>{error || ' '}</Animated.Text>
    </View>
  </View>;
}

