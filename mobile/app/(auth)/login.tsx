import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link } from 'expo-router';
import { useSession } from '../../src/session';
import { Button, Field, Screen, Txt, Wordmark, useTheme } from '../../src/ui';

export default function Login() {
  const { login } = useSession();
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr('');
    try { await login(email, password); } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen>
      <View style={{ height: 60 }} />
      <Wordmark size={44} />
      <Txt bold size={30} style={{ marginTop: 8 }}>Good help for the place you love.</Txt>
      <Txt muted>Sign in to book trusted pros and shop for your home.</Txt>
      <View style={{ height: 12 }} />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={submit} />
      {!!err && <Txt color={t.bad}>{err}</Txt>}
      <Button title="Sign in" onPress={submit} busy={busy} disabled={!email || !password} />
      <Link href="/register" style={{ textAlign: 'center', color: t.brand, padding: 10 }}>New here? Create an account</Link>
    </Screen>
  </KeyboardAvoidingView>;
}
