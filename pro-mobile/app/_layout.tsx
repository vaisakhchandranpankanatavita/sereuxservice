import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { SessionProvider, useSession } from '../src/session';
import { onNotificationTap, registerPush } from '../src/push';
import { font, useTheme } from '../src/ui';
import { LiveTimer } from '../src/live';

function Gate() {
  const { user } = useSession();
  const t = useTheme();
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold, Inter_800ExtraBold, Fraunces_600SemiBold, Fraunces_700Bold });
  const segments = useSegments();
  const router = useRouter();
  const inAuth = segments[0] === '(auth)';

  useEffect(() => { if (user) registerPush(); }, [user?.id]);
  /* Web: size the app to the visible viewport (dvh), so the floating bottom bar is never pushed under the browser's own toolbar. */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = document.createElement('style');
    el.textContent = 'html,body,#root{height:100dvh}';
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);
  useEffect(() => onNotificationTap((p) => router.push(p as any)), [router]);

  useEffect(() => {
    if (user === undefined) return;
    if (!user && !inAuth) router.replace('/login');
    else if (user && inAuth) router.replace('/');
  }, [user, inAuth, router]);

  if ((!fontsLoaded && !fontError) || user === undefined) return <View style={{ flex: 1, backgroundColor: '#141412' }} />;

  return <View style={{ flex: 1, backgroundColor: t.bg }}>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerStyle: { backgroundColor: t.bg }, headerShadowVisible: false, headerTintColor: t.ink, headerTitleStyle: { fontFamily: font.bold, fontSize: 16 }, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
    {!!user && !inAuth && <LiveTimer />}
  </View>;
}

export default function Root() {
  return <SessionProvider><Gate /></SessionProvider>;
}
