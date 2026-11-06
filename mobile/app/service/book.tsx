import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAddresses } from '../../src/addresses';
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
  const { list: addrs, add: saveAddr, remove: removeAddr } = useAddresses();
  const [saving, setSaving] = useState<{ open: boolean; label: string }>({ open: false, label: '' });
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

  const STEPS = ['When', 'Details', 'Review'];
  const [step, setStep] = useState(0);
  const stepReady = [!!slot, f.name.trim() && phoneOk && !!f.address.trim(), ready][step];

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

    <View style={{ flexDirection: 'row', gap: 6 }}>
      {STEPS.map((s, i) => <View key={s} style={{ flex: 1, gap: 6, alignItems: 'center' }}>
        <View style={{ height: 3, width: '100%', borderRadius: 2, backgroundColor: i <= step ? t.accent : t.line }} />
        <Txt size={11} bold muted={i !== step} color={i === step ? t.ink : undefined}>{i + 1}. {s}</Txt>
      </View>)}
    </View>

    {step === 0 && <Card>
      <Txt bold size={17} style={{ marginBottom: 10 }}>Day</Txt>
      <Chips>{days.map((d) => <Chip key={d} title={dayLabel(d)} on={d === day} onPress={() => setDay(d)} big />)}</Chips>

      <Txt bold size={17} style={{ marginTop: 20, marginBottom: 10 }}>Time</Txt>
      {!avail.data ? <Status error={avail.error} loading={!avail.error} /> :
        !avail.data.slots.length ? <Txt muted size={15}>No slots open this day — try another.</Txt> :
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {avail.data.slots.map((s: any) => <Chip key={s.slot} title={s.available ? s.slot : `${s.slot} · taken`} on={slot === s.slot} disabled={!s.available} onPress={() => setSlot(s.slot)} big />)}
        </View>}
    </Card>}

    {step === 1 && <Card>
      <Field label="Full name" value={f.name} onChangeText={set('name')} autoComplete="name" />
      <Field label="Phone number" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
      {!!f.phone && !phoneOk && <Txt color={t.bad} size={14}>Enter a valid phone number</Txt>}
      <Pressable onPress={useMyLocation} disabled={locBusy} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
        <Txt size={15} bold color={t.accent}>{locBusy ? 'Locating…' : '📍 Use my current location'}</Txt>
      </Pressable>
      {addrs.length > 0 && <View style={{ gap: 6 }}>
        <Txt bold size={15}>Saved addresses</Txt>
        {addrs.map((a) => <Row key={a.id} between>
          <Pressable onPress={() => set('address')(a.address)} accessibilityRole="button" style={{ flex: 1 }}>
            <Txt bold size={14}>{a.label}</Txt>
            <Txt muted size={13} numberOfLines={1}>{a.address}</Txt>
          </Pressable>
          <Pressable onPress={() => removeAddr(a.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${a.label}`}>
            <Txt color={t.bad} size={13}>Remove</Txt>
          </Pressable>
        </Row>)}
      </View>}
      <Field label="Service address" value={f.address} onChangeText={set('address')} multiline autoComplete="street-address" />
      {!!f.address.trim() && !saving.open && <Pressable onPress={() => setSaving({ open: true, label: '' })} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
        <Txt size={14} bold color={t.accent}>Save this address for later</Txt>
      </Pressable>}
      {saving.open && <Card>
        <Field label="Label (e.g. Home, Work)" value={saving.label} onChangeText={(label) => setSaving((s) => ({ ...s, label }))} />
        <Row>
          <Button title="Save" style={{ flex: 1 }} disabled={!saving.label.trim()} onPress={() => { saveAddr({ label: saving.label.trim(), name: f.name, phone: f.phone, address: f.address.trim() }); setSaving({ open: false, label: '' }); }} />
          <Button title="Cancel" kind="ghost" style={{ flex: 1 }} onPress={() => setSaving({ open: false, label: '' })} />
        </Row>
      </Card>}
      <Field label="Notes for the pro (optional)" value={f.notes} onChangeText={set('notes')} multiline />
    </Card>}

    {step === 2 && <Card>
      <Row between style={{ marginTop: 2 }}><Txt muted size={16}>Service</Txt><Txt bold size={16}>{svc.data.name}{pro ? ` · ${pro.name}` : ''}</Txt></Row>
      <Row between><Txt muted size={16}>When</Txt><Txt bold size={16}>{dayLabel(day)}{slot ? ` · ${slot}` : ''}</Txt></Row>
      <Row between><Txt muted size={16}>Name</Txt><Txt bold size={16}>{f.name}</Txt></Row>
      <Row between><Txt muted size={16}>Phone</Txt><Txt bold size={16}>{f.phone}</Txt></Row>
      <Row between style={{ alignItems: 'flex-start' }}><Txt muted size={16}>Address</Txt><Txt bold size={16} style={{ flex: 1, textAlign: 'right' }}>{f.address}</Txt></Row>
      <Row between><Txt muted size={16}>Estimate</Txt><Txt bold size={18} color={t.brand}>from {money(svc.data.fromPrice)}</Txt></Row>
    </Card>}

    {!!err && <Txt color={t.bad} size={15}>{err}</Txt>}
    <Row>
      {step > 0 && <Button title="Back" kind="ghost" style={{ flex: 1 }} onPress={() => setStep((s) => s - 1)} />}
      {step < 2
        ? <Button title="Next" style={{ flex: 1 }} disabled={!stepReady} onPress={() => setStep((s) => s + 1)} />
        : <Button title="Confirm booking" style={{ flex: 1 }} onPress={submit} busy={busy} disabled={!ready} />}
    </Row>
  </Screen>;
}
