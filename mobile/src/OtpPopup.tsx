import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from './api';
import { Button, font, useTheme } from './ui';

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
        const rows: any[] = await api('/bookings');
        if (!alive) return;
        const hit = rows.find((b) => b.otp && (b.status === 'ON_THE_WAY' || b.status === 'IN_PROGRESS') && !seen.current.has(`${b.id}:${b.otp}`));
        if (hit) {
          seen.current.add(`${hit.id}:${hit.otp}`);
          setOpen((cur) => cur ?? { key: `${hit.id}:${hit.otp}`, id: hit.id, otp: hit.otp, start: hit.status === 'ON_THE_WAY', pro: hit.provider?.name || 'Your pro' });
        }
      } catch { /* offline or signed out: try again on the next tick */ }
    };
    check();
    const i = setInterval(check, 6000);
    return () => { alive = false; clearInterval(i); };
  }, []);

  useEffect(() => {
    if (!open) { a.setValue(0); return; }
    Animated.timing(a, { toValue: 1, duration: 360, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [open, a]);

  const close = () => setOpen(null);
  const view = () => { const id = open?.id; setOpen(null); if (id) router.push(`/booking/${id}`); };

  if (!open) return null;
  const digits = open.otp.split('');
  return <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Pressable accessibilityLabel="Close" onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(35,35,35,0.55)' }]} />
      <Animated.View accessibilityViewIsModal style={{ width: '100%', maxWidth: 380, backgroundColor: t.bg, borderRadius: 32, padding: 24, gap: 18, alignItems: 'center',
        opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={open.start ? 'key-outline' : 'checkmark-done-outline'} size={26} color={t.ink} />
        </View>
        <View style={{ gap: 6, alignItems: 'center' }}>
          <Text accessibilityRole="header" style={{ color: t.ink, fontFamily: font.heavy, fontSize: 24, letterSpacing: -0.6, textAlign: 'center' }}>{open.start ? 'Your start code' : 'Your completion code'}</Text>
          <Text style={{ color: t.body, fontFamily: font.regular, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
            {open.start ? `${open.pro} is on the way. Share this code when they arrive, to start the work.` : 'Share this only once you’re happy with the finished work.'}
          </Text>
        </View>
        <View accessible accessibilityLabel={`Code ${digits.join(' ')}`} style={{ flexDirection: 'row', gap: 10 }}>
          {digits.map((d, i) => <View key={i} style={{ width: 58, height: 70, borderRadius: 18, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.ink, fontFamily: font.heavy, fontSize: 34 }}>{d}</Text>
          </View>)}
        </View>
        <View style={{ width: '100%', gap: 8 }}>
          <Button title="Got it" onPress={close} />
          <Button title="View booking" kind="ghost" onPress={view} />
        </View>
      </Animated.View>
    </View>
  </Modal>;
}
