import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Button, Card, OnlineSwitch, PageTitle, R, Screen, Status, Txt, Money, dayLabel, font, mono, setOnlineFlag, useFetch, useTheme } from '../../src/ui';

/* One labelled fact row: a quiet icon, then the value. Keeps cards scannable without bordered sub-boxes. */
function Fact({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: string }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
    <Ionicons name={icon} size={18} color={t.muted} style={{ marginTop: 1 }} />
    <Text style={{ flex: 1, color: t.body, fontFamily: font.regular, fontSize: 15, lineHeight: 21 }}>{children}</Text>
  </View>;
}

export default function Requests() {
  const t = useTheme();
  const me = useFetch<any>('/pro/me');
  useEffect(() => { if (me.data) setOnlineFlag(!!me.data.online); }, [me.data]);
  const reqs = useFetch<any[]>('/pro/requests', 15000);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const act = async (id: string, kind: 'accept' | 'decline') => {
    setBusy(id); setErr('');
    try { await api(`/pro/bookings/${id}/${kind}`, 'POST'); await reqs.reload(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const toggleOnline = async (v: boolean) => {
    try { await api('/pro/online', 'PATCH', { online: v }); setOnlineFlag(v); me.reload(); }
    catch (e: any) { setErr(e.message); }
  };

  const online = !!me.data?.online;
  const count = reqs.data?.length ?? 0;

  return <Screen refresh={reqs.refresh} refreshing={reqs.refreshing}>
    <PageTitle title="Requests"
      sub={!me.data ? ' ' : online ? (count ? `${count} nearby, nearest first` : 'You’re visible to customers nearby.') : 'You’re offline right now.'}
      right={<OnlineSwitch on={online} onToggle={() => toggleOnline(!online)} busy={!me.data} />} />

    {err ? <Txt color={t.bad}>{err}</Txt> : null}

    {!online ? <Status empty="Go online to start receiving new service requests." /> :
      !reqs.data ? <Status error={reqs.error} loading={!reqs.error} /> :
      count === 0 ? <Status empty="No requests right now. We’ll alert you when someone nearby needs help." /> :
      reqs.data.map((r) => (
        <Card key={r.id} style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: t.ink, fontFamily: font.semibold, fontSize: 20, letterSpacing: -0.4 }} numberOfLines={2}>{r.service?.name}</Text>
              <Text style={mono(13, { color: t.muted })}>{dayLabel(r.day)} · {r.slot}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Money amount={r.estimate} size={22} style={{ alignSelf: 'flex-end' }} />
              <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 12 }}>estimate</Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: t.line }} />

          <View style={{ gap: 10 }}>
            <Fact icon="person-outline">{[r.name, r.phone].filter(Boolean).join(' · ')}</Fact>
            <Fact icon="location-outline">{r.address}</Fact>
          </View>
          {r.notes ? <Text style={{ color: t.body, fontFamily: font.regular, fontSize: 14, lineHeight: 20, backgroundColor: t.surface, borderRadius: R.sm, padding: 12 }}>“{r.notes}”</Text> : null}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Accept" onPress={() => act(r.id, 'accept')} busy={busy === r.id} style={{ flex: 1.4 }} />
            <Button title="Decline" kind="ghost" onPress={() => act(r.id, 'decline')} disabled={busy === r.id} style={{ flex: 1 }} />
          </View>
        </Card>
      ))}
  </Screen>;
}
