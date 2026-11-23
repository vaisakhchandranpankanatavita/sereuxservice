import { Tabs } from 'expo-router';
import { useConfig } from '../../src/config';

/* The tab bar is hidden — the global BottomBar in app/_layout.tsx replaces it so navigation stays
   visible on every screen. Each tab draws its own big title in the page body, so no native header. */
export default function TabsLayout() {
  const { get } = useConfig();
  return <Tabs screenOptions={{ tabBarStyle: { display: 'none' }, headerShown: false, sceneStyle: { backgroundColor: '#ffffff' }, animation: 'fade' }}>
    <Tabs.Screen name="index" options={{ title: 'Services' }} />
    <Tabs.Screen name="shop" options={{ title: 'Shop', href: get('flags.shopEnabled') ? undefined : null }} />
    <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
    <Tabs.Screen name="account" options={{ title: 'Account' }} />
  </Tabs>;
}
