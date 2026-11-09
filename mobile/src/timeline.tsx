import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt, useTheme } from './ui';

export type Step = { key: string; label: string; hint?: string; icon: keyof typeof Ionicons.glyphMap; iconDone: keyof typeof Ionicons.glyphMap };

/* Pulsing ring + filled/outline glyph swap around the active step's dot. */
function StepDot({ icon, active, done }: { icon: keyof typeof Ionicons.glyphMap; active: boolean; done: boolean }) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) { pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const filled = done || active;

  return <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
    {active && <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: t.accent, opacity: ringOpacity, transform: [{ scale }] }} />}
    <View style={{
      width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
      backgroundColor: filled ? (active ? t.accent : t.brand) : t.card,
      borderWidth: filled ? 0 : 1.5, borderColor: t.line,
    }}>
      <Ionicons name={icon} size={17} color={filled ? t.brandInk : t.muted} />
    </View>
  </View>;
}

/* Vertical animated step timeline: filled dot + connecting line up through the current step, pulsing ring on the active one.
   On first show the steps build in one after another (dot pops, label slides in, the line fills down to the next step).
   `play` lets a screen hold the reveal until it is actually visible (e.g. after a loader overlay has gone). */
export function Timeline({ steps, current, play = true }: { steps: Step[]; current: number; play?: boolean }) {
  const t = useTheme();
  const dots = useRef(steps.map(() => new Animated.Value(0))).current;
  const lines = useRef(steps.map(() => new Animated.Value(0))).current;
  const started = useRef(false);

  useEffect(() => {
    if (!play || started.current) return;
    started.current = true;
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live) return;
      if (reduce) { dots.forEach((d) => d.setValue(1)); lines.forEach((l) => l.setValue(1)); return; }
      const seq: Animated.CompositeAnimation[] = [Animated.delay(150)];
      steps.forEach((_, i) => {
        seq.push(Animated.spring(dots[i], { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }));
        if (i < current) seq.push(Animated.timing(lines[i], { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }));
      });
      Animated.sequence(seq).start();
    }).catch(() => { dots.forEach((d) => d.setValue(1)); lines.forEach((l) => l.setValue(1)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  return <View>
    {steps.map((s, i) => {
      const done = i < current;
      const active = i === current;
      const last = i === steps.length - 1;
      const r = dots[i];
      return <View key={s.key} style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ alignItems: 'center' }}>
          <Animated.View style={{ opacity: r, transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
            <StepDot icon={done ? s.iconDone : s.icon} active={active && play} done={done} />
          </Animated.View>
          {!last && <View style={{ width: 2, flex: 1, minHeight: 26, backgroundColor: t.line, overflow: 'hidden' }}>
            {i < current && <Animated.View style={{ width: 2, backgroundColor: t.brand, height: lines[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />}
          </View>}
        </View>
        <Animated.View style={{ paddingBottom: last ? 2 : 20, paddingTop: 6, opacity: r, transform: [{ translateX: r.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }}>
          <Txt bold={active || done} muted={i > current} size={18}>{s.label}</Txt>
          {active && !!s.hint && <Txt muted size={14}>{s.hint}</Txt>}
        </Animated.View>
      </View>;
    })}
  </View>;
}
