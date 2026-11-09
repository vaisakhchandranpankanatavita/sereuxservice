import { useState } from 'react';
import { Link } from 'expo-router';
import { useSession } from '../../src/session';
import AuthShell from '../../src/AuthHero';
import { Banner, Button, Field, Txt, useTheme } from '../../src/ui';

export default function Login() {
  const { login } = useSession();
  const t = useTheme();
  const [email, setEmail] = useState('test@fixzy.app'); // TODO: remove demo prefill before real release
  const [password, setPassword] = useState('testpass123');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr('');
    try { await login(email, password); } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return <AuthShell ratio={0.5}>
      <Txt bold size={32}>Good help for the place you love.</Txt>
      <Txt muted>Sign in to book trusted pros and shop for your home.</Txt>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={submit} />
      {!!err && <Banner kind="bad">{err}</Banner>}
      <Button title="Sign in" onPress={submit} busy={busy} disabled={!email || !password} />
      <Link href="/forgot-password" style={{ textAlign: 'center', color: t.ink, padding: 8, fontWeight: '600' }}>Forgot password?</Link>
      <Link href="/register" style={{ textAlign: 'center', color: t.ink, padding: 8, fontWeight: '600' }}>New here? Create an account</Link>
  </AuthShell>;
}
