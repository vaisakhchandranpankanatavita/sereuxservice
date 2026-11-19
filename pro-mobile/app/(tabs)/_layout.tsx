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

/* Topbar: logo flush left, page title + Sign out flush right. Spans the full width so the logo hugs the left edge. */
function Topbar({ onBack }: { onBack?: () => void }) {
  const t = useTheme();
  const { top } = useSafeAreaInsets();
  const { logout } = useSession();
  const online = useOnlineFlag();
  /* Load the status once so the topbar is right on any tab, even before Requests/Account open. */
  useEffect(() => { fetchMe().then((m) => setOnlineFlag(!!m.online)).catch(() => {}); }, []);
  return <View style={{ backgroundColor: t.card, paddingTop: top }}>
    <View style={{ height: 64, width: '100%', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {onBack && <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface }}>
        <Ionicons name="chevron-back" size={18} color={t.ink} />
      </Pressable>}
      {online ? <LiveLogo /> : <Wordmark size={28} />}
      <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 6, paddingHorizontal: 6, height: 20, justifyContent: 'center', marginTop: 2 }}>
        <Txt bold size={10} color={t.muted} style={{ letterSpacing: 0.9, textTransform: 'uppercase' }}>Pro</Txt>
      </View>
      <View style={{ flex: 1 }} />
      <Pressable onPress={logout} accessibilityRole="button" accessibilityLabel="Sign out"
        style={(st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, height: 44, paddingHorizontal: 14, backgroundColor: st.pressed || st.hovered ? t.line : t.surface })}>
        <Ionicons name="log-out-outline" size={17} color={t.ink} />
        <Txt bold size={14} color={t.ink}>Sign out</Txt>
      </Pressable>
    </View>
  </View>;
}

const ITEM_W = 66;
const BAR_PAD = 6;

/* Tab icon: filled glyph on a soft pill when active, outline when idle. */
const icon = (name: 'notifications' | 'briefcase' | 'star' | 'person', text: string, w: number) => ({ focused, color }: { focused: boolean; color: any }) => {
  const t = useTheme();
  /* Stacked icon + label. The active item gets a soft accent tint: the only colour in the bar. */
  const on = t.accent;
  return <View style={{ width: w, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: focused ? t.ink : 'transparent' }}>
    <Ionicons name={(focused ? name : `${name}-outline`) as any} size={20} color={focused ? '#FFFFFF' : color} />
    <Txt bold size={11} color={focused ? '#FFFFFF' : color} style={{ fontFamily: font.medium }}>{text}</Txt>
  </View>;
};

/* Last tab: radar mark. Still and grey while offline; rings pulse outward while online. */
const liveIcon = (w: number) => ({ focused, color }: { focused: boolean; color: any }) => {
  const t = useTheme();
  const online = useOnlineFlag();
  const on = t.accent;
  return <View style={{ width: w, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: focused ? t.ink : 'transparent' }}>
    <Radar on={!!online} size={26} color={t.ok} idle={focused ? '#FFFFFF' : color} />
    <Txt bold size={11} color={focused ? '#FFFFFF' : online ? t.ok : color} style={{ fontFamily: font.medium }}>Live</Txt>
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
    tabBarStyle: { position: 'absolute', left: (win - barW) / 2, width: barW, bottom: 12 + bottom, height: 64, paddingTop: 0, paddingBottom: 0, paddingHorizontal: BAR_PAD, backgroundColor: t.card, borderTopWidth: 0, borderWidth: 1, borderColor: t.line, borderRadius: 22, shadowColor: '#09090B', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
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
