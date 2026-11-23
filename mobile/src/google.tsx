import { useState } from 'react';
import { View } from 'react-native';
import { useSession } from './session';
import { Banner, Button, Txt } from './ui';

/* "Continue with Google". Needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (the *web* OAuth client ID, used to mint the
   ID token the API verifies) and a dev/release build: the native module isn't in Expo Go, so it is loaded lazily
   and the button simply hides itself when it (or the client ID) is missing. */
const WEB_CLIENT_ID: string | undefined = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID; // inlined at build time by the build script
let gs: any = null;
try { if (WEB_CLIENT_ID) { gs = require('@react-native-google-signin/google-signin'); gs.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID }); } } catch { gs = null; }

export function GoogleButton() {
  const { loginGoogle } = useSession();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!gs) return null;
  const go = async () => {
    setBusy(true); setErr('');
    try {
      await gs.GoogleSignin.hasPlayServices();
      const r = await gs.GoogleSignin.signIn();
      const idToken = r?.data?.idToken ?? r?.idToken;
      if (!idToken) { setBusy(false); return; } /* user cancelled */
      await loginGoogle(idToken);
    } catch (e: any) {
      if (e?.code !== gs.statusCodes?.SIGN_IN_CANCELLED) setErr(e?.message || 'Google sign-in failed.');
      setBusy(false);
    }
  };
  return <View style={{ gap: 12 }}>
    <Button title="Continue with Google" kind="ghost" onPress={go} busy={busy} />
    {!!err && <Banner kind="bad">{err}</Banner>}
    <Txt muted style={{ textAlign: 'center' }}>or</Txt>
  </View>;
}
