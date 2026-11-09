import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAddresses } from '../../src/addresses';
import { useSession } from '../../src/session';
import { Avatar, Banner, Button, Card, Chip, FadeIn, Field, Row, Screen, Skeleton, Status, Tap, Txt, dayLabel, font, money, useFetch, useTheme } from '../../src/ui';

const isoDay = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* A day pill: the picked day turns charcoal and lifts slightly. */
function DayTab({ iso, selected, onPress }: { iso: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const d = new Date(iso + 'T00:00:00');
  return <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel={d.toDateString()} accessibilityState={{ selected }} scaleTo={0.93}
    style={{ width: 58, borderRadius: 22, paddingVertical: 12, alignItems: 'center', gap: 4, backgroundColor: selected ? t.ink : '#fff' }}>
    <Text style={{ fontFamily: font.medium, fontSize: 12, color: selected ? 'rgba(255,255,255,0.7)' : t.muted }}>{d.toLocaleDateString('en-IN', { weekday: 'short' })}</Text>
    <Text style={{ fontFamily: font.heavy, fontSize: 20, letterSpacing: -0.5, color: selected ? '#fff' : t.ink }}>{d.getDate()}</Text>
  </Tap>;
}

/* One segment of the progress bar: the fill grows to full width when its step is reached. */
function Seg({ on }: { on: boolean }) {
  const t = useTheme();
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => { Animated.timing(v, { toValue: on ? 1 : 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [on, v]);
  return <View style={{ height: 5, borderRadius: 3, backgroundColor: t.card, overflow: 'hidden', width: '100%' }}>
    <Animated.View style={{ height: 5, borderRadius: 3, backgroundColor: t.ink, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
  </View>;
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

  if (!svc.data) return <Screen><Status error={svc.error} />{!svc.error && <Skeleton height={120} count={3} />}</Screen>;

  return <Screen>
    <View style={{ gap: 2 }}>
      <Txt bold size={30}>{svc.data.name}</Txt>
      <Txt size={14} color={t.body}>from {money(svc.data.fromPrice)} · final price confirmed by your pro</Txt>
    </View>

    {pro && <Card style={{ padding: 14, gap: 4 }}>
      <Row>
        <Avatar name={pro.name} size={40} />
        <View style={{ flex: 1, gap: 1 }}>
          <Txt bold size={15}>{pro.name}{pro.verified ? '  ✓' : ''}</Txt>
          <Txt muted size={13}>{pro.years} yrs · responds in {pro.response}</Txt>
        </View>
      </Row>
      {!!pro.bio && <Txt muted size={13} style={{ marginTop: 1 }}>{pro.bio}</Txt>}
    </Card>}

    <View style={{ flexDirection: 'row', gap: 8 }}>
      {STEPS.map((s, i) => <View key={s} style={{ flex: 1, gap: 6 }}>
        <Seg on={i <= step} />
        <Txt size={12} bold muted={i !== step}>{i + 1}. {s}</Txt>
      </View>)}
    </View>

    {step === 0 && <FadeIn key="s0" rise={12}><Card style={{ padding: 16, gap: 6 }}>
      <Txt bold size={18}>Pick a day</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
        {days.map((d) => <DayTab key={d} iso={d} selected={d === day} onPress={() => setDay(d)} />)}
      </ScrollView>

      {!avail.data ? (avail.error ? <Status error={avail.error} /> : <Skeleton height={44} count={3} />) :
        !avail.data.slots.length ? <Txt muted size={14} style={{ marginTop: 12 }}>No slots open this day. Try another.</Txt> :
        PERIODS.map(({ label, icon, test }) => {
          const items = avail.data.slots.filter((s: any) => test(Number(s.slot.slice(0, 2))));
          if (!items.length) return null;
          return <View key={label} style={{ gap: 8, marginTop: 10 }}>
            <Row style={{ gap: 6 }}>
              <Ionicons name={icon} size={16} color={t.body} />
              <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>{label}</Text>
            </Row>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {items.map((s: any) => <Chip onCard key={s.slot} title={s.available ? s.slot : `${s.slot} · Booked`} on={slot === s.slot} disabled={!s.available} onPress={() => setSlot(s.slot)} />)}
            </View>
          </View>;
        })}
    </Card></FadeIn>}

    {step === 1 && <FadeIn key="s1" rise={12}><Card style={{ padding: 16, gap: 12 }}>
      <Field onCard label="Full name" value={f.name} onChangeText={set('name')} autoComplete="name" />
      <Field onCard label="Phone number" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
      {!!f.phone && !phoneOk && <Banner kind="bad">Enter a valid phone number</Banner>}
      <Pressable onPress={useMyLocation} disabled={locBusy} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
        <Row style={{ gap: 6 }}><Ionicons name="locate" size={16} color={t.ink} /><Txt size={14} bold>{locBusy ? 'Locating…' : 'Use my current location'}</Txt></Row>
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
      <Field onCard label="Service address" value={f.address} onChangeText={set('address')} multiline autoComplete="street-address" />
      {!!f.address.trim() && !saving.open && <Pressable onPress={() => setSaving({ open: true, label: '' })} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
        <Txt size={14} bold>Save this address for later</Txt>
      </Pressable>}
      {saving.open && <Card tint="#fff" style={{ padding: 14, gap: 10 }}>
        <Field onCard label="Label (e.g. Home, Work)" value={saving.label} onChangeText={(label) => setSaving((s) => ({ ...s, label }))} />
        <Row>
          <Button title="Save" style={{ flex: 1 }} disabled={!saving.label.trim()} onPress={() => { saveAddr({ label: saving.label.trim(), name: f.name, phone: f.phone, address: f.address.trim() }); setSaving({ open: false, label: '' }); }} />
          <Button title="Cancel" kind="ghost" style={{ flex: 1 }} onPress={() => setSaving({ open: false, label: '' })} />
        </Row>
      </Card>}
      <Field onCard label="Notes for the pro (optional)" value={f.notes} onChangeText={set('notes')} multiline />
    </Card></FadeIn>}

    {step === 2 && <FadeIn key="s2" rise={12}><Card style={{ padding: 18, gap: 12 }}>
      <Row between><Txt muted size={14}>Service</Txt><Txt bold size={14}>{svc.data.name}{pro ? ` · ${pro.name}` : ''}</Txt></Row>
      <Row between><Txt muted size={14}>When</Txt><Txt bold size={14}>{dayLabel(day)}{slot ? ` · ${slot}` : ''}</Txt></Row>
      <Row between><Txt muted size={14}>Name</Txt><Txt bold size={14}>{f.name}</Txt></Row>
      <Row between><Txt muted size={14}>Phone</Txt><Txt bold size={14}>{f.phone}</Txt></Row>
      <Row between style={{ alignItems: 'flex-start' }}><Txt muted size={14}>Address</Txt><Txt bold size={14} style={{ flex: 1, textAlign: 'right' }}>{f.address}</Txt></Row>
      <Row between><Txt muted size={14}>Estimate</Txt><Txt bold size={18}>from {money(svc.data.fromPrice)}</Txt></Row>
    </Card></FadeIn>}

    {!!err && <Banner kind="bad">{err}</Banner>}
    <Row>
      {step > 0 && <Button title="Back" kind="ghost" style={{ flex: 1 }} onPress={() => setStep((s) => s - 1)} />}
      {step < 2
        ? <Button title="Next" style={{ flex: 1 }} disabled={!stepReady} onPress={() => setStep((s) => s + 1)} />
        : <Button title="Confirm booking" style={{ flex: 1 }} onPress={submit} busy={busy} disabled={!ready} />}
    </Row>
  </Screen>;
}
