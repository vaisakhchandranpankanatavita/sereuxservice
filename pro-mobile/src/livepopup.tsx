import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from './api';
import { pingLive } from './live';
import { Radar } from './radar';
import { Money, OnlineSwitch, Txt, font, mono, overline, setOnlineFlag, useFetch, useOnlineFlag, useTheme } from './ui';

/* The Live tab opens this popup instead of a separate page: status, switch and a few numbers. */
export function LivePopup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const me = useFetch<any>(visible ? '/pro/me' : null);
  const reqs = useFetch<any[]>(visible ? '/pro/requests' : null);
  const flag = useOnlineFlag();
  const [err, setErr] = useState('');
  useEffect(() => { if (me.data) setOnlineFlag(!!me.data.online); }, [me.data]);
  const on = me.data ? !!me.data.online : !!flag;

  const toggle = async () => {
    setErr('');
    try { await api('/pro/online', 'PATCH', { online: !on }); setOnlineFlag(!on); pingLive(); me.reload(); reqs.reload(); }
    catch (e: any) { setErr(e.message); }
  };

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable onPress={onClose} accessibilityLabel="Close" style={{ flex: 1, backgroundColor: 'rgba(9,9,11,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 380, backgroundColor: t.card, borderRadius: 16, padding: 24, alignItems: 'center', gap: 12, shadowColor: '#09090B', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 }}>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={{ position: 'absolute', top: 14, right: 14 }}>
          <Ionicons name="close" size={22} color={t.muted} />
        </Pressable>
        <View style={{ width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.okBg : t.idleBg, borderWidth: 1, borderColor: on ? t.okLine : t.idleLine }}>
          <Radar on={on} size={136} color={t.ok} />
        </View>
        <Text style={{ color: on ? t.ok : t.ink, fontFamily: font.semibold, fontSize: 24, letterSpacing: -0.5 }}>{on ? 'You’re live' : 'You’re offline'}</Text>
        <Txt muted size={14} style={{ textAlign: 'center' }}>{on ? 'Customers nearby can see you and send requests.' : 'Go online to start receiving requests.'}</Txt>
        <OnlineSwitch on={on} onToggle={toggle} busy={!me.data} />
        {!!err && <Txt color={t.bad}>{err}</Txt>}
        {on && <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
          <View style={{ flex: 1, backgroundColor: t.surface, borderRadius: 12, padding: 14, gap: 4 }}>
            <Text style={[overline, { color: t.muted }]}>Open requests</Text>
            <Text style={mono(24, { color: t.ink, letterSpacing: -0.7 })}>{reqs.data?.length ?? '–'}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: t.surface, borderRadius: 12, padding: 14, gap: 4 }}>
            <Text style={[overline, { color: t.muted }]}>Total earned</Text>
            {me.data ? <Money amount={me.data.earned} size={24} /> : <Text style={{ color: t.muted }}>–</Text>}
          </View>
        </View>}
      </Pressable>
    </Pressable>
  </Modal>;
}
