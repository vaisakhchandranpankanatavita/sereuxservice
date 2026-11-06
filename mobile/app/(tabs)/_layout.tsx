import { Pressable } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../src/cart';
import { Txt, font, useTheme } from '../../src/ui';

/* The tab bar itself is hidden here — the global BottomBar in app/_layout.tsx replaces it so
   navigation stays visible on every screen, not just these four. This layout now only supplies
   each screen's title/header (e.g. the cart icon on Shop). */
export default function TabsLayout() {
  const t = useTheme();
  const { count } = useCart();
  const router = useRouter();

  return <Tabs screenOptions={{
    tabBarStyle: { display: 'none' },
    headerStyle: { backgroundColor: t.bg }, headerShadowVisible: false, headerTintColor: t.ink, headerTitleStyle: { fontFamily: font.bold, fontSize: 16 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Services' }} />
    <Tabs.Screen name="shop" options={{
      title: 'Shop',
      headerRight: () => <Pressable onPress={() => router.push('/cart')} accessibilityLabel={`Cart, ${count} items`} style={{ marginRight: 16 }}>
        <Ionicons name="cart-outline" size={24} color={t.ink} />
        {count > 0 && <Txt size={11} bold color={t.brandInk} style={{ position: 'absolute', top: -6, right: -8, backgroundColor: t.ink, borderRadius: 9, minWidth: 18, textAlign: 'center', paddingHorizontal: 3, overflow: 'hidden' }}>{count}</Txt>}
      </Pressable>,
    }} />
    <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
    <Tabs.Screen name="account" options={{ title: 'Account' }} />
  </Tabs>;
}
