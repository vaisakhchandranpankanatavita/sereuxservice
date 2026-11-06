import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { font, useTheme } from '../../src/ui';

export default function TabsLayout() {
  const t = useTheme();
  return <Tabs screenOptions={{
    tabBarActiveTintColor: t.ink, tabBarInactiveTintColor: t.muted,
    tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.line },
    headerStyle: { backgroundColor: t.bg }, headerShadowVisible: false, headerTintColor: t.ink, headerTitleStyle: { fontFamily: font.bold, fontSize: 16 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Requests', tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" color={(color as string) ?? t.ink} size={size} /> }} />
    <Tabs.Screen name="jobs" options={{ title: 'My jobs', tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" color={(color as string) ?? t.ink} size={size} /> }} />
    <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={(color as string) ?? t.ink} size={size} /> }} />
  </Tabs>;
}
