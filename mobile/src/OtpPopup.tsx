import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from './api';
import { Button, font, useTheme } from './ui';
import { setOtpOpen } from './popupgate';

type Pending = { key: string; id: string; otp: string; start: boolean; pro: string };

/* Watches the customer's bookings. The moment the pro starts the trip (start code) or starts the work (completion code), the new
   code appears in a popup, so it can't be missed. Each code shows once per device session; dismissing keeps it on the booking page. */
export function OtpPopup() {
  const t = useTheme();
  const router = useRouter();
  const seen = useRef(new Set<string>());
  const [open, setOpen] = useState<Pending | null>(null);
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const [rows, notes]: [any[], any[]] = await Promise.all([api('/bookings'), api('/notifications').catch(() => [])]);
        if (!alive) return;
        /* The pro just tapped "Start work": show that booking's code now, even if it was dismissed before. */
        const ping = notes.find((n) => n.href?.includes('code=1') && !seen.current.has(`n:${n.id}`) && Date.now() - new Date(n.createdAt).getTime() < 3 * 60 * 1000);
        if (ping) {
          seen.current.add(`n:${ping.id}`);
          const bk = rows.find((b) => ping.href.startsWith(`/booking/${b.id}`) && b.otp && (b.status === 'ON_THE_WAY' || b.status === 'IN_PROGRESS'));
          if (bk) { setOpen({ key: `n:${ping.id}`, id: bk.id, otp: bk.otp, start: bk.status === 'ON_THE_WAY', pro: bk.provider?.name || 'Your pro' }); return; }
        }
        const hit = rows.find((b) => b.otp && (b.status === 'ON_THE_WAY' || b.status === 'IN_PROGRESS') && !seen.current.has(`${b.id}:${b.otp}`));
        if (hit) {
          seen.current.add(`${hit.id}:${hit.otp}`);
          setOpen((cur) => cur ?? { key: `${hit.id}:${hit.otp}`, id: hit.id, otp: hit.otp, start: hit.status === 'ON_THE_WAY', pro: hit.provider?.name || 'Your pro' });
        }
      } catch { /* offline or signed out: try again on the next tick */ }
    };
    check();
    const i = setInterval(check, 4000);
    return () => { alive = false; clearInterval(i); };
  }, []);

  useEffect(() => {
    if (!open) { a.setValue(0); return; }
    Animated.timing(a, { toValue: 1, duration: 360, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [open, a]);

  useEffect(() => { setOtpOpen(!!open); return () => setOtpOpen(false); }, [open]);

  const close = () => setOpen(null);
  const view = () => { const id = open?.id; setOpen(null); if (id) router.push(`/booking/${id}`); };

  if (!open) return null;
  const digits = open.otp.split('');
  /* Full-screen takeover: opaque page, big code, actions pinned to the bottom. */
  return <Modal visible animationType="slide" onRequestClose={close} statusBarTranslucent>
    <SafeAreaView accessibilityViewIsModal style={{ flex: 1, backgroundColor: t.bg }}>
      <Animated.View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={22} color={t.ink} />
          </Pressable>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={open.start ? 'key-outline' : 'checkmark-done-outline'} size={32} color={t.ink} />
          </View>
          <View style={{ gap: 8, alignItems: 'center' }}>
            <Text accessibilityRole="header" style={{ color: t.ink, fontFamily: font.heavy, fontSize: 30, letterSpacing: -0.8, textAlign: 'center' }}>{open.start ? 'Your start code' : 'Your completion code'}</Text>
            <Text style={{ color: t.body, fontFamily: font.regular, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 320 }}>
              {open.start ? `${open.pro} is on the way. Share this code when they arrive, to start the work.` : 'Share this only once you’re happy with the finished work.'}
            </Text>
          </View>
          <View accessible accessibilityLabel={`Code ${digits.join(' ')}`} style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
            {digits.map((d, i) => <View key={i} style={{ width: 64, height: 84, borderRadius: 20, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: t.ink, fontFamily: font.heavy, fontSize: 42 }}>{d}</Text>
            </View>)}
          </View>
        </View>

        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 8 }}>
          <Button title="Got it" onPress={close} />
          <Button title="View booking" kind="ghost" onPress={view} />
        </View>
      </Animated.View>
    </SafeAreaView>
  </Modal>;
}
