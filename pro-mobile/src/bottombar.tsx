import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Radar } from './radar';
import { Glass } from './glass';
import { useOnlineFlag } from './ui';

/* Floating nav: a quiet neutral surface, icon-only destinations and one subtle active marker. */
const SKIN = {
  glass: 'rgba(255,255,255,0.9)',
  edge: 'rgba(228,228,231,0.9)',
  shadow: '#0F172A',
  highlight: 'rgba(255,255,255,0.78)',
  active: '#1D4ED8',
  idle: '#71717A',
  live: '#047857',
};
const ICONS: Record<string, { on: string; off: string; label: string }> = {
  index: { on: 'notifications', off: 'notifications-outline', label: 'Requests' },
  jobs: { on: 'briefcase', off: 'briefcase-outline', label: 'My jobs' },
  reviews: { on: 'star', off: 'star-outline', label: 'Reviews' },
  account: { on: 'person', off: 'person-outline', label: 'Account' },
  live: { on: 'radio', off: 'radio-outline', label: 'Live' },
};
const ORDER = ['index', 'jobs', 'reviews', 'account', 'live'];
const SLOT = 62;

export function BottomBar({ state, onLive }: { state: any; onLive: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const online = useOnlineFlag();
  const current = state.routes[state.index]?.name as string;
  /* Job detail belongs to My jobs; Live is a popup, so it never holds the highlight. */
  const at = Math.max(0, ORDER.slice(0, 4).indexOf(current === 'job/[id]' ? 'jobs' : current));
  const x = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Animated.spring(x, { toValue: at * SLOT, useNativeDriver: Platform.OS !== 'web', speed: 16, bounciness: 7 }).start();
    setReady(true);
  }, [at, x]);

  const PATH: Record<string, string> = { index: '/', jobs: '/jobs', reviews: '/reviews', account: '/account' };
  const press = (name: string) => (name === 'live' ? onLive() : router.navigate(PATH[name] as any));

  return <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 12), zIndex: 900, alignItems: 'center' }}>
    <Glass radius={40}>
      <View style={{ flexDirection: 'row', padding: 6 }}>
        {ready ? <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 6, bottom: 6, left: 6, width: SLOT, alignItems: 'center', transform: [{ translateX: x }] }}>
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: SKIN.highlight, borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)', shadowColor: '#1D4ED8', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }} />
        </Animated.View> : null}
        {ORDER.map((name, i) => {
          const m = ICONS[name], active = i === at && name !== 'live';
          return <Pressable key={name} onPress={() => press(name)} accessibilityRole="button" accessibilityLabel={m.label} accessibilityState={{ selected: active }}
            style={{ width: SLOT, height: 54, alignItems: 'center', justifyContent: 'center' }}>
            {name === 'live'
              ? <Radar on={!!online} size={26} color={SKIN.live} idle={SKIN.idle} />
              : <Ionicons name={(active ? m.on : m.off) as any} size={23} color={active ? SKIN.active : SKIN.idle} />}
          </Pressable>;
        })}
      </View>
    </Glass>
  </View>;
}
