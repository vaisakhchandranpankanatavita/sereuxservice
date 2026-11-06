import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useCart } from './cart';
import { Txt, font, useTheme } from './ui';

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
  return <LottieView ref={ref} source={source} loop={false} autoPlay style={{ width: 26, height: 26 }} />;
}

/* Persistent bottom tab bar, rendered once at the app root so it stays put across every
   screen (not just the (tabs) group) — Lordicon Lottie glyphs, played once when a tab becomes active. */
export default function BottomBar() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart();

  return <View style={{
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row',
    backgroundColor: t.card, borderTopWidth: 1, borderTopColor: t.line,
    paddingBottom: Math.max(insets.bottom, 10), paddingTop: 8, zIndex: 900, elevation: 900,
  }}>
    {TABS.map((tab) => {
      const active = (tab.match as readonly string[]).includes(pathname);
      return <Pressable key={tab.href} onPress={() => router.push(tab.href as any)} accessibilityRole="button" accessibilityLabel={tab.label}
        style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 }}>
        <View>
          <TabIcon source={tab.lottie} active={active} />
          {tab.href === '/shop' && count > 0 && <View style={{ position: 'absolute', top: -4, right: -10, backgroundColor: t.ink, borderRadius: 9, minWidth: 16, paddingHorizontal: 3, alignItems: 'center' }}>
            <Txt size={10} bold color={t.brandInk}>{count}</Txt>
          </View>}
        </View>
        <Txt size={11} bold={active} muted={!active}>{tab.label}</Txt>
      </Pressable>;
    })}
  </View>;
}
