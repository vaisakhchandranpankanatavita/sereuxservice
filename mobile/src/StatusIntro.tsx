import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font } from './ui';
import type { Step } from './timeline';

/* Full-screen cinematic reveal, shown once per visit between tapping an activity card and
   seeing its detail screen: steps through each status up to the real current one — icon pop,
   label slide-in, a segmented progress bar like a story — then a pulse and a wipe-up exit.
   Mirrors the house style set by Intro.tsx / ServiceLoader.tsx (same easing, same wipe). */
const STEP_MS = 420;
const HOLD_MS = 550;
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const INK = '#141412';
const CREAM = '#f8f8f5';
const ACCENT = '#b8956a';

export function StatusIntro({ steps, current, eyebrow, title, onDone }: { steps: Step[]; current: number; eyebrow: string; title: string; onDone: () => void }) {
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [reduce, setReduce] = useState(false);
  const leaving = useRef(false);

  const wipe = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.6)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const labelY = useRef(new Animated.Value(16)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {}); }, []);

  const finish = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(wipe, { toValue: 1, duration: reduce ? 150 : 520, easing: Easing.bezier(0.77, 0, 0.175, 1), useNativeDriver: true }).start(() => onDone());
  }, [onDone, reduce, wipe]);

  useEffect(() => {
    if (reduce) { finish(); return; }
    let cancelled = false;
    (async () => {
      for (let i = 0; i <= current; i++) {
        if (cancelled) return;
        setIndex(i);
        iconScale.setValue(0.6); iconOpacity.setValue(0); labelY.setValue(16); labelOpacity.setValue(0);
        await new Promise<void>((resolve) => Animated.parallel([
          Animated.spring(iconScale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
          Animated.timing(iconOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(labelY, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
          Animated.timing(labelOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(bar, { toValue: (i + 1) / (current + 1), duration: STEP_MS, easing: Easing.linear, useNativeDriver: false }),
        ]).start(() => resolve()));
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, i === current ? HOLD_MS : STEP_MS - 220));
      }
      if (cancelled) return;
      await new Promise<void>((resolve) => {
        Animated.loop(Animated.sequence([
          Animated.timing(ring, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]), { iterations: 2 }).start(() => resolve());
      });
      if (!cancelled) finish();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = steps[index];
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return <Animated.View
    accessibilityViewIsModal accessibilityLabel={`${title} status`}
    style={[StyleSheet.absoluteFill, {
      zIndex: 1000, elevation: 1000, backgroundColor: INK,
      transform: [{ translateY: wipe.interpolate({ inputRange: [0, 1], outputRange: [0, -height] }) }],
    }]}>
    <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityRole="button" accessibilityLabel="Skip" />

    <View style={st.top}>
      <Text style={st.eyebrow}>{eyebrow}</Text>
      <Text style={st.skip}>Skip</Text>
    </View>

    <View style={st.center} pointerEvents="none">
      <View style={st.iconWrap}>
        {index === current && <Animated.View style={[st.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />}
        <Animated.View style={[st.iconCircle, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}>
          <Ionicons name={s.iconDone} size={38} color={INK} />
        </Animated.View>
      </View>
      <Animated.Text style={[st.label, { opacity: labelOpacity, transform: [{ translateY: labelY }] }]}>{s.label}</Animated.Text>
      {!!s.hint && <Animated.Text style={[st.hint, { opacity: labelOpacity, transform: [{ translateY: labelY }] }]}>{s.hint}</Animated.Text>}
    </View>

    <View style={st.bottom} pointerEvents="none">
      <View style={st.segments}>
        {steps.map((_, i) => <View key={i} style={[st.segment, i <= index && st.segmentDone]} />)}
      </View>
      <Text style={st.title} numberOfLines={1}>{title}</Text>
    </View>
  </Animated.View>;
}

const st = StyleSheet.create({
  top: { position: 'absolute', top: 56, left: 24, right: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 },
  eyebrow: { color: 'rgba(248,248,245,0.55)', fontFamily: font.bold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  skip: { color: 'rgba(248,248,245,0.55)', fontFamily: font.bold, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  iconWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: ACCENT },
  iconCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  label: { color: CREAM, fontFamily: font.heavy, fontSize: 28, letterSpacing: -0.6, textAlign: 'center' },
  hint: { color: 'rgba(248,248,245,0.55)', fontFamily: font.medium, fontSize: 15, textAlign: 'center' },
  bottom: { position: 'absolute', bottom: 56, left: 24, right: 24, gap: 12 },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(248,248,245,0.18)' },
  segmentDone: { backgroundColor: ACCENT },
  title: { color: 'rgba(248,248,245,0.45)', fontFamily: font.bold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', textAlign: 'center' },
});
