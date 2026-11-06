import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useCart } from './cart';
import { Txt, useTheme } from './ui';

const TABS = [
  { href: '/', match: ['/'], label: 'Services', lottie: require('../assets/lottie/services.json') },
  { href: '/shop', match: ['/shop'], label: 'Shop', lottie: require('../assets/lottie/shop.json') },
  { href: '/activity', match: ['/activity'], label: 'Activity', lottie: require('../assets/lottie/activity.json') },
  { href: '/account', match: ['/account'], label: 'Account', lottie: require('../assets/lottie/account.json') },
] as const;

function TabIcon({ source, active }: { source: any; active: boolean }) {
  const ref = useRef<LottieView>(null);
  const mounted = useRef(false);
  useEffect(() => {
    // Skip the first run — `autoPlay` below already paints the icon as soon as it's ready,
    // without waiting on the ref (which, on first mount, can still be null when this fires).
    if (!mounted.current) { mounted.current = true; return; }
    if (active) ref.current?.play(); else ref.current?.reset();
  }, [active]);
  // The JSON itself is pre-recoloured to the app's ink/accent palette (see assets/lottie);
  // active vs. inactive is just opacity, since per-state colour swaps aren't reliable on web.
  return <LottieView ref={ref} source={source} loop={false} autoPlay style={{ width: 21, height: 21, opacity: active ? 1 : 0.55 }} />;
}

/* Persistent bottom tab bar, rendered once at the app root so it stays put across every
   screen (not just the (tabs) group) — a floating rounded island (inset from the edges, its
   own shadow) rather than a full-bleed bar, with the active tab picked out by a soft pill. */
export default function BottomBar() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart();

  return <View style={{
    position: 'absolute', left: 18, right: 18, bottom: Math.max(insets.bottom, 10),
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: t.card, borderRadius: 26, paddingVertical: 8, paddingHorizontal: 10,
    shadowColor: '#141412', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
    elevation: 12, zIndex: 900,
  }}>
    {TABS.map((tab) => {
      const active = (tab.match as readonly string[]).includes(pathname);
      return <Pressable key={tab.href} onPress={() => router.push(tab.href as any)} accessibilityRole="button" accessibilityLabel={tab.label}
        style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 7, borderRadius: 18, backgroundColor: active ? t.idleBg : 'transparent' }}>
        <View>
          <TabIcon source={tab.lottie} active={active} />
          {tab.href === '/shop' && count > 0 && <View style={{ position: 'absolute', top: -3, right: -9, backgroundColor: t.accent, borderRadius: 8, minWidth: 14, paddingHorizontal: 3, alignItems: 'center' }}>
            <Txt size={9} bold color={t.brandInk}>{count}</Txt>
          </View>}
        </View>
        <Txt size={9.5} bold={active} muted={!active}>{tab.label}</Txt>
      </Pressable>;
    })}
  </View>;
}
