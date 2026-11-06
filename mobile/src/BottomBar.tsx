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
    // Replay the draw-on when a tab becomes active; never reset() a tab that stops being
    // active — these Lordicon animations start from a blank first frame, so reset() would
    // snap it back to invisible instead of leaving it at its fully-drawn resting state.
    if (active) ref.current?.play();
  }, [active]);
  // The JSON itself is pre-recoloured to the app's ink/accent palette (see assets/lottie);
  // active vs. inactive is just opacity, since per-state colour swaps aren't reliable on web.
  return <LottieView ref={ref} source={source} loop={false} autoPlay style={{ width: 13, height: 13, opacity: active ? 1 : 0.55 }} />;
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
    backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 16, paddingVertical: 2, paddingHorizontal: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#141412', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 12, zIndex: 900,
  }}>
    {TABS.map((tab) => {
      const active = (tab.match as readonly string[]).includes(pathname);
      return <Pressable key={tab.href} onPress={() => router.push(tab.href as any)} accessibilityRole="button" accessibilityLabel={tab.label}
        style={{ flex: 1, alignItems: 'center', paddingVertical: 1, borderRadius: 11, backgroundColor: active ? 'rgba(20,20,18,0.08)' : 'transparent' }}>
        <View>
          <TabIcon source={tab.lottie} active={active} />
          {tab.href === '/shop' && count > 0 && <View style={{ position: 'absolute', top: -2, right: -8, backgroundColor: t.accent, borderRadius: 7, minWidth: 13, paddingHorizontal: 3, alignItems: 'center' }}>
            <Txt size={8.5} bold color={t.brandInk}>{count}</Txt>
          </View>}
        </View>
        <Txt size={8.5} bold color={active ? t.ink : t.muted}>{tab.label}</Txt>
      </Pressable>;
    })}
  </View>;
}
