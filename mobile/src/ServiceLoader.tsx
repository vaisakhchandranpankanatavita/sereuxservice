import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

/* Fast cinematic montage of the service category art, shown while the app transitions
   from sign-in into the home screen: a quick zoom+crossfade cut through each image. */
const IMAGES = [
  require('../assets/services/plumbing.png'),
  require('../assets/services/electrical.png'),
  require('../assets/services/ac-repair.png'),
  require('../assets/services/carpentry.png'),
  require('../assets/services/painting.png'),
  require('../assets/services/cleaning.png'),
  require('../assets/services/appliances.png'),
  require('../assets/services/pest-control.png'),
];
const STEP = 150; // ms between cuts — fast

export default function ServiceLoader({ onDone }: { onDone: () => void }) {
  const opacities = useRef(IMAGES.map(() => new Animated.Value(0))).current;
  const scales = useRef(IMAGES.map(() => new Animated.Value(1.22))).current;

  useEffect(() => {
    const anims = IMAGES.map((_, i) => Animated.parallel([
      Animated.sequence([
        Animated.timing(opacities[i], { toValue: 1, duration: STEP * 0.35, useNativeDriver: true }),
        Animated.timing(opacities[i], { toValue: 0, duration: STEP * 0.65, delay: STEP * 0.25, useNativeDriver: true }),
      ]),
      Animated.timing(scales[i], { toValue: 1, duration: STEP * 1.4, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]));
    const run = Animated.stagger(STEP, anims);
    run.start(() => onDone());
    return () => run.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <View style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]} pointerEvents="none">
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#141412' }]} />
    {IMAGES.map((src, i) => <Animated.Image key={i} source={src} resizeMode="cover"
      style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: opacities[i], transform: [{ scale: scales[i] }] }]} />)}
  </View>;
}
