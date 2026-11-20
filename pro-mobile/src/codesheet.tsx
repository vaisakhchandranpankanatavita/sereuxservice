import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { R, font, mono, overline, useTheme } from './ui';

type Props = {
  visible: boolean;
  finishing: boolean;
  customer?: string;
  busy?: boolean;
  error?: string;
  thumbs: string[];
  onPhoto: () => void;
  onSubmit: (code: string) => void;
  onClose: () => void;
};

/* Bottom sheet for the two proof steps: the customer's 4-digit code (start and finish) plus job photos.
   Photos are optional; the primary button only needs the code. */
export function CodeSheet({ visible, finishing, customer, busy, error, thumbs, onPhoto, onSubmit, onClose }: Props) {
  const t = useTheme();
  const [code, setCode] = useState('');
  const input = useRef<React.ElementRef<typeof TextInput>>(null);
  useEffect(() => { if (visible) { setCode(''); setTimeout(() => input.current?.focus(), 350); } }, [visible]);

  const ready = code.length === 4; /* photos are optional for both steps */
  const hint = code.length < 4 ? 'Enter the 4-digit code' : '';

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(9,9,11,0.5)' }} />
      <View style={{ backgroundColor: t.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 30, gap: 18, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: t.lineStrong }} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 6 }}>
            <Text style={{ ...overline, color: t.muted }}>{finishing ? 'Step 2 of 2 · Finish' : 'Step 1 of 2 · Start'}</Text>
            <Text style={{ fontFamily: font.semibold, fontSize: 28, color: t.ink, letterSpacing: -0.8 }}>{finishing ? 'Finish the job' : 'Start the work'}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: t.muted }}>
              Ask {customer || 'the customer'} for the {finishing ? 'completion' : 'start'} code shown in their Fixzy app.
            </Text>
          </View>

          {/* four digit boxes over one hidden input, so the number pad and paste both work */}
          <Pressable onPress={() => input.current?.focus()} accessibilityRole="button" accessibilityLabel="Customer code" style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
            {[0, 1, 2, 3].map((i) => {
              const on = i === Math.min(code.length, 3);
              return <View key={i} style={{ width: 58, height: 66, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface, borderWidth: 1.5, borderColor: error ? t.bad : on ? t.accent : t.line }}>
                <Text style={{ ...mono(30), color: t.ink }}>{code[i] ?? ''}</Text>
              </View>;
            })}
            <TextInput ref={input} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} caretHidden autoComplete="one-time-code"
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
          </Pressable>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 15, color: t.ink }}>{finishing ? 'After photos' : 'Before photos'}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 12, color: t.muted }}>Optional</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {thumbs.map((u, i) => <Image key={i} source={{ uri: u }} accessibilityLabel={`Photo ${i + 1}`} style={{ width: 72, height: 72, borderRadius: R.md, backgroundColor: t.surface }} />)}
              {thumbs.length < 4 && <Pressable onPress={onPhoto} accessibilityRole="button" accessibilityLabel="Add photo" style={({ pressed }) => ({ width: 72, height: 72, borderRadius: R.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? t.surface : 'transparent' })}>
                <Text style={{ fontSize: 24, color: t.muted, lineHeight: 26 }}>+</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 11, color: t.muted }}>Add</Text>
              </Pressable>}
            </ScrollView>
          </View>

          {!!error && <View style={{ backgroundColor: t.badBg, borderRadius: R.sm, padding: 12 }}><Text style={{ color: t.bad, fontFamily: font.medium, fontSize: 14 }}>{error}</Text></View>}

          <View style={{ gap: 8 }}>
            <Pressable onPress={() => ready && !busy && onSubmit(code)} disabled={!ready || busy} accessibilityRole="button" accessibilityState={{ disabled: !ready || !!busy }}
              style={({ pressed }) => ({ minHeight: 56, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? '#27272A' : t.ink, opacity: ready ? 1 : 0.4 })}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontFamily: font.semibold, fontSize: 16 }}>{finishing ? 'Mark complete' : 'Start work'}</Text>}
            </Pressable>
            {!!hint && <Text style={{ textAlign: 'center', fontFamily: font.regular, fontSize: 13, color: t.muted }}>{hint}</Text>}
            <Pressable onPress={onClose} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.medium, fontSize: 15, color: t.muted }}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
