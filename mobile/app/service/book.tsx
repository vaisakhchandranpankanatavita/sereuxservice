import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import CouponBox, { type AppliedCoupon } from '../../src/CouponBox';
import { useAddresses } from '../../src/addresses';
import { usePlaceSuggestions, type Place } from '../../src/places';
import { useSession } from '../../src/session';
import { Avatar, Banner, Button, Card, Chip, FadeIn, Field, R, Row, Screen, Skeleton, Status, Tap, Txt, dayLabel, font, money, useFetch, useTheme } from '../../src/ui';

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
  const { serviceId, providerId, rebook } = useLocalSearchParams<{ serviceId: string; providerId?: string; rebook?: string }>();
  const router = useRouter();
  const { user } = useSession();
  const t = useTheme();
  const svc = useFetch<any>(`/services/${serviceId}`);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => isoDay(i + 1)), []);
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState('');
  const avail = useFetch<any>(`/services/${serviceId}/availability?day=${day}${providerId ? `&providerId=${providerId}` : ''}`);
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', address: '', notes: '' });
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggest, setSuggest] = useState(false);
  const { results: places, loading: placesLoading } = usePlaceSuggestions(f.address, suggest);
  const { list: addrs, add: saveAddr, remove: removeAddr } = useAddresses();
  const [saving, setSaving] = useState<{ open: boolean; label: string }>({ open: false, label: '' });
  useEffect(() => setSlot(''), [day]);

  /* "Book again": carry over contact details, address and notes from the earlier booking. */
  const prev = useFetch<any>(rebook ? `/bookings/${rebook}` : null);
  const prefilled = useRef(false);
  useEffect(() => {
    const b = prev.data;
    if (!b || prefilled.current) return;
    prefilled.current = true;
    setF({ name: b.name, phone: b.phone, address: b.address, notes: b.notes ?? '' });
    if (b.lat != null && b.lng != null) setCoords({ lat: b.lat, lng: b.lng });
  }, [prev.data]);

  const useMyLocation = async () => {
    setLocBusy(true); setErr('');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { setErr('Location permission denied.'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const addr = [place?.name, place?.street, place?.district, place?.city, place?.region, place?.postalCode].filter(Boolean).join(', ');
      if (addr) { setF((p) => ({ ...p, address: addr })); setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setSuggest(false); } else setErr('Could not determine your address from your location.');
    } catch { setErr('Could not get your location. Check location is enabled and try again.'); }
    finally { setLocBusy(false); }
  };

  const typeAddress = (v: string) => { setF((p) => ({ ...p, address: v })); setCoords(null); setSuggest(true); };
  const pickPlace = (pl: Place) => { setF((p) => ({ ...p, address: pl.label })); setCoords({ lat: pl.lat, lng: pl.lng }); setSuggest(false); };
  const pickSaved = (a: { address: string; lat?: number; lng?: number }) => { setF((p) => ({ ...p, address: a.address })); setCoords(a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : null); setSuggest(false); };

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
      const b = await api('/bookings', 'POST', { serviceId: Number(serviceId), ...(providerId ? { providerId: Number(providerId) } : {}), day, slot, name: f.name.trim(), phone: f.phone, address: f.address.trim(), ...(coords ? { lat: coords.lat, lng: coords.lng } : {}), ...(f.notes.trim() ? { notes: f.notes.trim() } : {}), ...(coupon ? { coupon: coupon.code } : {}) });
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
          <Pressable onPress={() => pickSaved(a)} accessibilityRole="button" style={{ flex: 1 }}>
            <Txt bold size={13}>{a.label}</Txt>
            <Txt muted size={12} numberOfLines={1}>{a.address}</Txt>
          </Pressable>
          <Pressable onPress={() => removeAddr(a.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${a.label}`}>
            <Txt color={t.bad} size={12}>Remove</Txt>
          </Pressable>
        </Row>)}
      </View>}
      <Field onCard label="Service address" value={f.address} onChangeText={typeAddress} multiline autoComplete="street-address" placeholder="Start typing to search, e.g. MG Road, Kochi" />
      {suggest && (placesLoading || places.length > 0) && <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: t.line, overflow: 'hidden' }} accessibilityLabel="Address suggestions">
        {placesLoading && !places.length && <Txt muted size={13} style={{ padding: 12 }}>Searching…</Txt>}
        {places.map((pl, i) => <Pressable key={`${pl.lat},${pl.lng},${i}`} onPress={() => pickPlace(pl)} accessibilityRole="button" accessibilityLabel={`Use ${pl.label}`}
          style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderColor: t.line }}>
          <Ionicons name="location-outline" size={18} color={t.ink} />
          <Txt size={14} numberOfLines={2} style={{ flex: 1 }}>{pl.label}</Txt>
        </Pressable>)}
        <Txt muted size={10} style={{ padding: 8, textAlign: 'right' }}>© OpenStreetMap contributors</Txt>
      </View>}
      {!!f.address.trim() && !suggest && (coords
        ? <Row style={{ gap: 6 }}><Ionicons name="checkmark-circle" size={16} color={t.green} /><Txt size={13} color={t.body}>Location pinned — your pro will see it on the map.</Txt></Row>
        : <Txt size={13} color={t.body}>Tip: pick a suggestion so your pro can find you on the map.</Txt>)}
      {!!f.address.trim() && !saving.open && <Pressable onPress={() => setSaving({ open: true, label: '' })} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
        <Txt size={14} bold>Save this address for later</Txt>
      </Pressable>}
      {saving.open && <Card tint="#fff" style={{ padding: 14, gap: 10 }}>
        <Field onCard label="Label (e.g. Home, Work)" value={saving.label} onChangeText={(label) => setSaving((s) => ({ ...s, label }))} />
        <Row>
          <Button title="Save" style={{ flex: 1 }} disabled={!saving.label.trim()} onPress={() => { saveAddr({ label: saving.label.trim(), name: f.name, phone: f.phone, address: f.address.trim(), ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) }); setSaving({ open: false, label: '' }); }} />
          <Button title="Cancel" kind="ghost" style={{ flex: 1 }} onPress={() => setSaving({ open: false, label: '' })} />
        </Row>
      </Card>}
      <Field onCard label="Notes for the pro (optional)" value={f.notes} onChangeText={set('notes')} multiline />
    </Card></FadeIn>}

    {step === 2 && <FadeIn key="s2" rise={12} style={{ gap: 14 }}>
      <View style={{ gap: 2 }}>
        <Txt bold size={22}>Review booking</Txt>
        <Txt muted size={13}>Check your visit details before confirming.</Txt>
      </View>

      {/* Service & Time Card */}
      <Card style={{ padding: 18, gap: 14 }}>
        <Row between>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt muted size={12} style={{ letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: font.bold }}>Service</Txt>
            <Txt bold size={16}>{svc.data.name}</Txt>
            {pro && <Txt size={13} color={t.body}>Assigned Pro: <Text style={{ fontFamily: font.bold }}>{pro.name}</Text></Txt>}
          </View>
          <View style={{ backgroundColor: t.bg, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'flex-end', borderWidth: 1, borderColor: t.line }}>
            <Row style={{ gap: 5 }}>
              <Ionicons name="calendar-outline" size={14} color={t.ink} />
              <Txt bold size={13}>{dayLabel(day)}</Txt>
            </Row>
            {slot ? <Txt size={12} color={t.muted} style={{ marginTop: 2 }}>{slot}</Txt> : null}
          </View>
        </Row>
      </Card>

      {/* Location & Contact Card */}
      <Card style={{ padding: 18, gap: 14 }}>
        <View style={{ gap: 2 }}>
          <Txt muted size={12} style={{ letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: font.bold }}>Service Location</Txt>
          <Row style={{ alignItems: 'flex-start', gap: 8, marginTop: 4 }}>
            <Ionicons name="location-outline" size={18} color={t.ink} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt bold size={14}>{f.address}</Txt>
              <Txt muted size={13}>{f.name} · {f.phone}</Txt>
            </View>
          </Row>
        </View>
        {f.notes?.trim() ? (
          <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: t.line, gap: 2 }}>
            <Txt muted size={12}>Notes for pro:</Txt>
            <Txt size={13} color={t.body}>{f.notes.trim()}</Txt>
          </View>
        ) : null}
      </Card>

      {/* Price & Summary */}
      <Card style={{ padding: 18, gap: 12 }}>
        <CouponBox onCard applied={coupon} onChange={setCoupon} />
        <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: t.line, gap: 8 }}>
          <Row between>
            <Txt muted size={14}>Estimated starting price</Txt>
            <Txt size={14}>{money(svc.data.fromPrice)}</Txt>
          </Row>
          {coupon ? (
            <Row between>
              <Txt size={13} color={t.ok}>Coupon discount ({coupon.code})</Txt>
              <Txt size={13} color={t.ok}>−{money(Math.round(svc.data.fromPrice * coupon.percent / 100))}</Txt>
            </Row>
          ) : null}
          <Row between style={{ marginTop: 2 }}>
            <View>
              <Txt bold size={16}>Estimated total</Txt>
              <Txt muted size={11}>Final rate confirmed on site</Txt>
            </View>
            <Txt bold size={22}>from {money(svc.data.fromPrice - (coupon ? Math.round(svc.data.fromPrice * coupon.percent / 100) : 0))}</Txt>
          </Row>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.okBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.sm, marginTop: 4 }}>
          <Ionicons name="shield-checkmark" size={14} color={t.ok} />
          <Txt size={12} color={t.ok} style={{ fontFamily: font.medium }}>Pay after service is completed · No upfront fee</Txt>
        </View>
      </Card>
    </FadeIn>}

    {!!err && <Banner kind="bad">{err}</Banner>}
    <Row>
      {step > 0 && <Button title="Back" kind="ghost" style={{ flex: 1 }} onPress={() => setStep((s) => s - 1)} />}
      {step < 2
        ? <Button title="Next" style={{ flex: 1 }} disabled={!stepReady} onPress={() => setStep((s) => s + 1)} />
        : <Button title="Confirm booking" style={{ flex: 1 }} onPress={submit} busy={busy} disabled={!ready} />}
    </Row>
  </Screen>;
}
