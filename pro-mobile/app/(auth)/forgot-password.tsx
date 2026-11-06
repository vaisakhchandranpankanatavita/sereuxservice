import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Link } from 'expo-router';
import { api } from '../../src/api';
import { Button, Field, Txt, Wordmark, useTheme } from '../../src/ui';

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

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.brand }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 }}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <View style={{ backgroundColor: t.brandInk, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 16 }}>
          <Wordmark size={30} />
        </View>
        <Txt color={t.brandInk} bold size={13} style={{ marginTop: 10, letterSpacing: 2, textTransform: 'uppercase' }}>Pro</Txt>
      </View>
      <View style={{ backgroundColor: t.card, borderRadius: 24, padding: 20, gap: 12 }}>
        <Txt bold size={22}>Reset your password</Txt>
        {sent ? (
          <Txt muted>If that email has a linked account, a reset link is on its way. Open it on your phone or computer to finish — it expires in 30 minutes.</Txt>
        ) : (
          <>
            <Txt muted>Enter your account email and we’ll send a reset link.</Txt>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" onSubmitEditing={submit} />
            {!!err && <Txt color={t.bad}>{err}</Txt>}
            <Button title="Send reset link" onPress={submit} busy={busy} disabled={!email} />
          </>
        )}
      </View>
      <Link href="/login" style={{ textAlign: 'center', color: t.brandInk, padding: 8 }}>Back to sign in</Link>
    </ScrollView>
  </KeyboardAvoidingView>;
}
