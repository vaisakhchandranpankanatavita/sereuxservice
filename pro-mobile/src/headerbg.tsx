import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/* Same animated header backdrop as the customer app (gradient + two drifting blobs), in the pro app's sky-blue scheme. */
export const PRO_TONE = { grad: ['#DBEAFE', '#93C5FD'] as const, blobs: ['#A5F3FC', '#FFFFFF'] as const, base: '#93C5FD' };

const SHAPES = [
  { size: 190, left: -50, top: -70, dx: 120, dy: 26, ms: 5000, o: 0.85 },
  { size: 160, left: '50%', top: -60, dx: -110, dy: 34, ms: 6000, o: 0.75 },
] as const;

function Blob({ b, color }: { b: (typeof SHAPES)[number]; color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: b.ms, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(v, { toValue: 0, duration: b.ms, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, b.ms]);
  return <Animated.View pointerEvents="none" style={[{
    position: 'absolute', left: b.left as any, top: b.top, width: b.size, height: b.size, borderRadius: b.size / 2, backgroundColor: color, opacity: b.o,
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, b.dx] }) },
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, b.dy] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) },
    ],
  }, Platform.OS === 'web' ? ({ filter: 'blur(22px)' } as any) : null]} />;
}

export default function HeaderBg() {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={[...PRO_TONE.grad]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    {SHAPES.map((s, i) => <Blob key={i} b={s} color={PRO_TONE.blobs[i]} />)}
  </View>;
}
