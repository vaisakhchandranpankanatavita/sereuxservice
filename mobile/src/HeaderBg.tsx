import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/* Soft animated backdrop for a header: a periwinkle gradient with slow drifting colour blobs and a faint sheen.
   Sits behind the header content (absolute fill); everything runs on the native driver. */
/* One calm palette per page: a two-stop gradient plus two soft accent blobs. */
export const TONES = {
  home: { grad: ['#d3d1ff', '#aaa7ff'], blobs: ['#f8b6e8', '#ffffff'], base: '#aaa7ff' },
  shop: { grad: ['#ffe3c4', '#f6b778'], blobs: ['#fff3dc', '#f8b6e8'], base: '#f6b778' },
  activity: { grad: ['#d6f4de', '#86d79c'], blobs: ['#eef3a8', '#ffffff'], base: '#86d79c' },
  account: { grad: ['#fddbf3', '#f4a9de'], blobs: ['#d3d1ff', '#ffffff'], base: '#f4a9de' },
} as const;
export type Tone = keyof typeof TONES;

const SHAPES = [
  { size: 170, left: -40, top: -60, dx: 140, dy: 30, ms: 5200, o: 0.6 },
  { size: 140, left: '55%', top: -50, dx: -130, dy: 40, ms: 6200, o: 0.5 },
] as const;
type BlobSpec = (typeof SHAPES)[number] & { color: string };

function Blob({ b, still }: { b: BlobSpec; still: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: b.ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: b.ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, still, b.ms]);
  return <Animated.View pointerEvents="none" style={[{
    position: 'absolute', left: b.left as any, top: b.top, width: b.size, height: b.size, borderRadius: b.size / 2,
    backgroundColor: b.color, opacity: b.o,
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, b.dx] }) },
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, b.dy] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) },
    ],
  }, Platform.OS === 'web' ? ({ filter: 'blur(22px)' } as any) : null]} />;
}

export default function HeaderBg({ tone = 'home' }: { tone?: Tone }) {
  /* Deliberately not gated on reduce-motion: it is a slow, low-contrast ambient drift (no parallax or fast movement),
     and phones with "remove animations" on were showing a frozen header. */
  const p = TONES[tone];
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={[...p.grad]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    {SHAPES.map((s, i) => <Blob key={`${tone}${i}`} b={{ ...s, color: p.blobs[i] }} still={false} />)}
  </View>;
}
