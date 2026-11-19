import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { api } from '../../src/api';
import { font } from '../../src/ui';
import { Field, Hero, palette, useReducedMotion, useStagger } from '../../src/authkit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const dark = useColorScheme() === 'dark';
  const c = useMemo(() => palette(dark), [dark]);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const reduced = useReducedMotion();
  const at = useStagger(reduced);
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = EMAIL_RE.test(email.trim());
  const emailErr = touched && (!email ? 'Enter your email address.' : !valid ? 'That doesn’t look like an email address.' : '');

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    setBusy(true); setErr('');
    try { await api('/auth/forgot-password', 'POST', { email: email.trim() }); setSent(true); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const form = <View style={wide ? { width: '45%', minWidth: 440, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg } : { backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, flexGrow: 1 }}>
    <View style={{ width: '100%', maxWidth: 420, padding: 24, paddingTop: wide ? 24 : 32, paddingBottom: 28, flexGrow: wide ? 0 : 1 }}>
      <Animated.View style={at(0)}>
        <Text accessibilityRole="header" style={{ color: c.ink, fontFamily: font.semibold, fontSize: 32, letterSpacing: -1, lineHeight: 36 }}>{sent ? 'Check your email' : 'Reset password'}</Text>
        <Text style={{ color: c.body, fontFamily: font.regular, fontSize: 16, lineHeight: 23, marginTop: 6, marginBottom: 26 }}>
          {sent ? 'If that email has a linked account, a reset link is on its way. It expires in 30 minutes.' : 'Enter your account email and we’ll send you a reset link.'}
        </Text>
      </Animated.View>

      {sent ? null : <>
        {err ? <View accessibilityRole="alert" style={{ borderLeftWidth: 3, borderLeftColor: c.bad, paddingLeft: 12, marginBottom: 18 }}>
          <Text style={{ color: c.bad, fontFamily: font.medium, fontSize: 14, lineHeight: 20 }}>{err}</Text>
        </View> : null}
        <Animated.View style={at(1)}>
          <Field c={c} label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress"
            returnKeyType="go" onSubmitEditing={submit} error={emailErr} onBlurValidate={() => setTouched(true)} placeholder="you@company.com" />
        </Animated.View>
        <Animated.View style={at(2)}>
          <Pressable onPress={submit} disabled={busy} accessibilityRole="button" accessibilityLabel="Send reset link" accessibilityState={{ disabled: busy, busy }}
            style={(st: any) => ({ marginTop: 6, backgroundColor: c.btn, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: busy ? 0.7 : valid ? (st.pressed ? 0.88 : 1) : 0.45, transform: [{ scale: st.pressed ? 0.98 : 1 }] })}>
            {busy ? <ActivityIndicator size="small" color={c.btnInk} /> : null}
            <Text style={{ color: c.btnInk, fontFamily: font.semibold, fontSize: 16 }}>{busy ? 'Sending' : 'Send reset link'}</Text>
          </Pressable>
        </Animated.View>
      </>}

      <Animated.View style={at(3)}>
        <Link href="/login" asChild>
          <Pressable accessibilityRole="link" style={{ height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
            <Text style={{ color: c.ink, fontFamily: font.medium, fontSize: 15 }}>Back to sign in</Text>
          </Pressable>
        </Link>
      </Animated.View>
    </View>
  </View>;

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ flexGrow: 1, flexDirection: wide ? 'row' : 'column' }}>
      <Hero c={c} reduced={reduced} fill={wide} />
      {form}
    </ScrollView>
  </KeyboardAvoidingView>;
}
