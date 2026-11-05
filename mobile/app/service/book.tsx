import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useSession } from '../../src/session';
import { Avatar, Button, Card, Chip, Chips, Eyebrow, Field, Row, Screen, Status, Txt, dayLabel, money, useFetch, useTheme } from '../../src/ui';

const isoDay = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function Book() {
  const { serviceId, providerId } = useLocalSearchParams<{ serviceId: string; providerId?: string }>();
  const router = useRouter();
  const { user } = useSession();
  const t = useTheme();
  const svc = useFetch<any>(`/services/${serviceId}`);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => isoDay(i + 1)), []);
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState('');
  const avail = useFetch<any>(`/services/${serviceId}/availability?day=${day}${providerId ? `&providerId=${providerId}` : ''}`);
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', address: '', notes: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  useEffect(() => setSlot(''), [day]);

  const useMyLocation = async () => {
    setLocBusy(true); setErr('');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { setErr('Location permission denied.'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const addr = [place?.name, place?.street, place?.district, place?.city, place?.region, place?.postalCode].filter(Boolean).join(', ');
      if (addr) setF((p) => ({ ...p, address: addr })); else setErr('Could not determine your address from your location.');
    } catch { setErr('Could not get your location. Check location is enabled and try again.'); }
    finally { setLocBusy(false); }
  };

  const pro = svc.data?.providers.find((p: any) => String(p.id) === providerId);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const phoneOk = /^[0-9+\s-]{8,15}$/.test(f.phone);
  const reason = !slot ? 'Pick a time slot to continue'
    : !f.name.trim() ? 'Enter your name'
    : !phoneOk ? 'Enter a valid phone number'
    : !f.address.trim() ? 'Enter your address'
    : '';
  const ready = !reason;

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const b = await api('/bookings', 'POST', { serviceId: Number(serviceId), ...(providerId ? { providerId: Number(providerId) } : {}), day, slot, name: f.name.trim(), phone: f.phone, address: f.address.trim(), ...(f.notes.trim() ? { notes: f.notes.trim() } : {}) });
      router.replace(`/booking/${b.id}`);
    } catch (e: any) { setErr(e.message); setBusy(false); if (e.status === 409) avail.reload(); }
  };

  if (!svc.data) return <Screen><Status error={svc.error} loading={!svc.error} /></Screen>;

  return <Screen>
    <Eyebrow>Book a service</Eyebrow>
    <Txt bold size={26}>{svc.data.name}</Txt>
    <Txt muted size={16}>Estimate from {money(svc.data.fromPrice)} · final price confirmed by your pro</Txt>

    {pro && <Card>
      <Row>
        <Avatar name={pro.name} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt bold size={17}>{pro.name}{pro.verified ? '  ✓' : ''}</Txt>
          <Txt muted size={14}>{pro.years} yrs · responds in {pro.response}</Txt>
        </View>
      </Row>
      {!!pro.bio && <Txt muted size={14} style={{ marginTop: 2 }}>{pro.bio}</Txt>}
    </Card>}

    <Card>
      <Txt bold size={19}>1. When works for you?</Txt>
      <Txt bold size={15} style={{ marginTop: 4, marginBottom: 8 }}>Day</Txt>
      <Chips>{days.map((d) => <Chip key={d} title={dayLabel(d)} on={d === day} onPress={() => setDay(d)} />)}</Chips>

      <Txt bold size={15} style={{ marginTop: 16, marginBottom: 8 }}>Time</Txt>
      {!avail.data ? <Status error={avail.error} loading={!avail.error} /> :
        !avail.data.slots.length ? <Txt muted size={15}>No slots open this day — try another.</Txt> :
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {avail.data.slots.map((s: any) => <Chip key={s.slot} title={s.available ? s.slot : `${s.slot} · taken`} on={slot === s.slot} disabled={!s.available} onPress={() => setSlot(s.slot)} />)}
        </View>}
    </Card>

    <Card>
      <Txt bold size={19}>2. Your details</Txt>
      <Field label="Full name" value={f.name} onChangeText={set('name')} autoComplete="name" />
      <Field label="Phone number" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
      {!!f.phone && !phoneOk && <Txt color={t.bad} size={14}>Enter a valid phone number</Txt>}
      <Pressable onPress={useMyLocation} disabled={locBusy} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
        <Txt size={15} bold color={t.accent}>{locBusy ? 'Locating…' : '📍 Use my current location'}</Txt>
      </Pressable>
      <Field label="Service address" value={f.address} onChangeText={set('address')} multiline autoComplete="street-address" />
      <Field label="Notes for the pro (optional)" value={f.notes} onChangeText={set('notes')} multiline />
    </Card>

    <Card>
      <Txt bold size={19}>3. Review & confirm</Txt>
      <Row between style={{ marginTop: 10 }}><Txt muted size={16}>Service</Txt><Txt bold size={16}>{svc.data.name}{pro ? ` · ${pro.name}` : ''}</Txt></Row>
      <Row between><Txt muted size={16}>When</Txt><Txt bold size={16}>{dayLabel(day)}{slot ? ` · ${slot}` : ''}</Txt></Row>
      <Row between><Txt muted size={16}>Estimate</Txt><Txt bold size={18} color={t.brand}>from {money(svc.data.fromPrice)}</Txt></Row>
      {!!err && <Txt color={t.bad} size={15} style={{ marginTop: 8 }}>{err}</Txt>}
      <Button title="Confirm booking" onPress={submit} busy={busy} disabled={!ready} style={{ marginTop: 12 }} />
      {!ready && <Txt muted size={14} style={{ textAlign: 'center', marginTop: 8 }}>{reason}</Txt>}
    </Card>
  </Screen>;
}
