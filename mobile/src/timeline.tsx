import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
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

/* Vertical animated step timeline: filled dot + connecting line up through the current step, pulsing ring on the active one. */
export function Timeline({ steps, current }: { steps: Step[]; current: number }) {
  const t = useTheme();
  return <View>
    {steps.map((s, i) => {
      const done = i < current;
      const active = i === current;
      const last = i === steps.length - 1;
      return <View key={s.key} style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ alignItems: 'center' }}>
          <StepDot icon={done ? s.iconDone : s.icon} active={active} done={done} />
          {!last && <View style={{ width: 2, flex: 1, minHeight: 26, backgroundColor: i < current ? t.brand : t.line }} />}
        </View>
        <View style={{ paddingBottom: last ? 2 : 20, paddingTop: 6 }}>
          <Txt bold={active} muted={i > current} size={15}>{s.label}</Txt>
          {active && !!s.hint && <Txt muted size={12}>{s.hint}</Txt>}
        </View>
      </View>;
    })}
  </View>;
}
