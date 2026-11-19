import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { useSession } from '../../src/session';
import { font } from '../../src/ui';
import { Field, Hero, palette, useReducedMotion, useStagger } from '../../src/authkit';

/* Dev-only convenience: release builds (__DEV__ false) start with an empty form. In dev, prefill the seeded demo pro
   (backend `npm run seed:demo`) that has jobs, earnings and reviews. */
const PREFILL = __DEV__ ? { email: 'pro1@fixzy.test', password: 'Demo@12345' } : { email: '', password: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login, error } = useSession();
  const dark = useColorScheme() === 'dark';
  const c = useMemo(() => palette(dark), [dark]);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const reduced = useReducedMotion();
  const at = useStagger(reduced);
  const pw = useRef<any>(null);
  const [email, setEmail] = useState(PREFILL.email);
  const [password, setPassword] = useState(PREFILL.password);
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const emailErr = touched.email && (!email ? 'Enter your email address.' : !EMAIL_RE.test(email) ? 'That doesn’t look like an email address.' : '');
  const pwErr = touched.password && !password ? 'Enter your password.' : '';
  const valid = EMAIL_RE.test(email) && !!password;
  const message = err || error;

  const submit = async () => {
    setTouched({ email: true, password: true });
    if (!valid) return;
    setBusy(true); setErr('');
    try { await login(email.trim(), password); } catch (e: any) { setErr(e.message || error || 'Sign-in failed. Check your details and try again.'); } finally { setBusy(false); }
  };

  const form = <View style={wide ? { width: '45%', minWidth: 440, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg } : { backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, flexGrow: 1 }}>
    <View style={{ width: '100%', maxWidth: 420, padding: 24, paddingTop: wide ? 24 : 32, paddingBottom: 28, flexGrow: wide ? 0 : 1 }}>
      <Animated.View style={at(0)}>
        <Text accessibilityRole="header" style={{ color: c.ink, fontFamily: font.semibold, fontSize: 32, letterSpacing: -1, lineHeight: 36 }}>Sign in</Text>
        <Text style={{ color: c.body, fontFamily: font.regular, fontSize: 16, lineHeight: 23, marginTop: 6, marginBottom: 26 }}>Use the account your Fixzy admin created for you.</Text>
      </Animated.View>

      {message ? <View accessibilityRole="alert" style={{ borderLeftWidth: 3, borderLeftColor: c.bad, paddingLeft: 12, marginBottom: 18 }}>
        <Text style={{ color: c.bad, fontFamily: font.medium, fontSize: 14, lineHeight: 20 }}>{message}</Text>
      </View> : null}

      <Animated.View style={at(1)}>
        <Field c={c} label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress"
          returnKeyType="next" onSubmitEditing={() => pw.current?.focus()} error={emailErr} onBlurValidate={() => setTouched((s) => ({ ...s, email: true }))} placeholder="you@company.com" />
      </Animated.View>
      <Animated.View style={at(2)}>
        <Field c={c} label="Password" inputRef={pw} value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="password" textContentType="password" returnKeyType="go"
          onSubmitEditing={submit} error={pwErr} onBlurValidate={() => setTouched((s) => ({ ...s, password: true }))}
          right={<Pressable onPress={() => setShow((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'} style={{ minWidth: 48, height: 48, alignItems: 'flex-end', justifyContent: 'center' }}>
            <Text style={{ color: c.body, fontFamily: font.medium, fontSize: 14 }}>{show ? 'Hide' : 'Show'}</Text>
          </Pressable>} />
      </Animated.View>

      <Animated.View style={at(3)}>
        <Pressable onPress={submit} disabled={busy} accessibilityRole="button" accessibilityLabel="Sign in" accessibilityState={{ disabled: busy, busy }}
          style={(st: any) => ({ marginTop: 6, backgroundColor: c.btn, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: busy ? 0.7 : valid ? (st.pressed ? 0.88 : 1) : 0.45, transform: [{ scale: st.pressed ? 0.98 : 1 }] })}>
          {busy ? <ActivityIndicator size="small" color={c.btnInk} /> : null}
          <Text style={{ color: c.btnInk, fontFamily: font.semibold, fontSize: 16 }}>{busy ? 'Signing in' : 'Sign in'}</Text>
        </Pressable>
        <Link href="/forgot-password" asChild>
          <Pressable accessibilityRole="link" style={{ height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
            <Text style={{ color: c.ink, fontFamily: font.medium, fontSize: 15 }}>Forgot password?</Text>
          </Pressable>
        </Link>
      </Animated.View>

      <Animated.View style={[{ flexGrow: 1, justifyContent: 'flex-end', paddingTop: 20 }, at(4)]}>
        <Text style={{ color: c.body, fontFamily: font.regular, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>For Fixzy providers only. Booking a service? Use the Fixzy customer app.</Text>
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
