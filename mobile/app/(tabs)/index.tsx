import { useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Chip, Chips, Field, R, RoundBtn, Screen, Status, Tap, Txt, Wash, dayLabel, money, useFetch, useTheme } from '../../src/ui';
import { useSession } from '../../src/session';
import { ServiceArt } from '../../src/serviceArt';
import PageHeader, { PageSpace } from '../../src/PageHeader';

export default function Services() {
  const router = useRouter();
  const t = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { user } = useSession();
  const { data, error, refreshing, refresh } = useFetch<any[]>('/services');
  const bookings = useFetch<any[]>('/bookings', 30000);
  const notes = useFetch<any[]>('/notifications', 30000);
  const unread = notes.data?.filter((n) => !n.read).length ?? 0;
  const upcoming = useMemo(() => (bookings.data ?? [])
    .filter((b) => b.status !== 'DONE' && b.status !== 'CANCELLED')
    .sort((a, b) => `${a.day} ${a.slot}`.localeCompare(`${b.day} ${b.slot}`))[0], [bookings.data]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cats = useMemo(() => [...new Set((data ?? []).map((s) => s.category))], [data]);
  const rows = useMemo(() => (data ?? []).filter((s) => (!cat || s.category === cat)
    && `${s.name} ${s.description} ${s.terms}`.toLowerCase().includes(q.trim().toLowerCase())), [data, q, cat]);
  const suggestions = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const names = [...new Set((data ?? []).map((s) => s.name))].filter((n) => n.toLowerCase().includes(needle));
    return names[0]?.toLowerCase() === needle ? [] : names.slice(0, 6);
  }, [data, q]);

  const pick = (name: string) => { setQ(name); setOpen(false); Keyboard.dismiss(); };
  const tints = [t.lime, t.peach, t.pink, t.green];

  const card = (s: any, i: number) => <View key={s.id} style={{ width: '48.2%' }}>
    <Tap onPress={() => router.push(`/service/${s.id}`)} accessibilityRole="button" accessibilityLabel={`${s.name}, from ${money(s.fromPrice)}`} scaleTo={0.96}
      style={{ backgroundColor: tints[i % tints.length], borderRadius: R.lg, height: 220, overflow: 'hidden', justifyContent: 'space-between', padding: 12 }}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}><ServiceArt name={s.name} /></View>
      <LinearGradient pointerEvents="none" colors={['rgba(20,20,20,0.28)', 'rgba(20,20,20,0)', 'rgba(20,20,20,0.78)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
        <Txt size={14} bold>{s.category}</Txt>
      </View>
      <View style={{ gap: 3 }}>
        <Txt bold size={26} color="#fff" numberOfLines={2}>{s.name}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6 }}>
          <Txt size={13} color="rgba(255,255,255,0.85)">from</Txt>
          <Txt size={24} bold color="#fff">{money(s.fromPrice)}</Txt>
          <Txt size={13} color="rgba(255,255,255,0.85)">· {s.duration} min</Txt>
        </View>
      </View>
    </Tap>
  </View>;

  return <View style={{ flex: 1 }}>
    <PageHeader eyebrow="WHAT DO YOU NEED?" title="Pick a service" right={<>
      <Pressable onPress={() => router.push('/activity')} accessibilityRole="button" accessibilityLabel="See my bookings"
        style={{ backgroundColor: t.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Txt bold size={13} color="#fff">My bookings</Txt>
      </Pressable>
      <View>
        <RoundBtn size={40} icon="notifications-outline" label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onPress={() => router.push('/notifications')} />
        {unread > 0 && <View pointerEvents="none" style={{ position: 'absolute', top: -3, right: -3, backgroundColor: t.pink, borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={10} bold color={t.ink}>{unread > 9 ? '9+' : unread}</Txt>
        </View>}
      </View>
    </>} />
    <PageSpace />
    <View style={{ zIndex: 10, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10, gap: 12 }}>
      <View style={{ zIndex: 10 }}>
        <Field label="" small value={q} placeholder="Search…"
          onChangeText={(v) => { setQ(v); setOpen(true); }}
          onFocus={() => q.trim() && setOpen(true)}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }} />
        {open && suggestions.length > 0 && <View style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, backgroundColor: '#fff',
          borderRadius: R.md, overflow: 'hidden', zIndex: 20,
          shadowColor: '#232323', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
        }}>
          {suggestions.map((name, i) => <Pressable key={name}
            onPress={() => { clearTimeout(blurTimer.current); pick(name); }}
            style={({ pressed }) => [{ paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderColor: t.line }, pressed && { backgroundColor: t.card }]}>
            <Txt size={15}>{name}</Txt>
          </Pressable>)}
        </View>}
      </View>
      <Chips>
        <Chip title="All" on={!cat} onPress={() => setCat('')} />
        {cats.map((c) => <Chip key={c} title={c} on={cat === c} onPress={() => setCat(c)} />)}
      </Chips>
      {!!upcoming && !q.trim() && !cat && <Tap onPress={() => router.push(`/booking/${upcoming.id}`)} accessibilityRole="button" accessibilityLabel={`Upcoming booking, ${upcoming.service.name}`} scaleTo={0.98}
        style={{ backgroundColor: t.lime, borderRadius: R.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
        <Wash />
        <View style={{ width: 52, height: 52, borderRadius: 18, overflow: 'hidden', backgroundColor: '#fff' }}><ServiceArt name={upcoming.service.name} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={11} bold color={t.body}>UP NEXT</Txt>
          <Txt bold size={16} numberOfLines={1}>{upcoming.service.name}</Txt>
          <Txt size={13} color={t.body}>{dayLabel(upcoming.day)} · {upcoming.slot}</Txt>
        </View>
        <Badge v={upcoming.status} />
      </Tap>}
    </View>
    <Screen pad={false} bottomPad={100} refresh={() => { refresh(); bookings.refresh(); notes.refresh(); }} refreshing={refreshing}>
    <View style={{ paddingHorizontal: 18, paddingTop: 4, gap: 14 }}>
      <Status error={error} loading={!data && !error} empty={data && !rows.length ? 'No services match your search. Try another word or clear the filter.' : undefined} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>{rows.map(card)}</View>
    </View>
    </Screen>
  </View>;
}
