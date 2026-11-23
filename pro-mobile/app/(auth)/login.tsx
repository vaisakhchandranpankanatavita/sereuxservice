import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { useSession } from '../../src/session';
import { font } from '../../src/ui';
import { Brand, Field, GradientBackdrop, palette, useReducedMotion, useStagger } from '../../src/authkit';

/* Dev-only convenience: release builds (__DEV__ false) start with an empty form. In dev, prefill the seeded demo pro
   (backend `npm run seed:demo`) that has jobs, earnings and reviews. */
const PREFILL = { email: 'pro1@fixzy.test', password: 'Demo@12345' }; /* prefilled for now (demo access); restore the __DEV__ gate before go-live */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login, error } = useSession();
  const dark = true; /* login always uses the dark gradient, regardless of the OS theme */
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

  const form = <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
    <View style={{ width: '100%', maxWidth: 440, padding: 24, paddingTop: 32, paddingBottom: 28, borderRadius: 28, backgroundColor: dark ? 'rgba(11,11,12,0.55)' : 'rgba(255,255,255,0.62)', borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.8)' }}>
      <Animated.View style={at(0)}>
        <Text accessibilityRole="header" style={{ color: c.ink, fontFamily: font.bold, fontSize: 34, letterSpacing: -1.1, lineHeight: 38 }}>Sign in</Text>
        <Text style={{ color: c.body, fontFamily: font.regular, fontSize: 15.5, lineHeight: 22, marginTop: 8, marginBottom: 28 }}>Use the account your Fixzy admin created for you.</Text>
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
          style={(st: any) => ({ marginTop: 8, backgroundColor: c.btn, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: busy ? 0.7 : valid ? (st.pressed ? 0.88 : 1) : 0.45, transform: [{ scale: st.pressed ? 0.98 : 1 }] })}>
          {busy ? <ActivityIndicator size="small" color={c.btnInk} /> : null}
          <Text style={{ color: c.btnInk, fontFamily: font.semibold, fontSize: 16, letterSpacing: -0.2 }}>{busy ? 'Signing in' : 'Sign in'}</Text>
        </Pressable>
        <Link href="/forgot-password" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Forgot password" hitSlop={8}
            style={(st: any) => ({ marginTop: 22, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 10 })}>
            <Text style={{ color: c.body, fontFamily: font.medium, fontSize: 14.5, textAlign: 'center' }}>Forgot your password? <Text style={{ color: c.ink, fontFamily: font.semibold }}>Reset it</Text></Text>
          </Pressable>
        </Link>
      </Animated.View>

      <Animated.View style={[{ paddingTop: 26 }, at(4)]}>
        <Text style={{ color: c.body, fontFamily: font.regular, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>For Fixzy providers only. Booking a service? Use the Fixzy customer app.</Text>
      </Animated.View>
    </View>
  </View>;

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: dark ? '#16233F' : '#D9DDEE' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <GradientBackdrop dark={dark} reduced={reduced} />
    <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ flexGrow: 1, paddingTop: 48 }}>
      <View style={{ alignItems: 'center' }}><Brand ink={c.ink} bg={dark ? '#0B0B0C' : '#FFFFFF'} accent={c.accent} tag={c.body} /></View>
      {form}
    </ScrollView>
  </KeyboardAvoidingView>;
}
