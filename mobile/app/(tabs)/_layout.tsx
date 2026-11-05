import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../src/cart';
import { Txt, font, useTheme } from '../../src/ui';

/* Active tab gets the filled glyph, a spring pop + lift, and a soft tinted pill behind it — all driven by
   RN's built-in Animated API (no extra animation dependency) so the swap from outline reads as smooth motion. */
function TabIcon({ outline, filled, focused, color, size }: { outline: any; filled: any; focused: boolean; color: string; size: number }) {
  const v = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => { Animated.spring(v, { toValue: focused ? 1 : 0, useNativeDriver: true, friction: 6, tension: 140 }).start(); }, [focused]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const lift = v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const pillScale = v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return <Animated.View style={{ width: 40, height: 30, alignItems: 'center', justifyContent: 'center', transform: [{ translateY: lift }] }}>
    <Animated.View style={{ position: 'absolute', width: 34, height: 30, borderRadius: 14, backgroundColor: 'rgba(20,20,18,0.08)', opacity: v, transform: [{ scale: pillScale }] }} />
    <Animated.View style={{ transform: [{ scale }] }}><Ionicons name={focused ? filled : outline} color={color} size={size} /></Animated.View>
  </Animated.View>;
}

export default function TabsLayout() {
  const t = useTheme();
  const { count } = useCart();
  const router = useRouter();
  const icon = (outline: any, filled: any) => ({ color, size, focused }: { color: any; size: number; focused: boolean }) =>
    <TabIcon outline={outline} filled={filled} focused={focused} color={color} size={size} />;
  const label = (title: string) => ({ color, focused }: { color: any; focused: boolean }) =>
    <Text style={{ color, fontFamily: focused ? font.bold : font.medium, fontSize: 11 }}>{title}</Text>;

  return <Tabs screenOptions={{
    tabBarActiveTintColor: t.ink, tabBarInactiveTintColor: t.muted,
    tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.line },
    headerStyle: { backgroundColor: t.bg }, headerShadowVisible: false, headerTintColor: t.ink, headerTitleStyle: { fontFamily: font.bold, fontSize: 16 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Services', tabBarIcon: icon('construct-outline', 'construct'), tabBarLabel: label('Services') }} />
    <Tabs.Screen name="shop" options={{
      title: 'Shop', tabBarIcon: icon('bag-outline', 'bag'), tabBarLabel: label('Shop'),
      headerRight: () => <Pressable onPress={() => router.push('/cart')} accessibilityLabel={`Cart, ${count} items`} style={{ marginRight: 16 }}>
        <Ionicons name="cart-outline" size={24} color={t.ink} />
        {count > 0 && <Txt size={11} bold color={t.brandInk} style={{ position: 'absolute', top: -6, right: -8, backgroundColor: t.ink, borderRadius: 9, minWidth: 18, textAlign: 'center', paddingHorizontal: 3, overflow: 'hidden' }}>{count}</Txt>}
      </Pressable>,
    }} />
    <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon('receipt-outline', 'receipt'), tabBarLabel: label('Activity') }} />
    <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('person-outline', 'person'), tabBarLabel: label('Account') }} />
  </Tabs>;
}
