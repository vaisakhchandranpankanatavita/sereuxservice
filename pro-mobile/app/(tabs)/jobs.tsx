import { useState } from 'react';
import { Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { pingLive } from '../../src/live';
import { Money, Screen, Status, dayLabel, font, label, useFetch, useTheme } from '../../src/ui';

const NEXT: Record<string, [string, string]> = {
  CONFIRMED: ['ON_THE_WAY', 'Start trip'],
  ON_THE_WAY: ['IN_PROGRESS', 'Start work'],
  IN_PROGRESS: ['DONE', 'Mark complete'],
};
const FLOW = ['CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'];
const STEP_LABEL = ['Confirmed', 'On the way', 'Working'];
const isActive = (j: any) => j.status !== 'DONE' && j.status !== 'CANCELLED';
/* Work already under way first, then by date and slot, so the top block is always "what to do now". */
const rank = (j: any) => (FLOW.indexOf(j.status) >= 1 ? FLOW.indexOf(j.status) : 0);
const byNow = (a: any, b: any) => rank(b) - rank(a) || `${a.day} ${a.slot}`.localeCompare(`${b.day} ${b.slot}`);

/* Type tokens for this page: a serif for times and headings, Inter for everything you read in a sentence. */
const serif = (size: number, extra: object = {}) => ({ fontFamily: font.display, fontSize: size, letterSpacing: -size * 0.02, ...extra });

export default function Jobs() {
  const t = useTheme();
  const wide = useWindowDimensions().width >= 960;
  const router = useRouter();
  const jobs = useFetch<any[]>('/pro/jobs', 20000);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'active' | 'done'>('active');

  const advance = async (j: any) => {
    const step = NEXT[j.status];
    if (!step) return;
    setBusy(j.id); setErr('');
    try { await api(`/bookings/${j.id}/status`, 'PATCH', { status: step[0] }); await jobs.reload(); pingLive(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const active = (jobs.data ?? []).filter(isActive).sort(byNow);
  const past = (jobs.data ?? []).filter((j) => !isActive(j));
  const [first, ...rest] = active;
  const net = (j: any) => Math.max(0, (j.estimate || 0) - (j.discount || 0));
  const statusColor = (s: string) => (s === 'DONE' ? t.ok : s === 'CANCELLED' ? t.bad : s === 'IN_PROGRESS' ? t.warn : t.body);
  const dayName = (iso: string) => {
    const d = new Date(iso + 'T00:00:00'), n = new Date(); n.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - n.getTime()) / 86400000);
    return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : dayLabel(iso);
  };

  const Pill = ({ title, onPress, on, dark, busy: b }: { title: string; onPress: () => void; on?: boolean; dark?: boolean; busy?: boolean }) =>
    <Pressable onPress={onPress} disabled={b} accessibilityRole="button" style={({ pressed }) => ({ borderRadius: 999, paddingVertical: 11, paddingHorizontal: 20, alignItems: 'center', opacity: b ? 0.6 : 1,
      backgroundColor: on ? (dark ? (pressed ? '#d9b98d' : t.accent) : (pressed ? '#2c2b27' : t.ink)) : 'transparent', borderWidth: on ? 0 : 1, borderColor: dark ? 'rgba(249,245,242,0.4)' : t.ink })}>
      <Text style={{ fontFamily: font.bold, fontSize: 14, color: on ? (dark ? t.ink : t.brandInk) : (dark ? t.brandInk : t.ink) }}>{b ? 'Updating…' : title}</Text>
    </Pressable>;

  const actions = (j: any, dark?: boolean) => {
    const step = NEXT[j.status];
    return <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      {step && <Pill title={step[1]} on dark={dark} busy={busy === j.id} onPress={() => advance(j)} />}
      <Pill title="Route" dark={dark} onPress={() => router.push(`/job/${j.id}`)} />
    </View>;
  };

  /* The one job that needs attention now: a dark block, big serif time, then plain labelled facts. */
  const now = (j: any) => {
    const at = Math.max(0, FLOW.indexOf(j.status));
    const mute = 'rgba(249,245,242,0.6)';
    return <View style={{ backgroundColor: t.ink, borderRadius: 20, padding: 24, gap: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: t.accent, fontFamily: font.bold, fontSize: 13 }}>{j.status === 'CONFIRMED' ? 'Up next' : 'In progress now'}</Text>
        <Text style={{ color: mute, fontFamily: font.regular, fontSize: 13 }}>{dayName(j.day)}</Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={serif(64, { color: t.brandInk, lineHeight: 66 })}>{j.slot}</Text>
        <Text style={serif(24, { color: t.brandInk })} numberOfLines={1}>{j.name || 'Customer'}</Text>
        <Text style={{ color: mute, fontFamily: font.regular, fontSize: 14, lineHeight: 21 }}>{j.service?.name}, {j.address}</Text>
      </View>
      <View style={{ height: 1, backgroundColor: 'rgba(249,245,242,0.16)' }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: mute, fontFamily: font.regular, fontSize: 12 }}>Phone</Text>
          {j.phone ? <Pressable onPress={() => Linking.openURL(`tel:${j.phone}`)} accessibilityRole="link" accessibilityLabel={`Call ${j.name}`}><Text style={{ color: t.brandInk, fontFamily: font.bold, fontSize: 15, textDecorationLine: 'underline' }}>{j.phone}</Text></Pressable> : <Text style={{ color: mute }}>–</Text>}
        </View>
        <View style={{ gap: 4, alignItems: 'flex-end' }}>
          <Text style={{ color: mute, fontFamily: font.regular, fontSize: 12 }}>Estimate</Text>
          <Money amount={net(j)} size={20} dark />
        </View>
      </View>
      {!!j.notes && <Text style={{ color: mute, fontFamily: font.regular, fontSize: 13, lineHeight: 19 }}>“{j.notes}”</Text>}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row' }}>
          {STEP_LABEL.map((s, i) => <Text key={s} style={{ flex: 1, fontSize: 12, fontFamily: i === at ? font.bold : font.regular, color: i === at ? t.brandInk : i < at ? t.accent : 'rgba(249,245,242,0.4)', textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center' }}>{s}</Text>)}
        </View>
        <View style={{ height: 2, backgroundColor: 'rgba(249,245,242,0.16)' }}><View style={{ height: 2, width: `${((at + 1) / 3) * 100}%`, backgroundColor: t.accent }} /></View>
      </View>
      {actions(j, true)}
    </View>;
  };

  /* Ledger row: time and name on a hairline, no card. Status is a coloured word; money is highlighted. */
  const entry = (j: any) => <View key={j.id} style={{ borderTopWidth: 1, borderTopColor: t.line, paddingVertical: 18, gap: 14 }}>
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
      <Text style={serif(28, { color: t.ink, width: 86 })}>{j.slot}</Text>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: t.ink, fontFamily: font.bold, fontSize: 17 }} numberOfLines={1}>{j.name || 'Customer'}</Text>
        <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 14, lineHeight: 20 }} numberOfLines={2}>{j.service?.name}, {j.address}</Text>
        <Text style={{ color: statusColor(j.status), fontFamily: font.bold, fontSize: 13, marginTop: 2 }}>{label(j.status)}</Text>
      </View>
      <Money amount={net(j)} size={17} />
    </View>
    {isActive(j) && <View style={{ paddingLeft: 102 }}>{actions(j)}</View>}
  </View>;

  const ledger = (list: any[], newestFirst?: boolean) => {
    const days = Array.from(new Set(list.map((j) => j.day))).sort();
    if (newestFirst) days.reverse();
    return <View style={{ gap: 28 }}>
      {days.map((d) => {
        const items = list.filter((j) => j.day === d).sort((a, b) => (newestFirst ? -1 : 1) * a.slot.localeCompare(b.slot));
        return <View key={d}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 10 }}>
            <Text style={serif(22, { color: t.ink })}>{dayName(d)}</Text>
            <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 13 }}>{items.length} {items.length === 1 ? 'job' : 'jobs'}</Text>
          </View>
          {items.map(entry)}
        </View>;
      })}
    </View>;
  };

  const tabLabel = (k: 'active' | 'done', text: string, n: number) => {
    const on = tab === k;
    return <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ paddingVertical: 10, marginRight: 26, borderBottomWidth: 2, borderBottomColor: on ? t.ink : 'transparent', marginBottom: -1 }}>
      <Text style={{ color: on ? t.ink : t.muted, fontFamily: on ? font.bold : font.regular, fontSize: 15 }}>{text}  <Text style={{ fontFamily: font.regular }}>{n}</Text></Text>
    </Pressable>;
  };

  return <Screen refresh={jobs.refresh} refreshing={jobs.refreshing}>
    <View style={{ width: '100%', gap: 22 }}>
      <Text accessibilityRole="header" style={serif(38, { color: t.ink, lineHeight: 42 })}>My jobs</Text>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.line }}>
        {tabLabel('active', 'Active', active.length)}{tabLabel('done', 'Completed', past.length)}
      </View>
      {!!err && <Text style={{ color: t.bad, fontFamily: font.medium, fontSize: 14 }}>{err}</Text>}
      {!jobs.data ? <Status error={jobs.error} loading={!jobs.error} /> :
        tab === 'active'
          ? active.length === 0
            ? <Status empty="No active jobs. Accept a request and it will show up here." />
            : <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: wide ? 40 : 28 }}>
              <View style={{ width: wide ? 420 : '100%' }}>{now(first)}</View>
              {rest.length > 0 && <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%' }}>{ledger(rest)}</View>}
            </View>
          : past.length === 0
            ? <Status empty="Finished jobs will be listed here." />
            : <View style={{ maxWidth: 760, width: '100%' }}>{ledger(past, true)}</View>}
    </View>
  </Screen>;
}
