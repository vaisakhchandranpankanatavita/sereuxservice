import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';

/* Shared frosted-glass surface: real blur of what scrolls underneath, a cool sky tint, a bright specular top edge and a tinted soft shadow. */
export function Glass({ radius, intensity = 55, style, children }: { radius: number; intensity?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return <View style={[{
    borderRadius: radius, shadowColor: '#1E3A8A', shadowOpacity: 0.16, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 6,
  }, style]}>
    <View style={{ borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
      {Platform.OS === 'web'
        ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,16,32,0.2)' }, { backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)' } as any]} />
        : <BlurView pointerEvents="none" tint="dark" intensity={intensity} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />}
      {/* login-style navy→plum gradient, semi-transparent so content still shows through */}
      <LinearGradient pointerEvents="none" colors={['rgba(37,84,170,0.62)', 'rgba(24,34,66,0.66)', 'rgba(52,34,80,0.62)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* specular rim */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: radius * 0.6, right: radius * 0.6, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
      {children}
    </View>
  </View>;
}
