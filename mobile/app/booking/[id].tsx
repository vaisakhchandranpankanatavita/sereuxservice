import { useMemo, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../src/api';
import { LiveMap } from '../../src/map';
import { StatusIntro } from '../../src/StatusIntro';
import { Timeline, type Step } from '../../src/timeline';
import { Address, Badge, Button, Card, Chip, Eyebrow, Field, Row, Screen, Stars, Status, Txt, dayLabel, money, useFetch, useTheme } from '../../src/ui';

const STEPS: Step[] = [
  { key: 'REQUESTED', label: 'Requested', hint: "We've got your request.", icon: 'hourglass-outline', iconDone: 'hourglass' },
  { key: 'CONFIRMED', label: 'Confirmed', hint: 'A pro has been assigned.', icon: 'checkmark-circle-outline', iconDone: 'checkmark-circle' },
  { key: 'ON_THE_WAY', label: 'On the way', hint: 'Your pro is heading over.', icon: 'car-outline', iconDone: 'car' },
  { key: 'IN_PROGRESS', label: 'In progress', hint: "The job's underway.", icon: 'construct-outline', iconDone: 'construct' },
  { key: 'DONE', label: 'Done', icon: 'checkmark-done-outline', iconDone: 'checkmark-done' },
];
const isoDay = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const confirm = (title: string, ok: () => void) => {
  if (Platform.OS === 'web') { if (window.confirm(title)) ok(); return; }
  Alert.alert(title, undefined, [{ text: 'Keep it', style: 'cancel' }, { text: 'Yes', style: 'destructive', onPress: ok }]);
};

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { data: b, error, refreshing, refresh, reload } = useFetch<any>(`/bookings/${id}`, 15000);
  const [msg, setMsg] = useState('');
  const [resched, setResched] = useState(false);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => isoDay(i + 1)), []);
  const [day, setDay] = useState(days[0]);
  const avail = useFetch<any>(b && resched ? `/services/${b.serviceId}/availability?day=${day}${b.providerId ? `&providerId=${b.providerId}` : ''}` : null);
  const [slot, setSlot] = useState('');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  if (!b) return <Screen><Status error={error} loading={!error} /></Screen>;

  const step = STEPS.findIndex((s) => s.key === b.status);
  if (!introDone && step >= 0) return <StatusIntro steps={STEPS} current={step} eyebrow="Booking" title={`${b.service.name} · #${b.id}`} onDone={() => setIntroDone(true)} />;

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true); setMsg('');
    try { await fn(); setMsg(ok); await reload(); } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  };
  const open = b.status !== 'DONE' && b.status !== 'CANCELLED';
  const canMove = b.status === 'REQUESTED' || b.status === 'CONFIRMED';

  return <Screen refresh={refresh} refreshing={refreshing}>
    <Row between><Txt bold size={22}>#{b.id}</Txt><Badge v={b.status} /></Row>
    <Card>
      <Txt bold size={17}>{b.service.name}</Txt>
      <Txt>{dayLabel(b.day)} at {b.slot}</Txt>
      <Txt muted>{b.provider ? `Pro: ${b.provider.name}` : 'Pro will be assigned shortly'}</Txt>
      <Address>{b.address}</Address>
      <Txt muted>Estimate {money(b.estimate)}</Txt>
      {!!b.notes && <Txt muted>Notes: {b.notes}</Txt>}
    </Card>

    {b.status !== 'CANCELLED' && <Card>
      <Eyebrow>Booking status</Eyebrow>
      <Timeline steps={STEPS} current={step} />
      {b.status === 'ON_THE_WAY' && b.provider?.lat != null && b.provider?.lng != null && b.lat != null && b.lng != null &&
        <LiveMap home={{ lat: b.lat, lng: b.lng }} pro={{ lat: b.provider.lat, lng: b.provider.lng }} label={`${b.provider.name} is on the way`} />}
    </Card>}

    {!!msg && <Txt color={/fail|cannot|taken|late|closed|Cannot/.test(msg) ? t.bad : t.ok}>{msg}</Txt>}

    {canMove && !resched && <Button title="Reschedule" kind="ghost" onPress={() => setResched(true)} />}
    {resched && <Card>
      <Txt bold>Pick a new time</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{days.map((d) => <Chip key={d} title={dayLabel(d)} on={d === day} onPress={() => { setDay(d); setSlot(''); }} />)}</View>
      {avail.data && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {avail.data.slots.map((s: any) => <Chip key={s.slot} title={s.slot} on={slot === s.slot} disabled={!s.available} onPress={() => setSlot(s.slot)} />)}
      </View>}
      <Button title="Save new time" disabled={!slot} busy={busy} onPress={() => run(async () => { await api(`/bookings/${b.id}`, 'PATCH', { day, slot }); setResched(false); }, 'Rescheduled.')} />
      <Button title="Never mind" kind="ghost" onPress={() => setResched(false)} />
    </Card>}
    {open && <Button title="Cancel booking" kind="danger" busy={busy} onPress={() => confirm(`Cancel booking #${b.id}?`, () => run(() => api(`/bookings/${b.id}`, 'PATCH', { status: 'CANCELLED' }), 'Booking cancelled.'))} />}

    {b.status === 'DONE' && (b.review
      ? <Card><Txt bold>Your review</Txt><Stars value={b.review.rating} />{!!b.review.text && <Txt>{b.review.text}</Txt>}</Card>
      : <Card>
        <Txt bold>How did it go?</Txt>
        <Stars value={rating} onChange={setRating} />
        <Field label="Comment (optional)" value={text} onChangeText={setText} multiline />
        <Button title="Submit review" disabled={!rating} busy={busy} onPress={() => run(() => api('/reviews', 'POST', { kind: 'service', target: b.serviceId, bookingId: b.id, rating, ...(text.trim() ? { text: text.trim() } : {}) }), 'Thanks for your review!')} />
      </Card>)}
  </Screen>;
}
