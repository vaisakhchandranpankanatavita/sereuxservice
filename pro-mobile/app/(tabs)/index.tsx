import { useState } from 'react';
import { View } from 'react-native';
import { api } from '../../src/api';
import { Badge, Button, Card, Row, Screen, Status, Txt, dayLabel, money, useFetch, useTheme } from '../../src/ui';

export default function Requests() {
  const t = useTheme();
  const me = useFetch<any>('/pro/me');
  const reqs = useFetch<any[]>('/pro/requests', 15000);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const act = async (id: string, kind: 'accept' | 'decline') => {
    setBusy(id); setErr('');
    try { await api(`/pro/bookings/${id}/${kind}`, 'POST'); await reqs.reload(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const toggleOnline = async (v: boolean) => { await api('/pro/online', 'PATCH', { online: v }); me.reload(); };

  return <Screen refresh={reqs.refresh} refreshing={reqs.refreshing}>
    <Row between>
      <View>
        <Txt bold size={26}>Requests</Txt>
        <Txt muted>{me.data?.online ? 'You’re visible to customers nearby.' : 'You’re offline right now.'}</Txt>
      </View>
      <Button title={me.data?.online ? 'Go offline' : 'Go online'} kind={me.data?.online ? 'ghost' : 'primary'} onPress={() => toggleOnline(!me.data?.online)} />
    </Row>

    {!!err && <Txt color={t.bad}>{err}</Txt>}

    {!me.data?.online ? <Status empty="Go online to start receiving new service requests." /> :
      !reqs.data ? <Status error={reqs.error} loading={!reqs.error} /> :
      reqs.data.length === 0 ? <Status empty="No requests right now. We’ll alert you when someone nearby needs help." /> :
      reqs.data.map((r) => (
        <Card key={r.id}>
          <Row between>
            <View style={{ flex: 1 }}><Txt bold size={18}>{r.service?.name}</Txt><Txt muted size={14}>{dayLabel(r.day)} · {r.slot}</Txt></View>
            <Txt bold size={18} color={t.accent}>{money(r.estimate)}</Txt>
          </Row>
          <Txt size={15}>{r.name} · {r.phone}</Txt>
          <Txt muted size={14}>{r.address}</Txt>
          {!!r.notes && <Txt muted size={14} style={{ fontStyle: 'italic' }}>“{r.notes}”</Txt>}
          <View style={{ marginTop: 6 }}><Row>
            <Button title="Accept" onPress={() => act(r.id, 'accept')} busy={busy === r.id} style={{ flex: 1 }} />
            <Button title="Decline" kind="ghost" onPress={() => act(r.id, 'decline')} disabled={busy === r.id} style={{ flex: 1 }} />
          </Row></View>
        </Card>
      ))}
  </Screen>;
}
