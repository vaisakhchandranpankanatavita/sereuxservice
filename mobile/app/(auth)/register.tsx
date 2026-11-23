import { GoogleButton } from '../../src/google';
import { useState } from 'react';
import { Link } from 'expo-router';
import { useSession } from '../../src/session';
import AuthShell from '../../src/AuthHero';
import { Banner, Button, Field, Txt, useTheme } from '../../src/ui';

export default function Register() {
  const { register } = useSession();
  const t = useTheme();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setBusy(true); setErr('');
    try { await register({ ...f, name: f.name.trim() }); } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return <AuthShell ratio={0.5}>
      <Txt bold size={28}>Create your account</Txt>
      <GoogleButton />
      <Field label="Full name" value={f.name} onChangeText={set('name')} autoComplete="name" />
      <Field label="Email" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
      <Field label="Password (8+ characters)" value={f.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" />
      {!!err && <Banner kind="bad">{err}</Banner>}
      <Button title="Create account" onPress={submit} busy={busy} disabled={!f.name || !f.email || !f.phone || f.password.length < 8} />
      <Link href="/login" style={{ textAlign: 'center', color: t.ink, padding: 8, fontWeight: '600' }}>Already have an account? Sign in</Link>
  </AuthShell>;
}
