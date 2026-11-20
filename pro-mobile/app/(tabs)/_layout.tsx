import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PulseDot, Txt, Wordmark, useOnlineFlag, setOnlineFlag, font, useTheme } from '../../src/ui';
import { Radar } from '../../src/radar';
import { useSession } from '../../src/session';
import { fetchMe } from '../../src/session';
import { useEffect, useRef, useState } from 'react';
import { LivePopup } from '../../src/livepopup';
import { BottomBar } from '../../src/bottombar';

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
      <Text style={{ fontFamily: font.semibold, fontSize: 24, letterSpacing: -1.1, color: '#FFFFFF' }}>fixzy</Text>
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
  const glass = 'rgba(255,255,255,0.14)';
  /* Same shape as the customer app's header: attached to the top edge, wide frosted glass with big rounded bottom corners,
     brand on the left, round action on the right. Colours stay the pro navy / blue / plum. */
  const R_BOTTOM = 32;
  return <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, borderBottomLeftRadius: R_BOTTOM, borderBottomRightRadius: R_BOTTOM,
    shadowColor: '#1E3A8A', shadowOpacity: 0.2, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
    <View style={{ borderBottomLeftRadius: R_BOTTOM, borderBottomRightRadius: R_BOTTOM, overflow: 'hidden', borderWidth: 1, borderTopWidth: 0, borderColor: 'rgba(255,255,255,0.22)' }}>
      {Platform.OS === 'web'
        ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,16,32,0.2)' }, { backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)' } as any]} />
        : <BlurView pointerEvents="none" tint="dark" intensity={55} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />}
      <LinearGradient pointerEvents="none" colors={['rgba(37,84,170,0.58)', 'rgba(24,34,66,0.6)', 'rgba(52,34,80,0.58)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ paddingTop: top + 10, paddingBottom: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, height: top + 78 }}>
        {onBack && <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: glass }}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </Pressable>}
        <View style={{ flex: 1, gap: 2 }} accessible accessibilityRole="header" accessibilityLabel="Fixzy Pro">
          <Txt size={11} bold color="rgba(255,255,255,0.62)" style={{ letterSpacing: 1.6, textTransform: 'uppercase' }}>Provider app</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {online ? <LiveLogo /> : <Wordmark size={28} color="#FFFFFF" />}
            <View style={{ backgroundColor: glass, borderRadius: 999, paddingHorizontal: 9, height: 22, justifyContent: 'center', marginTop: 3 }}>
              <Txt bold size={10} color="#FFFFFF" style={{ letterSpacing: 0.9, textTransform: 'uppercase' }}>Pro</Txt>
            </View>
          </View>
        </View>
        <Pressable onPress={logout} accessibilityRole="button" accessibilityLabel="Sign out"
          style={(st: any) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: st.pressed || st.hovered ? 'rgba(255,255,255,0.26)' : glass })}>
          <Ionicons name="power" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  </View>;
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
