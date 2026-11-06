import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { LiveMap } from '../../src/map';
import { Badge, Button, Card, Field, Row, Status, Screen, Txt, dayLabel, money, useFetch, useTheme } from '../../src/ui';

function ReleaseJob({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!open) return <Button title="Can't make it" kind="danger" onPress={() => setOpen(true)} />;

  const confirm = async () => {
    if (reason.trim().length < 3) { setErr('Add a short reason.'); return; }
    setBusy(true); setErr('');
    try { await api(`/pro/bookings/${id}/release`, 'POST', { reason: reason.trim() }); onDone(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return <Card>
    <Txt bold size={15}>Release this job</Txt>
    <Txt muted size={13}>It goes back to the pool so another pro can take it. The customer is notified.</Txt>
    <Field label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. Vehicle broke down" />
    {!!err && <Txt color="#a13a2a">{err}</Txt>}
    <Row>
      <Button title="Confirm release" kind="danger" onPress={confirm} busy={busy} style={{ flex: 1 }} />
      <Button title="Cancel" kind="ghost" onPress={() => setOpen(false)} disabled={busy} style={{ flex: 1 }} />
    </Row>
  </Card>;
}

export default function Job() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const job = useFetch<any>(`/bookings/${id}`);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const tracking = job.data?.status === 'ON_THE_WAY';

  // While en route, refresh my own GPS fix every 15s and share it so the route line stays current.
  useEffect(() => {
    if (!tracking) return;
    let alive = true;
    const tick = async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!alive) return;
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setMe({ lat, lng });
        api('/pro/location', 'PATCH', { lat, lng }).catch(() => {});
      } catch { /* location unavailable */ }
    };
    tick();
    const t2 = setInterval(tick, 15000);
    return () => { alive = false; clearInterval(t2); };
  }, [tracking]);

  if (!job.data) return <Screen><Status error={job.error} loading={!job.error} /></Screen>;
  const b = job.data;
  const home = b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : null;
  const navigate = () => {
    const q = home ? `${home.lat},${home.lng}` : encodeURIComponent(b.address);
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`);
  };

  return <Screen>
    <Row between>
      <Txt bold size={22}>{b.service?.name}</Txt>
      <Badge v={b.status} />
    </Row>
    <Txt muted>{dayLabel(b.day)} · {b.slot}</Txt>

    {home ? <LiveMap home={home} pro={tracking ? me : null} label={`Route to ${b.address}`} /> :
      <Card><Txt muted>No pinned location for this address yet — the customer booked without sharing GPS coordinates.</Txt></Card>}

    <Card>
      <Txt bold size={16}>{b.name}</Txt>
      <Txt size={15}>{b.phone}</Txt>
      <Txt muted size={14}>{b.address}</Txt>
      {!!b.notes && <Txt muted size={14} style={{ fontStyle: 'italic', marginTop: 4 }}>“{b.notes}”</Txt>}
      <View style={{ marginTop: 8 }}><Row between><Txt muted>Estimate</Txt><Txt bold size={17} color={t.accent}>{money(b.estimate)}</Txt></Row></View>
    </Card>

    <Button title="Navigate" onPress={navigate} />
    <Button title={`Call ${b.name.split(' ')[0]}`} kind="ghost" onPress={() => Linking.openURL(`tel:${b.phone}`)} />
    {b.status === 'CONFIRMED' && <ReleaseJob id={b.id} onDone={() => router.replace('/(tabs)/jobs')} />}
  </Screen>;
}
