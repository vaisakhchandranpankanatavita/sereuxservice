import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from './api';
import { Button, Field, Stars, font, useTheme } from './ui';
import { isOtpOpen } from './popupgate';

type Done = { id: string; serviceId: number; service: string; pro: string };
const RECENT = 24 * 60 * 60 * 1000;

/* Watches the customer's bookings. When one is finished (and not yet reviewed) a rating sheet opens by itself,
   so feedback is asked for at the moment it matters. Skipping keeps the review on the booking page. */
export function RatePopup() {
  const t = useTheme();
  const seen = useRef(new Set<string>());
  const [open, setOpen] = useState<Done | null>(null);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const rows: any[] = await api('/bookings');
        if (!alive) return;
        if (isOtpOpen()) return; /* the code popup goes first */
        const hit = rows.find((b) => b.status === 'DONE' && !b.review && !seen.current.has(b.id) && Date.now() - new Date(b.updatedAt).getTime() < RECENT);
        if (hit) {
          seen.current.add(hit.id);
          setOpen((cur) => cur ?? { id: hit.id, serviceId: hit.serviceId, service: hit.service?.name || 'your service', pro: hit.provider?.name || 'your pro' });
          setRating(0); setText(''); setErr(''); setThanks(false);
        }
      } catch { /* offline or signed out: try again on the next tick */ }
    };
    const first = setTimeout(check, 2500); /* let the code popup (if any) open first */
    const i = setInterval(check, 4000);
    return () => { alive = false; clearTimeout(first); clearInterval(i); };
  }, []);

  const close = () => setOpen(null);
  const submit = async () => {
    if (!open || !rating) return;
    setBusy(true); setErr('');
    try {
      await api('/reviews', 'POST', { kind: 'service', target: open.serviceId, bookingId: open.id, rating, ...(text.trim() ? { text: text.trim() } : {}) });
      setThanks(true);
      setTimeout(close, 1400);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (!open) return null;
  return <Modal visible transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable accessibilityLabel="Close" onPress={close} style={{ flex: 1, backgroundColor: 'rgba(15,16,20,0.5)' }} />
      <View accessibilityViewIsModal style={{ backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 32, gap: 18, alignItems: 'center', width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        {thanks ? <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={32} color={t.ink} />
          </View>
          <Text style={{ color: t.ink, fontFamily: font.heavy, fontSize: 22 }}>Thanks for your review!</Text>
        </View> : <>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark-done" size={30} color={t.ink} />
          </View>
          <View style={{ gap: 6, alignItems: 'center' }}>
            <Text accessibilityRole="header" style={{ color: t.ink, fontFamily: font.heavy, fontSize: 24, letterSpacing: -0.6, textAlign: 'center' }}>Job complete</Text>
            <Text style={{ color: t.body, fontFamily: font.regular, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>How was {open.service} with {open.pro}?</Text>
          </View>
          <Stars value={rating} onChange={setRating} />
          <View style={{ width: '100%' }}>
            <Field label="Comment (optional)" value={text} onChangeText={setText} multiline />
          </View>
          {!!err && <Text style={{ color: t.bad, fontFamily: font.medium, fontSize: 14 }}>{err}</Text>}
          <View style={{ width: '100%', gap: 8 }}>
            <Button title="Submit review" onPress={submit} busy={busy} disabled={!rating} />
            <Button title="Maybe later" kind="ghost" onPress={close} />
          </View>
        </>}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
