import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { SignInLoader } from '../src/loader';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { SessionProvider, useSession } from '../src/session';
import { ConfigGate, ConfigProvider, useConfig } from '../src/config';
import { onNotificationTap, registerPush } from '../src/push';
import { font, useTheme } from '../src/ui';
import { LiveTimer } from '../src/live';

function Gate() {
  const { user } = useSession();
  const { ready } = useConfig();
  const t = useTheme();
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Fraunces_600SemiBold });
  const segments = useSegments();
  const router = useRouter();
  const inAuth = segments[0] === '(auth)';

  useEffect(() => { if (user) registerPush(); }, [user?.id]);
  /* Web: size the app to the visible viewport (dvh), so the floating bottom bar is never pushed under the browser's own toolbar. */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = document.createElement('style');
    el.textContent = 'html,body,#root{height:100dvh;scroll-behavior:smooth;-webkit-overflow-scrolling:touch}' +
      'div{scroll-behavior:smooth;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain}' +
      /* Fast, quiet micro-interactions and a crisp keyboard focus ring (web only). */
      '[role=button],[role=tab],[role=switch],[role=link],input,textarea{transition:background-color .15s ease-out,border-color .15s ease-out,opacity .15s ease-out,transform .15s ease-out,box-shadow .15s ease-out}' +
      '[role=button]:focus-visible,[role=tab]:focus-visible,[role=switch]:focus-visible,[role=link]:focus-visible{outline:2px solid #2563EB;outline-offset:2px}' +
      'input:focus,textarea:focus{outline:none;border-color:#2563EB !important;box-shadow:0 0 0 3px rgba(37,99,235,.18)}' +
      '*{-webkit-font-smoothing:antialiased}' +
      /* Thin custom scrollbar (6px, inside the 12px topbar/bottombar gutter so it never tucks under them). */
      '*{scrollbar-width:thin;scrollbar-color:rgba(100,116,139,.45) transparent}' +
      '*::-webkit-scrollbar{width:6px;height:6px}' +
      '*::-webkit-scrollbar-track{background:transparent}' +
      '*::-webkit-scrollbar-thumb{background:rgba(100,116,139,.45);border-radius:3px}' +
      '*::-webkit-scrollbar-thumb:hover{background:rgba(100,116,139,.7)}';
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);
  useEffect(() => onNotificationTap((p) => router.push(p as any)), [router]);

  /* Fresh sign-in (null -> user): hold a branded loader for a couple of seconds while the app settles. */
  const prevUser = useRef<any>(undefined);
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    const was = prevUser.current;
    prevUser.current = user;
    if (was === null && user) {
      setWelcome(true);
      const id = setTimeout(() => setWelcome(false), 2500);
      return () => clearTimeout(id);
    }
  }, [user]);

  useEffect(() => {
    if (user === undefined) return;
    if (!user && !inAuth) router.replace('/login');
    else if (user && inAuth) router.replace('/');
  }, [user, inAuth, router]);

  if ((!fontsLoaded && !fontError) || user === undefined || !ready) return <SignInLoader name={user?.name} />;

  return <View style={{ flex: 1, backgroundColor: t.bg }}>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerStyle: { backgroundColor: t.bg }, headerShadowVisible: false, headerTintColor: t.ink, headerTitleStyle: { fontFamily: font.bold, fontSize: 16 }, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
    {!!user && !inAuth && <LiveTimer />}
    {welcome && <SignInLoader name={user?.name} />}
  </View>;
}

export default function Root() {
  return <ConfigProvider><ConfigGate><SessionProvider><Gate /></SessionProvider></ConfigGate></ConfigProvider>;
}
