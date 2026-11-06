import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSession } from '../../src/session';
import { Button, Field, Txt, Wordmark, useTheme } from '../../src/ui';

export default function Login() {
  const { login, error } = useSession();
  const t = useTheme();
  const [email, setEmail] = useState('pro@fixzy.app'); // TODO: remove demo prefill before real release
  const [password, setPassword] = useState('testpass123');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr('');
    try { await login(email, password); } catch (e: any) { setErr(e.message || error); } finally { setBusy(false); }
  };

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.brand }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 }}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <View style={{ backgroundColor: t.brandInk, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 16 }}>
          <Wordmark size={30} />
        </View>
        <Txt color={t.brandInk} bold size={13} style={{ marginTop: 10, letterSpacing: 2, textTransform: 'uppercase' }}>Pro</Txt>
      </View>
      <View style={{ backgroundColor: t.card, borderRadius: 24, padding: 20, gap: 12 }}>
        <Txt bold size={22}>Sign in to work</Txt>
        <Txt muted>Accept jobs, track your route and get paid. For verified service pros only.</Txt>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={submit} />
        {!!(err || error) && <Txt color={t.bad}>{err || error}</Txt>}
        <Button title="Sign in" onPress={submit} busy={busy} disabled={!email || !password} />
      </View>
      <Txt color={t.brandInk} muted size={13} style={{ textAlign: 'center', marginTop: 8 }}>Not linked to a provider profile yet? Ask the admin team to set up your account.</Txt>
    </ScrollView>
  </KeyboardAvoidingView>;
}
