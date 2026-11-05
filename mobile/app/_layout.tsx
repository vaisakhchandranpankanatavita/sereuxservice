import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../src/session';
import { CartProvider } from '../src/cart';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { font, useTheme } from '../src/ui';

function Gate() {
  const { user } = useSession();
  const t = useTheme();
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold, Inter_800ExtraBold });
  const segments = useSegments();
  const router = useRouter();
  const inAuth = segments[0] === '(auth)';

  useEffect(() => {
    if (user === undefined) return;
    if (!user && !inAuth) router.replace('/login');
    else if (user && inAuth) router.replace('/');
  }, [user, inAuth, router]);

  if (user === undefined || (!fontsLoaded && !fontError)) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.bg }}><ActivityIndicator color={t.brand} /></View>;

  return <>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerStyle: { backgroundColor: t.bg }, headerShadowVisible: false, headerTintColor: t.ink, headerTitleStyle: { fontFamily: font.bold, fontSize: 16 }, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="service/[id]" options={{ title: 'Service' }} />
      <Stack.Screen name="service/book" options={{ title: 'Book a pro' }} />
      <Stack.Screen name="booking/[id]" options={{ title: 'Booking' }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Product' }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Order' }} />
      <Stack.Screen name="cart" options={{ title: 'Cart' }} />
      <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
    </Stack>
  </>;
}

export default function Root() {
  return <SessionProvider><CartProvider><Gate /></CartProvider></SessionProvider>;
}
