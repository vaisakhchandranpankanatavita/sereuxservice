import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Easing, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PulseDot, Txt, Wordmark, useOnlineFlag, setOnlineFlag, font, useTheme } from '../../src/ui';
import { Radar } from '../../src/radar';
import { useSession } from '../../src/session';
import { fetchMe } from '../../src/session';
import { useEffect, useRef, useState } from 'react';
import { LivePopup } from '../../src/livepopup';

/* While online the logo "lives": a green glow breathes behind it, a light sweeps across the letters, and the period turns into a pulsing green dot. */
function LiveLogo() {
  const t = useTheme();
  const k = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(k, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [k]);
  const glow = k.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.06, 0.3, 0.06] });
  const sweep = k.interpolate({ inputRange: [0, 1], outputRange: [-30, 90] });
  return <View style={{ justifyContent: 'center' }}>
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -8, right: -8, top: -4, bottom: -4, borderRadius: 14, backgroundColor: t.ok, opacity: glow }} />
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', overflow: 'hidden' }}>
      <Text style={{ fontFamily: font.heavy, fontSize: 28, letterSpacing: -1.7, color: t.ink }}>fixzy</Text>
      <View style={{ marginLeft: 2, marginBottom: 6 }}><PulseDot on size={7} /></View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, width: 22, left: sweep as any, backgroundColor: 'rgba(255,255,255,0.65)', transform: [{ skewX: '-20deg' }] }} />
    </View>
  </View>;
}

/* Topbar: logo flush left, page title + Sign out flush right. Spans the full width so the logo hugs the left edge. */
function Topbar({ onBack }: { onBack?: () => void }) {
  const t = useTheme();
  const { top } = useSafeAreaInsets();
  const { logout } = useSession();
  const online = useOnlineFlag();
  /* Load the status once so the topbar is right on any tab, even before Requests/Account open. */
  useEffect(() => { fetchMe().then((m) => setOnlineFlag(!!m.online)).catch(() => {}); }, []);
  return <View style={{ backgroundColor: t.card, paddingTop: top, borderBottomWidth: 1, borderBottomColor: t.line, shadowColor: '#141412', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
    <View style={{ height: 60, width: '100%', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {onBack && <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.line }}>
        <Ionicons name="chevron-back" size={18} color={t.ink} />
      </Pressable>}
      {online ? <LiveLogo /> : <Wordmark size={28} />}
      <View style={{ backgroundColor: t.accent, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginTop: 4 }}>
        <Txt bold size={10} color="#fff" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>Pro</Txt>
      </View>
      <View style={{ flex: 1 }} />
      <Pressable onPress={logout} accessibilityRole="button" accessibilityLabel="Sign out"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: t.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: pressed ? t.idleBg : 'transparent' })}>
        <Ionicons name="log-out-outline" size={16} color={t.ink} />
        <Txt bold size={12}>Sign out</Txt>
      </Pressable>
    </View>
    <View style={{ height: 3, backgroundColor: t.accent }} />
  </View>;
}

const ITEM_W = 66;
const BAR_PAD = 6;

/* Tab icon: filled glyph on a soft pill when active, outline when idle. */
const icon = (name: 'notifications' | 'briefcase' | 'star' | 'person', text: string, w: number) => ({ focused, color }: { focused: boolean; color: any }) => {
  const t = useTheme();
  /* Stacked icon + label. Active item gets a soft tan tint and a deeper tan icon/label: the only colour in the bar. */
  const on = '#8a6a40';
  return <View style={{ width: w, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: focused ? t.warnBg : 'transparent' }}>
    <Ionicons name={(focused ? name : `${name}-outline`) as any} size={20} color={focused ? on : color} />
    <Txt bold size={11} color={focused ? on : color}>{text}</Txt>
  </View>;
};

/* Last tab: radar mark. Still and grey while offline; rings pulse outward while online. */
const liveIcon = (w: number) => ({ focused, color }: { focused: boolean; color: any }) => {
  const t = useTheme();
  const online = useOnlineFlag();
  const on = '#8a6a40';
  return <View style={{ width: w, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: focused ? t.warnBg : 'transparent' }}>
    <Radar on={!!online} size={26} color={t.ok} idle={focused ? on : color} />
    <Txt bold size={11} color={online ? t.ok : focused ? on : color}>Live</Txt>
  </View>;
};

export default function TabsLayout() {
  const t = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { width: win } = useWindowDimensions();
  /* Auto width: the bar wraps its four items (never wider than the screen) and sits centred. */
  const [liveOpen, setLiveOpen] = useState(false);
  const barW = Math.min(win - 24, ITEM_W * 5 + BAR_PAD * 2);
  const w = Math.floor((barW - BAR_PAD * 2) / 5) - 2; /* each pill fits its own slot, so nothing spills past the bar on narrow screens */
  return <><Tabs screenOptions={{
    header: ({ navigation, route }) => <Topbar onBack={route.name === 'job/[id]' ? () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('jobs')) : undefined} />,
    tabBarActiveTintColor: t.ink, tabBarInactiveTintColor: t.muted,
    /* Floating pill bar: detached from the screen edges, content scrolls underneath. */
    tabBarStyle: { position: 'absolute', left: (win - barW) / 2, width: barW, bottom: 12 + bottom, height: 64, paddingTop: 0, paddingBottom: 0, paddingHorizontal: BAR_PAD, backgroundColor: t.card, borderTopWidth: 0, borderWidth: 1, borderColor: t.line, borderRadius: 32, shadowColor: '#141412', shadowOpacity: 0.16, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
    tabBarShowLabel: false,
    tabBarItemStyle: { justifyContent: 'center', alignItems: 'center', paddingVertical: 0 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Requests', tabBarIcon: icon('notifications', 'Requests', w) }} />
    <Tabs.Screen name="jobs" options={{ title: 'My jobs', tabBarIcon: icon('briefcase', 'My jobs', w) }} />
    <Tabs.Screen name="reviews" options={{ title: 'Reviews', tabBarIcon: icon('star', 'Reviews', w) }} />
    <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('person', 'Account', w) }} />
    <Tabs.Screen name="job/[id]" options={{ title: 'Job', href: null }} />
    <Tabs.Screen name="live" options={{ title: 'Live', tabBarIcon: liveIcon(w) }}
      listeners={{ tabPress: (e) => { e.preventDefault(); setLiveOpen(true); } }} />
  </Tabs><LivePopup visible={liveOpen} onClose={() => setLiveOpen(false)} /></>;
}
