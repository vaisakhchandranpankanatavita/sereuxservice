import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useReducedMotion } from '../../src/authkit';
import { Button, SlideToConfirm, Card, OnlineSwitch, PageTitle, R, Screen, Status, Txt, Money, money, dayLabel, font, mono, overline, setOnlineFlag, useFetch, useTheme } from '../../src/ui';

/* One labelled fact row: a quiet icon, then the value. Keeps cards scannable without bordered sub-boxes. */
function Fact({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: string }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
    <Ionicons name={icon} size={18} color={t.muted} style={{ marginTop: 1 }} />
    <Text style={{ flex: 1, color: t.body, fontFamily: font.regular, fontSize: 15, lineHeight: 21 }}>{children}</Text>
  </View>;
}

/* Keep the completed-work shortcut compact; full history lives in My jobs. */
function RecentJobs() {
  const t = useTheme();
  const router = useRouter();
  const jobs = useFetch<any[]>('/pro/jobs');
  const done = (jobs.data ?? []).filter((j) => j.status === 'DONE')
    .sort((a, b) => (b.day + b.slot).localeCompare(a.day + a.slot));
  if (!jobs.data || done.length === 0) return null;
  const net = (j: any) => Math.max(0, (j.estimate || 0) - (j.discount || 0));
  const earned = done.reduce((s, j) => s + net(j), 0);
  return <Pressable onPress={() => router.push('/jobs')} accessibilityRole="button" accessibilityLabel={`Open job history. ${done.length} completed, ${money(earned)} earned`}
    style={({ pressed }: any) => ({ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, backgroundColor: pressed ? t.surface : t.card, borderRadius: R.md, borderCurve: 'continuous' })}>
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="briefcase-outline" size={16} color={t.muted} />
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: t.ink, fontFamily: font.semibold, fontSize: 14 }}>Recent work</Text>
      <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 12 }}>{done.length} completed · {money(earned)} earned</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={t.muted} />
  </Pressable>;
}

const TIPS = [
  'Check the address before you set off.',
  'Keep customers updated on your arrival.',
  'Confirm the customer code before work.',
  'Add an after photo before completing a job.',
];

/* A quiet, single-line tip at the bottom; it rotates gently and can always be paused. */
function TipCarousel() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const next = () => setIndex((current) => (current + 1) % TIPS.length);

  useEffect(() => {
    if (paused || reduced) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % TIPS.length), 6500);
    return () => clearInterval(timer);
  }, [paused, reduced]);

  useEffect(() => {
    fade.setValue(0);
    const animation = Animated.timing(fade, { toValue: 1, duration: reduced ? 120 : 180, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [index, reduced, fade]);

  const controlLabel = reduced ? 'Next tip' : paused ? 'Resume rotating tips' : 'Pause rotating tips';
  return <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, backgroundColor: t.card, borderRadius: R.md, borderCurve: 'continuous' }}>
    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="bulb-outline" size={15} color={t.muted} />
    </View>
    <Pressable onPress={next} accessibilityRole="button" accessibilityLabel="Show next tip" style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
      <Animated.Text numberOfLines={1} ellipsizeMode="tail" style={{ color: t.body, fontFamily: font.medium, fontSize: 13, opacity: fade }}>{TIPS[index]}</Animated.Text>
    </Pressable>
    <Pressable onPress={reduced ? next : () => setPaused((value) => !value)} accessibilityRole="button" accessibilityLabel={controlLabel} accessibilityState={{ selected: paused }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
      <Ionicons name={reduced ? 'chevron-forward' : paused ? 'play-outline' : 'pause-outline'} size={17} color={t.muted} />
    </Pressable>
  </View>;
}

function EmptyRequests({ offline }: { offline: boolean }) {
  const t = useTheme();
  return <View style={{ alignItems: 'center', gap: 5, paddingVertical: 24 }}>
    <Text style={{ color: t.ink, fontFamily: font.semibold, fontSize: 16 }}>{offline ? 'You’re offline' : 'No new requests'}</Text>
    <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
      {offline ? 'Go online when you’re ready to receive nearby work.' : 'We’ll let you know when a nearby customer needs help.'}
    </Text>
  </View>;
}

export default function Requests() {
  const t = useTheme();
  const me = useFetch<any>('/pro/me');
  useEffect(() => { if (me.data) setOnlineFlag(!!me.data.online); }, [me.data]);
  const reqs = useFetch<any[]>('/pro/requests', 15000);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const act = async (id: string, kind: 'accept' | 'decline') => {
    setBusy(id); setErr('');
    try { await api(`/pro/bookings/${id}/${kind}`, 'POST'); await reqs.reload(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const toggleOnline = async (v: boolean) => {
    try { await api('/pro/online', 'PATCH', { online: v }); setOnlineFlag(v); me.reload(); }
    catch (e: any) { setErr(e.message); }
  };

  const online = !!me.data?.online;
  const count = reqs.data?.length ?? 0;

  return <Screen refresh={reqs.refresh} refreshing={reqs.refreshing} footer={<TipCarousel />}
    header={<PageTitle title="Requests"
      sub={!me.data ? ' ' : online ? (count ? `${count} nearby, nearest first` : 'You’re visible to customers nearby.') : 'You’re offline right now.'}
      right={<OnlineSwitch on={online} onToggle={() => toggleOnline(!online)} busy={!me.data} />} />}>

    {err ? <Txt color={t.bad}>{err}</Txt> : null}

    {/* One quiet summary surface replaces three separate stat cards. */}
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderRadius: R.lg, borderCurve: 'continuous' }}>
      <View style={{ flex: 1, paddingHorizontal: 18, paddingVertical: 15, gap: 5 }}>
        <Text style={{ ...overline, color: t.muted }}>New requests</Text>
        <Text style={{ color: t.ink, fontFamily: font.heavy, fontSize: 24, letterSpacing: -0.9 }}>{online ? count : 0}</Text>
      </View>
      <View style={{ width: 1, height: 38, backgroundColor: t.line }} />
      <View style={{ flex: 1, paddingHorizontal: 18, paddingVertical: 15, gap: 5 }}>
        <Text style={{ ...overline, color: t.muted }}>Potential</Text>
        <Text style={{ color: t.ink, fontFamily: font.heavy, fontSize: 24, letterSpacing: -0.9 }} numberOfLines={1} adjustsFontSizeToFit>
          {money(online ? (reqs.data ?? []).reduce((s, r) => s + (Number(r.estimate) || 0), 0) : 0)}
        </Text>
      </View>
    </View>

    {!online ? <EmptyRequests offline /> :
      !reqs.data ? <Status error={reqs.error} loading={!reqs.error} /> :
      count === 0 ? <EmptyRequests offline={false} /> :
      reqs.data.map((r) => (
        <Card key={r.id} style={{ gap: 14, padding: 18, borderRadius: R.lg, borderCurve: 'continuous' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: t.ink, fontFamily: font.heavy, fontSize: 20, letterSpacing: -0.6 }} numberOfLines={2}>{r.service?.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
                <Ionicons name="calendar-outline" size={14} color={t.muted} />
                <Text style={mono(12, { color: t.muted })}>{dayLabel(r.day)} · {r.slot}</Text>
                {r.distanceKm != null ? <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 12 }}>· {r.distanceKm} km away</Text> : null}
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Money amount={r.estimate} size={20} style={{ alignSelf: 'flex-end' }} />
              <Text style={{ ...overline, color: t.muted }}>Estimate</Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: t.line }} />

          <View style={{ gap: 10 }}>
            <Fact icon="person-outline">{[r.name, r.phone].filter(Boolean).join(' · ')}</Fact>
            <Fact icon="location-outline">{r.address}</Fact>
          </View>
          {r.notes ? <View style={{ borderLeftWidth: 2, borderLeftColor: t.accentLine, paddingLeft: 12 }}><Text style={{ color: t.body, fontFamily: font.regular, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>{r.notes}</Text></View> : null}

          <View style={{ height: 1, backgroundColor: t.line }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SlideToConfirm label="Slide to accept" icon="checkmark" onConfirm={() => act(r.id, 'accept')} busy={busy === r.id} style={{ flex: 1 }} />
            <Button title="Decline" kind="ghost" icon="close" iconOnly onPress={() => act(r.id, 'decline')} disabled={busy === r.id} />
          </View>
        </Card>
      ))}

    <RecentJobs />
  </Screen>;
}
