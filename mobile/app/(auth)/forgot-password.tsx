import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { api } from '../../src/api';
import AuthHero from '../../src/AuthHero';
import { Button, Field, Txt, useTheme } from '../../src/ui';

export default function ForgotPassword() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr('');
    try { await api('/auth/forgot-password', 'POST', { email: email.trim() }); setSent(true); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <AuthHero ratio={0.62} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', padding: 20, paddingBottom: 32, gap: 12 }}>
      <Txt bold size={30}>Reset your password.</Txt>
      {sent ? (
        <Txt muted>If that email has an account, a reset link is on its way. Open it on your phone or computer to finish — it expires in 30 minutes.</Txt>
      ) : (
        <>
          <Txt muted>Enter your account email and we’ll send a reset link.</Txt>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" onSubmitEditing={submit} />
          {!!err && <Txt color={t.bad}>{err}</Txt>}
          <Button title="Send reset link" onPress={submit} busy={busy} disabled={!email} />
        </>
      )}
      <Link href="/login" style={{ textAlign: 'center', color: t.ink, padding: 8 }}>Back to sign in</Link>
    </ScrollView>
  </KeyboardAvoidingView>;
}
