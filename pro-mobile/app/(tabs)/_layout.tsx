import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PulseDot, Txt, Wordmark, useOnlineFlag, setOnlineFlag, font, useTheme } from '../../src/ui';
import { Radar } from '../../src/radar';
import { useSession } from '../../src/session';
import { fetchMe } from '../../src/session';
import { useEffect, useRef, useState } from 'react';
import { LivePopup } from '../../src/livepopup';
import { BottomBar } from '../../src/bottombar';
import { Glass } from '../../src/glass';

/* While online the logo "lives": a soft emerald glow breathes behind it and the period turns into a pulsing green dot. */
function LiveLogo() {
  const t = useTheme();
  const k = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(k, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [k]);
  const glow = k.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.0, 0.14, 0.0] });
  return <View style={{ justifyContent: 'center' }}>
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -8, right: -8, top: -4, bottom: -4, borderRadius: 14, backgroundColor: t.ok, opacity: glow }} />
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', overflow: 'hidden' }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 24, letterSpacing: -1.1, color: t.ink }}>fixzy</Text>
      <View style={{ marginLeft: 2, marginBottom: 5 }}><PulseDot on size={6} /></View>
    </View>
  </View>;
}

/* Floating topbar: compact, detached from the screen edges, with the logo left and Sign out right. */
function Topbar({ onBack }: { onBack?: () => void }) {
  const t = useTheme();
  const { top } = useSafeAreaInsets();
  const { logout } = useSession();
  const online = useOnlineFlag();
  /* Load the status once so the topbar is right on any tab, even before Requests/Account open. */
  useEffect(() => { fetchMe().then((m) => setOnlineFlag(!!m.online)).catch(() => {}); }, []);
  const glass = 'rgba(255,255,255,0.5)';
  return <Glass radius={24} style={{ position: 'absolute', top: top + 8, left: 12, right: 12, height: 64 }}>
    <View style={{ height: 62, width: '100%', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {onBack && <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: glass }}>
        <Ionicons name="chevron-back" size={18} color={t.ink} />
      </Pressable>}
      {online ? <LiveLogo /> : <Wordmark size={28} />}
      <View style={{ backgroundColor: glass, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', borderRadius: 8, paddingHorizontal: 7, height: 22, justifyContent: 'center', marginTop: 2 }}>
        <Txt bold size={10} color="#1E3A8A" style={{ letterSpacing: 0.9, textTransform: 'uppercase' }}>Pro</Txt>
      </View>
      <View style={{ flex: 1 }} />
      <Pressable onPress={logout} accessibilityRole="button" accessibilityLabel="Sign out"
        style={(st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 22, height: 44, paddingHorizontal: 16, backgroundColor: st.pressed || st.hovered ? '#FFFFFFD9' : glass })}>
        <Ionicons name="log-out-outline" size={17} color={t.ink} />
        <Txt bold size={14} color={t.ink}>Sign out</Txt>
      </Pressable>
    </View>
  </Glass>;
}

export default function TabsLayout() {
  const [liveOpen, setLiveOpen] = useState(false);
  return <><Tabs tabBar={(p) => <BottomBar state={p.state} onLive={() => setLiveOpen(true)} />} screenOptions={{
    headerTransparent: true,
    header: ({ navigation, route }) => <Topbar onBack={route.name === 'job/[id]' ? () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('jobs')) : undefined} />,
  }}>
    <Tabs.Screen name="index" options={{ title: 'Requests' }} />
    <Tabs.Screen name="jobs" options={{ title: 'My jobs' }} />
    <Tabs.Screen name="reviews" options={{ title: 'Reviews' }} />
    <Tabs.Screen name="account" options={{ title: 'Account' }} />
    <Tabs.Screen name="job/[id]" options={{ title: 'Job', href: null }} />
    <Tabs.Screen name="live" options={{ title: 'Live' }} />
  </Tabs><LivePopup visible={liveOpen} onClose={() => setLiveOpen(false)} /></>;
}
