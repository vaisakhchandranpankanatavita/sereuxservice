import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAddresses } from '../../src/addresses';
import { useSession } from '../../src/session';
import { Avatar, Button, Card, Field, Row, Screen, Status, Txt, dayLabel, font, money, useFetch, useTheme } from '../../src/ui';

const isoDay = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* A day-planner tab: the picked day physically lifts off the strip, like flipping to that page. */
function DayTab({ iso, selected, onPress }: { iso: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const d = new Date(iso + 'T00:00:00');
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={d.toDateString()} accessibilityState={{ selected }}
    style={({ pressed }) => [{
      width: 48, borderRadius: 12, paddingVertical: 8, alignItems: 'center', gap: 2,
      backgroundColor: selected ? t.ink : t.card, borderWidth: 1, borderColor: selected ? t.ink : t.line,
      transform: [{ translateY: selected ? -4 : 0 }],
      shadowColor: '#141412', shadowOpacity: selected ? 0.2 : 0.05, shadowRadius: selected ? 8 : 2, shadowOffset: { width: 0, height: selected ? 4 : 1 }, elevation: selected ? 3 : 1,
    }, pressed && !selected && { opacity: 0.7 }]}>
    <Text style={{ fontFamily: font.hand, fontSize: 13, color: selected ? 'rgba(249,245,242,0.65)' : t.muted }}>{d.toLocaleDateString('en-IN', { weekday: 'short' })}</Text>
    <Text style={{ fontFamily: font.heavy, fontSize: 16, color: selected ? t.brandInk : t.ink }}>{d.getDate()}</Text>
  </Pressable>;
}

/* An appointment-ledger row: a tick mark to select, the time in a precise weight, "Booked" where taken. */
function SlotRow({ time, available, selected, onPress, divider }: { time: string; available: boolean; selected: boolean; onPress: () => void; divider: boolean }) {
  const t = useTheme();
  return <Pressable onPress={available ? onPress : undefined} disabled={!available} accessibilityRole="button" accessibilityState={{ selected, disabled: !available }}
    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: divider ? 1 : 0, borderColor: t.line, opacity: available ? 1 : 0.4 },
      pressed && available && { opacity: 0.65 }]}>
    <View style={{ width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: selected ? t.ink : t.line, backgroundColor: selected ? t.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {selected && <Text style={{ color: t.brandInk, fontSize: 11, fontFamily: font.bold }}>✓</Text>}
    </View>
    <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink, flex: 1 }}>{time}</Text>
    {!available && <Text style={{ fontFamily: font.medium, fontSize: 12, color: t.muted }}>Booked</Text>}
  </Pressable>;
}

const PERIODS: { label: string; icon: keyof typeof Ionicons.glyphMap; test: (h: number) => boolean }[] = [
  { label: 'Morning', icon: 'sunny-outline', test: (h) => h < 12 },
  { label: 'Afternoon', icon: 'partly-sunny-outline', test: (h) => h >= 12 && h < 17 },
  { label: 'Evening', icon: 'moon-outline', test: (h) => h >= 17 },
];

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
    <Row style={{ flexWrap: 'wrap' }}>
      <Txt bold size={22}>{svc.data.name}</Txt>
      <Txt muted size={13}>from {money(svc.data.fromPrice)} · final price confirmed by pro</Txt>
    </Row>

    {pro && <Card style={{ padding: 12, gap: 4 }}>
      <Row>
        <Avatar name={pro.name} size={40} />
        <View style={{ flex: 1, gap: 1 }}>
          <Txt bold size={15}>{pro.name}{pro.verified ? '  ✓' : ''}</Txt>
          <Txt muted size={13}>{pro.years} yrs · responds in {pro.response}</Txt>
        </View>
      </Row>
      {!!pro.bio && <Txt muted size={13} style={{ marginTop: 1 }}>{pro.bio}</Txt>}
    </Card>}

    <View style={{ flexDirection: 'row', gap: 6 }}>
      {STEPS.map((s, i) => <View key={s} style={{ flex: 1, gap: 4, alignItems: 'center' }}>
        <View style={{ height: 3, width: '100%', borderRadius: 2, backgroundColor: i <= step ? t.accent : t.line }} />
        <Txt size={10} bold muted={i !== step} color={i === step ? t.ink : undefined}>{i + 1}. {s}</Txt>
      </View>)}
    </View>

    {step === 0 && <Card style={{ padding: 12, gap: 4 }}>
      <Text style={{ color: t.muted, fontSize: 10, fontFamily: font.bold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Day</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingTop: 4, paddingBottom: 2 }}>
        {days.map((d) => <DayTab key={d} iso={d} selected={d === day} onPress={() => setDay(d)} />)}
      </ScrollView>

      {!avail.data ? <Status error={avail.error} loading={!avail.error} /> :
        !avail.data.slots.length ? <Txt muted size={14} style={{ marginTop: 12 }}>No slots open this day — try another.</Txt> :
        PERIODS.map(({ label, icon, test }) => {
          const items = avail.data.slots.filter((s: any) => test(Number(s.slot.slice(0, 2))));
          if (!items.length) return null;
          return <View key={label}>
            <Row style={{ gap: 6, marginTop: 12 }}>
              <Ionicons name={icon} size={15} color={t.body} />
              <Text style={{ fontFamily: font.bold, fontSize: 14, color: t.body }}>{label}</Text>
            </Row>
            {items.map((s: any, i: number) => <SlotRow key={s.slot} time={s.slot} available={s.available} selected={slot === s.slot} divider={i > 0} onPress={() => setSlot(s.slot)} />)}
          </View>;
        })}
    </Card>}

    {step === 1 && <Card style={{ padding: 12, gap: 8 }}>
      <Field label="Full name" value={f.name} onChangeText={set('name')} autoComplete="name" />
      <Field label="Phone number" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
      {!!f.phone && !phoneOk && <Txt color={t.bad} size={13}>Enter a valid phone number</Txt>}
      <Pressable onPress={useMyLocation} disabled={locBusy} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
        <Txt size={13} bold color={t.accent}>{locBusy ? 'Locating…' : '📍 Use my current location'}</Txt>
      </Pressable>
      {addrs.length > 0 && <View style={{ gap: 4 }}>
        <Txt bold size={13}>Saved addresses</Txt>
        {addrs.map((a) => <Row key={a.id} between>
          <Pressable onPress={() => set('address')(a.address)} accessibilityRole="button" style={{ flex: 1 }}>
            <Txt bold size={13}>{a.label}</Txt>
            <Txt muted size={12} numberOfLines={1}>{a.address}</Txt>
          </Pressable>
          <Pressable onPress={() => removeAddr(a.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${a.label}`}>
            <Txt color={t.bad} size={12}>Remove</Txt>
          </Pressable>
        </Row>)}
      </View>}
      <Field label="Service address" value={f.address} onChangeText={set('address')} multiline autoComplete="street-address" />
      {!!f.address.trim() && !saving.open && <Pressable onPress={() => setSaving({ open: true, label: '' })} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
        <Txt size={13} bold color={t.accent}>Save this address for later</Txt>
      </Pressable>}
      {saving.open && <Card style={{ padding: 12, gap: 8 }}>
        <Field label="Label (e.g. Home, Work)" value={saving.label} onChangeText={(label) => setSaving((s) => ({ ...s, label }))} />
        <Row>
          <Button title="Save" style={{ flex: 1 }} disabled={!saving.label.trim()} onPress={() => { saveAddr({ label: saving.label.trim(), name: f.name, phone: f.phone, address: f.address.trim() }); setSaving({ open: false, label: '' }); }} />
          <Button title="Cancel" kind="ghost" style={{ flex: 1 }} onPress={() => setSaving({ open: false, label: '' })} />
        </Row>
      </Card>}
      <Field label="Notes for the pro (optional)" value={f.notes} onChangeText={set('notes')} multiline />
    </Card>}

    {step === 2 && <Card style={{ padding: 12, gap: 8 }}>
      <Row between><Txt muted size={14}>Service</Txt><Txt bold size={14}>{svc.data.name}{pro ? ` · ${pro.name}` : ''}</Txt></Row>
      <Row between><Txt muted size={14}>When</Txt><Txt bold size={14}>{dayLabel(day)}{slot ? ` · ${slot}` : ''}</Txt></Row>
      <Row between><Txt muted size={14}>Name</Txt><Txt bold size={14}>{f.name}</Txt></Row>
      <Row between><Txt muted size={14}>Phone</Txt><Txt bold size={14}>{f.phone}</Txt></Row>
      <Row between style={{ alignItems: 'flex-start' }}><Txt muted size={14}>Address</Txt><Txt bold size={14} style={{ flex: 1, textAlign: 'right' }}>{f.address}</Txt></Row>
      <Row between><Txt muted size={14}>Estimate</Txt><Txt bold size={16} color={t.brand}>from {money(svc.data.fromPrice)}</Txt></Row>
    </Card>}

    {!!err && <Txt color={t.bad} size={14}>{err}</Txt>}
    <Row>
      {step > 0 && <Button title="Back" kind="ghost" style={{ flex: 1 }} onPress={() => setStep((s) => s - 1)} />}
      {step < 2
        ? <Button title="Next" style={{ flex: 1 }} disabled={!stepReady} onPress={() => setStep((s) => s + 1)} />
        : <Button title="Confirm booking" style={{ flex: 1 }} onPress={submit} busy={busy} disabled={!ready} />}
    </Row>
  </Screen>;
}
