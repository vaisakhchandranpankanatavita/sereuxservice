import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { font } from './ui';
import { useReducedMotion } from './authkit';

const native = Platform.OS !== 'web';
const TRACK = 148;

/* Calm full-screen welcome loader: crisp brand, orbiting rings and one quiet progress sweep. */
export function SignInLoader({ name }: { name?: string }) {
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: reduced ? 160 : 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    if (reduced) {
      spin.setValue(0); orbit.setValue(0); pulse.setValue(0); slide.setValue(0);
      return undefined;
    }
    const loops = [
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: native, isInteraction: false })),
      Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 2300, easing: Easing.linear, useNativeDriver: native, isInteraction: false })),
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: native, isInteraction: false }),
        Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: native, isInteraction: false }),
      ])),
      Animated.loop(Animated.timing(slide, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: native, isInteraction: false })),
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [enter, spin, orbit, pulse, slide, reduced]);

  useEffect(() => { AccessibilityInfo.announceForAccessibility?.('Signing you in'); }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const orbitRotate = orbit.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const coreScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.12] });
  const coreOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] });
  const sweep = slide.interpolate({ inputRange: [0, 1], outputRange: [-TRACK * 0.35, TRACK] });
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: reduced ? [1, 1] : [0.98, 1] });

  return <View accessible accessibilityRole="progressbar" accessibilityLabel="Signing you in" style={[StyleSheet.absoluteFill, { zIndex: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1017' }]}>
    <LinearGradient pointerEvents="none" colors={['#16233F', '#1E2238', '#0F1017']} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <Animated.View style={{ alignItems: 'center', gap: 18, opacity: enter, transform: [{ scale }] }}>
      <Text style={{ color: '#FAFAFA', fontFamily: font.semibold, fontSize: 24, letterSpacing: -1 }}>fixzy<Text style={{ color: '#60A5FA' }}>.</Text></Text>
      <View style={{ width: 58, height: 58, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: 'rgba(255,255,255,0.14)' }} />
        <Animated.View style={{ position: 'absolute', width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: 'transparent', borderTopColor: '#60A5FA', borderRightColor: 'rgba(96,165,250,0.55)', transform: [{ rotate }] }} />
        <Animated.View style={{ position: 'absolute', width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'transparent', borderBottomColor: 'rgba(255,255,255,0.38)', borderLeftColor: 'rgba(255,255,255,0.38)', transform: [{ rotate: orbitRotate }] }} />
        <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#60A5FA', opacity: coreOpacity, transform: [{ scale: coreScale }] }} />
      </View>
      <View style={{ alignItems: 'center', gap: 5 }}>
        <Text style={{ color: '#FAFAFA', fontFamily: font.semibold, fontSize: 18, letterSpacing: -0.35 }}>{name ? `Welcome, ${name.split(' ')[0]}` : 'Welcome back'}</Text>
        <Text style={{ color: 'rgba(250,250,250,0.68)', fontFamily: font.regular, fontSize: 14 }}>Preparing your workspace</Text>
      </View>
      <View style={{ width: TRACK, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)' }}>
        <Animated.View style={{ width: TRACK * 0.28, height: 3, borderRadius: 2, backgroundColor: '#60A5FA', transform: [{ translateX: sweep }] }} />
      </View>
    </Animated.View>
  </View>;
}
