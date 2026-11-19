import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, useColorScheme, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, Rect } from 'react-native-svg';
import { Link } from 'expo-router';
import { useSession } from '../../src/session';
import { font } from '../../src/ui';

/* Dev-only convenience: release builds (__DEV__ false) start with an empty form. In dev, prefill the seeded demo pro
   (backend `npm run seed:demo`) that has jobs, earnings and reviews. */
const PREFILL = __DEV__ ? { email: 'pro1@fixzy.test', password: 'Demo@12345' } : { email: '', password: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mono = Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', default: 'monospace' }) as string;
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const VERSION = '1.0.0';
const STAGES = ['Confirmed', 'On the way', 'Working', 'Done'];

/* Light and dark tokens: warm stone surfaces, hairline borders, one tan accent. */
const palette = (dark: boolean) => dark
  ? { bg: '#141412', panel: '#1b1b19', ink: '#f4f3ef', body: '#a8a59d', line: '#262626', field: '#141412', accent: '#c9a679', btn: '#f4f3ef', btnInk: '#111111', bad: '#e07a68', badBg: 'rgba(224,122,104,0.12)', grid: '#34332f' }
  : { bg: '#faf9f6', panel: '#f4f3ef', ink: '#111111', body: '#5f5c55', line: '#e5e5e5', field: '#ffffff', accent: '#a07f52', btn: '#111111', btnInk: '#ffffff', bad: '#a13a2a', badBg: '#f6e6e1', grid: '#d6d3cb' };
type P = ReturnType<typeof palette>;

/* Geometric wordmark: an ink square with a constructed "f" and a tan full stop, then the name and a mono tag. */
function Brand({ c }: { c: P }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <Svg width={28} height={28} viewBox="0 0 28 28" accessibilityLabel="Fixzy">
      <Rect width={28} height={28} rx={7} fill={c.ink} />
      <Rect x={11} y={7} width={3} height={14} fill={c.bg} />
      <Rect x={8} y={11} width={9} height={3} fill={c.bg} />
      <Rect x={14} y={7} width={5} height={3} fill={c.bg} />
      <Circle cx={21} cy={20} r={2} fill={c.accent} />
    </Svg>
    <Text style={{ color: c.ink, fontFamily: font.bold, fontSize: 19, letterSpacing: -0.8 }}>fixzy</Text>
    <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: c.body, fontFamily: mono, fontSize: 10, letterSpacing: 1 }}>PRO</Text>
    </View>
  </View>;
}

/* Labelled input: crisp top label, 1px border, 2px ink ring on focus, inline message that fades in without moving the layout. */
function Field({ c, label, error, right, inputRef, onBlurValidate, ...p }: any) {
  const [focus, setFocus] = useState(false);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: error ? 1 : 0, duration: 320, easing: EASE, useNativeDriver: false }).start(); }, [error, a]);
  return <View style={{ gap: 6 }}>
    <Text style={{ color: c.ink, fontFamily: font.medium, fontSize: 13 }}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.field, borderRadius: 6, borderWidth: focus ? 2 : 1, borderColor: error ? c.bad : focus ? c.ink : c.line, paddingHorizontal: focus ? 11 : 12 }}>
      <TextInput ref={inputRef} accessibilityLabel={label} placeholderTextColor={c.body} onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); onBlurValidate?.(); }}
        {...p} style={[{ flex: 1, paddingVertical: 11, fontSize: 15, fontFamily: font.regular, color: c.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]} />
      {right}
    </View>
    <View style={{ minHeight: 18 }}>
      <Animated.Text accessibilityLiveRegion="polite" style={{ color: c.bad, fontFamily: font.regular, fontSize: 12.5, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }] }}>{error || ' '}</Animated.Text>
    </View>
  </View>;
}

/* Right panel: a dot-grid canvas with a quiet dial. The needle eases toward the cursor; the ticker steps through the real job lifecycle. */
function Canvas({ c }: { c: P }) {
  const box = useRef<any>(null);
  const rot = useRef(new Animated.Value(0)).current;
  const last = useRef(0);
  const [stage, setStage] = useState(0);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const move = (e: MouseEvent) => {
      const r = box.current?.getBoundingClientRect?.();
      if (!r) return;
      const deg = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90;
      let d = deg - (last.current % 360); /* shortest way round, so the needle never spins the long way */
      if (d > 180) d -= 360; if (d < -180) d += 360;
      last.current += d;
      Animated.spring(rot, { toValue: last.current, stiffness: 60, damping: 14, mass: 1, useNativeDriver: false }).start();
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [rot]);
  useEffect(() => { const i = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 2200); return () => clearInterval(i); }, []);
  useEffect(() => { const i = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(i); }, []);

  const S = 420, C = S / 2;
  const ticks = Array.from({ length: 48 }, (_, i) => i);
  return <View style={{ flex: 1, backgroundColor: c.panel, overflow: 'hidden' }}>
    <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
      <Defs><Pattern id="dots" width={22} height={22} patternUnits="userSpaceOnUse"><Circle cx={1.5} cy={1.5} r={1} fill={c.grid} /></Pattern></Defs>
      <Rect width="100%" height="100%" fill="url(#dots)" />
    </Svg>
    <View style={{ flex: 1, padding: 40, justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.body, fontFamily: mono, fontSize: 11, letterSpacing: 1 }}>PROVIDER APP</Text>
        <Text style={{ color: c.body, fontFamily: mono, fontSize: 11, letterSpacing: 1 }}>{clock.toLocaleTimeString('en-GB')}</Text>
      </View>

      <View style={{ alignItems: 'center' }}>
        <View ref={box} style={{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ position: 'absolute' }}>
            {[70, 120, 170, 205].map((r) => <Circle key={r} cx={C} cy={C} r={r} fill="none" stroke={c.grid} strokeWidth={1} />)}
            {ticks.map((i) => { const a = (i * 7.5 * Math.PI) / 180, major = i % 6 === 0, r1 = 205, r2 = major ? 192 : 198;
              return <Line key={i} x1={C + Math.sin(a) * r1} y1={C - Math.cos(a) * r1} x2={C + Math.sin(a) * r2} y2={C - Math.cos(a) * r2} stroke={c.ink} strokeWidth={major ? 1.5 : 1} opacity={major ? 0.7 : 0.3} />; })}
          </Svg>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', width: S, height: S, transform: [{ rotate: rot.interpolate({ inputRange: [-100000, 100000], outputRange: ['-100000deg', '100000deg'] }) }] }}>
            <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
              <Line x1={C} y1={C} x2={C} y2={C - 172} stroke={c.ink} strokeWidth={1.5} />
              <Circle cx={C} cy={C - 172} r={5} fill={c.accent} />
              <Circle cx={C} cy={C} r={5} fill={c.ink} />
            </Svg>
          </Animated.View>
        </View>
      </View>

      <View style={{ gap: 18 }}>
        <Text style={{ color: c.ink, fontFamily: font.display, fontSize: 44, lineHeight: 48, letterSpacing: -1.5, maxWidth: 520 }}>Your next job is already nearby.</Text>
        <View style={{ flexDirection: 'row', gap: 0, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12 }}>
          {STAGES.map((s, i) => <View key={s} style={{ flex: 1 }}>
            <Text style={{ color: i === stage ? c.ink : c.body, opacity: i === stage ? 1 : 0.5, fontFamily: mono, fontSize: 11, letterSpacing: 0.6 }}>{`0${i + 1}`}  {s.toUpperCase()}</Text>
            <View style={{ height: 2, marginTop: 8, marginRight: 8, backgroundColor: i === stage ? c.accent : 'transparent' }} />
          </View>)}
        </View>
      </View>
    </View>
  </View>;
}

export default function Login() {
  const { login, error } = useSession();
  const scheme = useColorScheme();
  const c = palette(scheme === 'dark');
  const { width } = useWindowDimensions();
  const wide = width >= 900;
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
  const bannerA = useRef(new Animated.Value(0)).current;
  const message = err || error;
  useEffect(() => { Animated.timing(bannerA, { toValue: message ? 1 : 0, duration: 360, easing: EASE, useNativeDriver: false }).start(); }, [message, bannerA]);

  const submit = async () => {
    setTouched({ email: true, password: true });
    if (!valid) return;
    setBusy(true); setErr('');
    try { await login(email.trim(), password); } catch (e: any) { setErr(e.message || error || 'Sign-in failed. Check your details and try again.'); } finally { setBusy(false); }
  };

  const form = <View style={{ width: wide ? '45%' : '100%', minWidth: wide ? 440 : undefined, backgroundColor: c.bg, borderRightWidth: wide ? 1 : 0, borderRightColor: c.line, padding: wide ? 40 : 24, justifyContent: 'space-between', minHeight: wide ? undefined : 640 }}>
    <Brand c={c} />
    <View style={{ width: '100%', maxWidth: 360, alignSelf: 'center', paddingVertical: 32 }}>
      <Text accessibilityRole="header" style={{ color: c.ink, fontFamily: font.medium, fontSize: 30, letterSpacing: -1.2, lineHeight: 34 }}>Sign in to Fixzy Pro</Text>
      <Text style={{ color: c.body, fontFamily: font.regular, fontSize: 14.5, lineHeight: 21, marginTop: 8, marginBottom: 26 }}>Provider access. Your admin team creates and manages accounts.</Text>

      <Animated.View accessibilityRole="alert" style={{ overflow: 'hidden', height: bannerA.interpolate({ inputRange: [0, 1], outputRange: [0, 52] }), opacity: bannerA }}>
        <View style={{ backgroundColor: c.badBg, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: c.bad, paddingVertical: 10, paddingHorizontal: 12, height: 44, justifyContent: 'center' }}>
          <Text numberOfLines={2} style={{ color: c.bad, fontFamily: font.medium, fontSize: 13 }}>{message}</Text>
        </View>
      </Animated.View>

      <Field c={c} label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress"
        returnKeyType="next" onSubmitEditing={() => pw.current?.focus()} error={emailErr} onBlurValidate={() => setTouched((s) => ({ ...s, email: true }))} placeholder="you@company.com" />
      <Field c={c} label="Password" inputRef={pw} value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="password" textContentType="password" returnKeyType="go"
        onSubmitEditing={submit} error={pwErr} onBlurValidate={() => setTouched((s) => ({ ...s, password: true }))}
        right={<Pressable onPress={() => setShow((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'} style={{ paddingLeft: 10 }}>
          <Text style={{ color: c.body, fontFamily: mono, fontSize: 11, letterSpacing: 0.8 }}>{show ? 'HIDE' : 'SHOW'}</Text>
        </Pressable>} />

      <Pressable onPress={submit} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }}
        style={({ pressed }) => ({ marginTop: 6, backgroundColor: c.btn, borderRadius: 6, height: 46, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: valid || busy ? 1 : 0.55, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
        {busy && <ActivityIndicator size="small" color={c.btnInk} />}
        <Text style={{ color: c.btnInk, fontFamily: font.bold, fontSize: 15 }}>{busy ? 'Signing in' : 'Sign in'}</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.line }} /><Text style={{ color: c.body, fontFamily: mono, fontSize: 10.5, letterSpacing: 1 }}>NEED HELP</Text><View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
      </View>
      <Link href="/forgot-password" style={{ textAlign: 'center', color: c.ink, fontFamily: font.medium, fontSize: 14, borderWidth: 1, borderColor: c.line, borderRadius: 6, paddingVertical: 12, overflow: 'hidden' }}>Reset your password</Link>
      <Text style={{ color: c.body, fontFamily: font.regular, fontSize: 12.5, lineHeight: 18, marginTop: 18 }}>Booking a service instead? That’s the Fixzy customer app. This one is only for providers.</Text>
    </View>
    <Text style={{ color: c.body, fontFamily: mono, fontSize: 10.5, letterSpacing: 1 }}>FIXZY PRO  v{VERSION}</Text>
  </View>;

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, flexDirection: wide ? 'row' : 'column' }}>
      {form}
      {wide && <Canvas c={c} />}
    </ScrollView>
  </KeyboardAvoidingView>;
}
