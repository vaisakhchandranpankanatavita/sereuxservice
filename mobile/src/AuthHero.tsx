import type { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { FadeIn, Wordmark, useTheme } from './ui';

/* Sign-in shell: the home hero photo fills the top, and a white rounded sheet rises over it
   holding the form — one calm entrance instead of text floating over a faded image. */
export default function AuthShell({ ratio = 0.5, children }: { ratio?: number; children: ReactNode }) {
  const { height } = useWindowDimensions();
  const t = useTheme();
  const h = Math.round(height * ratio);
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.lime }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: h + 40 }}>
      <Image source={require('../assets/hero.webp')} resizeMode="cover" accessibilityLabel="A bright living room with a sofa, floor lamp and plant" style={{ width: '100%', height: '100%' }} />
    </View>
    <View pointerEvents="none" style={{ position: 'absolute', top: 54, left: 22, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 }}><Wordmark size={26} /></View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingTop: h * 0.55 }}>
      <FadeIn rise={36} style={{ backgroundColor: t.bg, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 22, paddingBottom: 34, gap: 12 }}>{children}</FadeIn>
    </ScrollView>
  </KeyboardAvoidingView>;
}
