import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from './cart';
import { Txt, useTheme } from './ui';
import { useConfig } from './config';

const ALL_TABS = [
  { href: '/', match: ['/'], label: 'Services', on: 'home', off: 'home-outline' },
  { href: '/shop', match: ['/shop'], label: 'Shop', on: 'bag-handle', off: 'bag-handle-outline' },
  { href: '/activity', match: ['/activity'], label: 'Activity', on: 'calendar', off: 'calendar-outline' },
  { href: '/account', match: ['/account'], label: 'Account', on: 'person', off: 'person-outline' },
] as const;

/* Persistent floating nav, rendered once at the app root. A single highlight glides between tabs
   on a spring instead of each tab flashing its own background. */
export default function BottomBar() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart();
  const { get } = useConfig();
  const TABS = ALL_TABS.filter((tab) => tab.href !== '/shop' || get('flags.shopEnabled'));
  const [w, setW] = useState(0);
  const idx = Math.max(0, TABS.findIndex((tab) => (tab.match as readonly string[]).includes(pathname)));
  const x = useRef(new Animated.Value(0)).current;
  const slot = w / TABS.length;

  useEffect(() => {
    if (slot) Animated.spring(x, { toValue: idx * slot, useNativeDriver: true, speed: 16, bounciness: 7 }).start();
  }, [idx, slot, x]);

  return <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 12), zIndex: 900, alignItems: 'center' }}>
   <LinearGradient
    colors={['rgba(130,120,210,0.55)', 'rgba(150,95,170,0.5)', 'rgba(90,100,170,0.6)']}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    style={[{
      alignSelf: 'center',
      borderRadius: 40, padding: 7,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)',
      shadowColor: '#232323', shadowOpacity: 0.16, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 10,
    }, Platform.OS === 'web' ? ({ backdropFilter: 'blur(18px) saturate(180%)', WebkitBackdropFilter: 'blur(18px) saturate(180%)' } as any) : null]}>
    <View style={{ flexDirection: 'row' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {!!slot && <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: slot, alignItems: 'center', transform: [{ translateX: x }] }}>
        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: t.accent }} />
      </Animated.View>}
      {TABS.map((tab, i) => {
        const active = i === idx;
        return <Pressable key={tab.href} onPress={() => router.push(tab.href as any)} accessibilityRole="button" accessibilityLabel={tab.label} accessibilityState={{ selected: active }}
          style={{ width: 62, height: 54, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={(active ? tab.on : tab.off) as any} size={23} color={active ? t.ink : 'rgba(255,255,255,0.8)'} />
          {tab.href === '/shop' && count > 0 && <View style={{ position: 'absolute', top: 2, right: '24%', backgroundColor: t.pink, borderRadius: 8, minWidth: 16, height: 16, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={10} bold color={t.ink}>{count}</Txt>
          </View>}
        </Pressable>;
      })}
    </View>
   </LinearGradient>
  </View>;
}
