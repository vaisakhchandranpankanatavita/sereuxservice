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

/* keepPlaying: while true, the montage loops (covering however long sign-in actually takes);
   once it flips false, the current pass finishes and onDone fires. */
export default function ServiceLoader({ onDone, keepPlaying }: { onDone: () => void; keepPlaying: boolean }) {
  const opacities = useRef(IMAGES.map(() => new Animated.Value(0))).current;
  const scales = useRef(IMAGES.map(() => new Animated.Value(1.22))).current;
  const keepPlayingRef = useRef(keepPlaying);
  keepPlayingRef.current = keepPlaying;

  useEffect(() => {
    let cancelled = false;
    const playOnce = () => new Promise<void>((resolve) => {
      opacities.forEach((v) => v.setValue(0));
      scales.forEach((v) => v.setValue(1.22));
      const anims = IMAGES.map((_, i) => Animated.parallel([
        Animated.sequence([
          Animated.timing(opacities[i], { toValue: 1, duration: STEP * 0.35, useNativeDriver: true }),
          Animated.timing(opacities[i], { toValue: 0, duration: STEP * 0.65, delay: STEP * 0.25, useNativeDriver: true }),
        ]),
        Animated.timing(scales[i], { toValue: 1, duration: STEP * 1.4, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]));
      Animated.stagger(STEP, anims).start(() => resolve());
    });
    (async () => {
      do { await playOnce(); } while (!cancelled && keepPlayingRef.current);
      if (!cancelled) onDone();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <View style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]} pointerEvents="none">
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#141412' }]} />
    {IMAGES.map((src, i) => <Animated.Image key={i} source={src} resizeMode="cover"
      style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: opacities[i], transform: [{ scale: scales[i] }] }]} />)}
  </View>;
}
