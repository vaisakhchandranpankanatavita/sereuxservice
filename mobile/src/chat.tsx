import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api } from './api';
import { useSession } from './session';
import { Txt, useFetch, useTheme } from './ui';

/* Booking chat between the customer and the assigned pro. Polls every 5s; the server enforces who may read/send. */
export function Chat({ bookingId, canSend }: { bookingId: string; canSend: boolean }) {
  const t = useTheme();
  const { user } = useSession();
  const msgs = useFetch<any[]>(`/bookings/${bookingId}/messages`, 5000);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setErr('');
    try { await api(`/bookings/${bookingId}/messages`, 'POST', { text: body }); setText(''); await msgs.reload(); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const list = msgs.data ?? [];
  return <View style={{ gap: 10 }}>
    {!list.length && <Txt size={14} color={t.muted}>{canSend ? 'No messages yet. Say hello!' : 'No messages.'}</Txt>}
    {list.map((m) => {
      const mine = m.senderId === user?.id;
      return <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', backgroundColor: mine ? t.ink : t.bg, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, gap: 2 }}>
        <Text style={{ color: mine ? t.bg : t.ink, fontSize: 15 }}>{m.text}</Text>
        <Text style={{ color: mine ? t.bg : t.muted, opacity: 0.6, fontSize: 10, alignSelf: 'flex-end' }}>{new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>;
    })}
    {!!err && <Txt size={13} color={t.bad}>{err}</Txt>}
    {canSend && <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
      <TextInput value={text} onChangeText={setText} placeholder="Message" placeholderTextColor={t.muted} multiline maxLength={1000} accessibilityLabel="Message"
        style={{ flex: 1, maxHeight: 100, borderWidth: 1, borderColor: t.line, backgroundColor: t.bg, color: t.ink, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 }} />
      <Pressable onPress={send} disabled={busy || !text.trim()} accessibilityRole="button" accessibilityLabel="Send message"
        style={{ backgroundColor: t.ink, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, opacity: busy || !text.trim() ? 0.4 : 1 }}>
        <Text style={{ color: t.bg, fontWeight: '700' }}>Send</Text>
      </Pressable>
    </View>}
  </View>;
}
