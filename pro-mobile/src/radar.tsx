import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/* Signal radar: a core dot with three rings. Offline it is a still, faded mark; online the rings expand and fade in a staggered loop.
   The loop value is mirrored into state so plain <Circle>s render each frame (animating SVG nodes through Animated warns on web). */
export function Radar({ on, size = 24, color, idle = '#A1A1AA' }: { on: boolean; size?: number; color: string; idle?: string }) {
  const k = useRef(new Animated.Value(0)).current;
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!on) { k.setValue(0); setP(0); return; }
    const id = k.addListener(({ value }) => setP(value));
    const loop = Animated.loop(Animated.timing(k, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => { loop.stop(); k.removeListener(id); };
  }, [on, k]);

  const c = on ? color : idle;
  return <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel={on ? 'Live, online' : 'Live, offline'}>
    {on
      ? [0, 1 / 3, 2 / 3].map((off) => {
        const ph = (p + off) % 1; /* each ring runs a third of a cycle behind the previous one */
        const opacity = ph < 0.15 ? (ph / 0.15) * 0.9 : 0.9 * (1 - (ph - 0.15) / 0.85);
        return <Circle key={off} cx={24} cy={24} r={3 + ph * 19} stroke={c} strokeWidth={2.4} fill="none" opacity={opacity} />;
      })
      : [10, 17, 22].map((r) => <Circle key={r} cx={24} cy={24} r={r} stroke={c} strokeWidth={2} fill="none" opacity={0.35} />)}
    <Circle cx={24} cy={24} r={5} fill={c} />
  </Svg>;
}
