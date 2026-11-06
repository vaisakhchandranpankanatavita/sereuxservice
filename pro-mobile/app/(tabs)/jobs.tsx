import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { Badge, Button, Card, Row, Screen, Status, Txt, dayLabel, money, useFetch, useTheme } from '../../src/ui';

const NEXT: Record<string, [string, string]> = {
  CONFIRMED: ['ON_THE_WAY', 'Start trip'],
  ON_THE_WAY: ['IN_PROGRESS', 'Start work'],
  IN_PROGRESS: ['DONE', 'Mark complete'],
};

export default function Jobs() {
  const t = useTheme();
  const router = useRouter();
  const jobs = useFetch<any[]>('/pro/jobs', 20000);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const advance = async (j: any) => {
    const step = NEXT[j.status];
    if (!step) return;
    setBusy(j.id); setErr('');
    try { await api(`/bookings/${j.id}/status`, 'PATCH', { status: step[0] }); await jobs.reload(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  return <Screen refresh={jobs.refresh} refreshing={jobs.refreshing}>
    <Txt bold size={26}>My jobs</Txt>
    {!!err && <Txt color={t.bad}>{err}</Txt>}
    {!jobs.data ? <Status error={jobs.error} loading={!jobs.error} /> :
      jobs.data.length === 0 ? <Status empty="Accepted requests will appear here." /> :
      jobs.data.map((j) => {
        const step = NEXT[j.status];
        const active = j.status !== 'DONE' && j.status !== 'CANCELLED';
        return <Card key={j.id}>
          <Row between>
            <View style={{ flex: 1 }}><Txt bold size={18}>{j.service?.name}</Txt><Txt muted size={14}>{j.name} · {dayLabel(j.day)} {j.slot}</Txt></View>
            <Badge v={j.status} />
          </Row>
          <Txt muted size={14}>{j.address}</Txt>
          {active && <View style={{ marginTop: 6 }}><Row>
            {step && <Button title={step[1]} onPress={() => advance(j)} busy={busy === j.id} style={{ flex: 1 }} />}
            <Button title="Route" kind="ghost" onPress={() => router.push(`/job/${j.id}`)} style={{ flex: 1 }} />
          </Row></View>}
        </Card>;
      })}
  </Screen>;
}
