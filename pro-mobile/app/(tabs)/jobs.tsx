import { useState } from 'react';
import { Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { pingLive } from '../../src/live';
import { takePhoto } from '../../src/photo';
import { CodeSheet } from '../../src/codesheet';
import { Button, Money, PageTitle, R, Screen, Status, dayLabel, font, label, mono, overline, tone, useFetch, useTheme } from '../../src/ui';

const NEXT: Record<string, [string, string]> = {
  CONFIRMED: ['ON_THE_WAY', 'Start trip'],
  ON_THE_WAY: ['IN_PROGRESS', 'Start work'],
  IN_PROGRESS: ['DONE', 'Mark complete'],
};
const FLOW = ['CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'];
const isActive = (j: any) => j.status !== 'DONE' && j.status !== 'CANCELLED';
/* Work already under way first, then by date and slot, so the top block is always "what to do now". */
const rank = (j: any) => (FLOW.indexOf(j.status) >= 1 ? FLOW.indexOf(j.status) : 0);
const byNow = (a: any, b: any) => rank(b) - rank(a) || `${a.day} ${a.slot}`.localeCompare(`${b.day} ${b.slot}`);

/* Tight Inter semibold for section titles and customer names. */
const title = (size: number, extra: object = {}) => ({ fontFamily: font.display, fontSize: size, letterSpacing: -size * 0.015, ...extra });

export default function Jobs() {
  const t = useTheme();
  const wide = useWindowDimensions().width >= 960;
  const router = useRouter();
  const jobs = useFetch<any[]>('/pro/jobs', 20000);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'active' | 'done'>('active');

  /* Starting work and finishing both need the customer's code; finishing also needs an "after" photo. */
  const [sheet, setSheet] = useState<any | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [sheetErr, setSheetErr] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);

  const send = async (j: any, otp?: string) => {
    const step = NEXT[j.status];
    setBusy(j.id); setErr(''); setSheetErr('');
    try { await api(`/bookings/${j.id}/status`, 'PATCH', { status: step[0], ...(otp ? { otp } : {}) }); setSheet(null); setThumbs([]); await jobs.reload(); pingLive(); }
    catch (e: any) { if (sheet) setSheetErr(e.message); else setErr(e.message); }
    finally { setBusy(null); }
  };

  const advance = async (j: any) => {
    const step = NEXT[j.status];
    if (!step) return;
    if (step[0] === 'IN_PROGRESS' || step[0] === 'DONE') { setSheet(j); setThumbs([]); setSheetErr(''); return; }
    await send(j);
  };

  const addPhoto = async (kind: 'BEFORE' | 'AFTER') => {
    setSheetErr(''); setPhotoBusy(true);
    const image = await takePhoto().finally(() => setPhotoBusy(false));
    if (!image) return;
    try { await api(`/pro/bookings/${sheet.id}/photos`, 'POST', { kind, image }); setThumbs((p) => [...p, image]); }
    catch (e: any) { setSheetErr(e.message); }
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

  const actions = (j: any) => {
    const step = NEXT[j.status];
    return <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      {step ? <Button title={busy === j.id ? 'Updating…' : step[1]} size="sm" busy={busy === j.id} onPress={() => advance(j)} style={{ flex: 1.3 }} /> : null}
      <Button title="Details" kind="ghost" size="sm" onPress={() => router.push(`/job/${j.id}`)} style={{ flex: 1 }} />
    </View>;
  };

  /* Keep one clear focus job; the current status carries the progress without a second tracker. */
  const now = (j: any) => {
    const c = tone(t, j.status === 'IN_PROGRESS' ? 'warn' : 'info');
    return <View style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderLeftWidth: 4, borderLeftColor: c.fg, borderRadius: R.lg, padding: 22, gap: 18, shadowColor: '#09090B', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ backgroundColor: c.bg, borderRadius: R.pill, paddingHorizontal: 10, height: 26, justifyContent: 'center' }}>
          <Text style={{ color: c.fg, fontFamily: font.semibold, fontSize: 11 }}>{label(j.status)}</Text>
        </View>
        <Text style={{ ...overline, color: t.muted }}>{dayName(j.day)}</Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={{ color: t.ink, fontFamily: font.display, fontSize: 38, lineHeight: 44, letterSpacing: -0.8, fontVariant: ['lining-nums', 'tabular-nums'] }}>{j.slot}</Text>
        <Text style={title(20, { color: t.ink })} numberOfLines={1}>{j.name || 'Customer'}</Text>
        <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 14, lineHeight: 21 }}>{j.service?.name}, {j.address}</Text>
      </View>
      <View style={{ height: 1, backgroundColor: t.line }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ gap: 4 }}>
          <Text style={{ ...overline, color: t.muted }}>Phone</Text>
          {j.phone ? <Pressable onPress={() => Linking.openURL(`tel:${j.phone}`)} accessibilityRole="link" accessibilityLabel={`Call ${j.name}`} style={{ minHeight: 32, justifyContent: 'center' }}><Text style={mono(13, { color: t.accent })}>{j.phone}</Text></Pressable> : <Text style={{ color: t.muted }}>–</Text>}
        </View>
        <View style={{ gap: 4, alignItems: 'flex-end' }}>
          <Text style={{ ...overline, color: t.muted }}>Estimate</Text>
          <Money amount={net(j)} size={18} />
        </View>
      </View>
      {!!j.notes && <Text style={{ color: t.body, fontFamily: font.regular, fontSize: 13, lineHeight: 19, backgroundColor: t.surface, borderRadius: R.sm, padding: 12 }}>“{j.notes}”</Text>}
      {actions(j)}
    </View>;
  };

  /* Ledger row: time and name on a hairline, no card. Status is a coloured word; money is highlighted. */
  const entry = (j: any) => <View key={j.id} style={{ borderTopWidth: 1, borderTopColor: t.line, paddingVertical: 16, gap: 12 }}>
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
      <Text style={mono(14, { color: t.ink, width: 78, paddingTop: 2 })}>{j.slot}</Text>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: t.ink, fontFamily: font.semibold, fontSize: 16 }} numberOfLines={1}>{j.name || 'Customer'}</Text>
        <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 19 }} numberOfLines={2}>{j.service?.name}, {j.address}</Text>
        <Text style={{ color: statusColor(j.status), fontFamily: font.semibold, fontSize: 12, marginTop: 2 }}>{label(j.status)}</Text>
      </View>
      <Money amount={net(j)} size={14} />
    </View>
    {isActive(j) && <View style={{ paddingLeft: 94 }}>{actions(j)}</View>}
  </View>;

  const ledger = (list: any[], newestFirst?: boolean) => {
    const days = Array.from(new Set(list.map((j) => j.day))).sort();
    if (newestFirst) days.reverse();
    return <View style={{ gap: 28 }}>
      {days.map((d) => {
        const items = list.filter((j) => j.day === d).sort((a, b) => (newestFirst ? -1 : 1) * a.slot.localeCompare(b.slot));
        return <View key={d}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 6 }}>
            <Text style={title(16, { color: t.ink })}>{dayName(d)}</Text>
          </View>
          {items.map(entry)}
        </View>;
      })}
    </View>;
  };

  const tabLabel = (k: 'active' | 'done', text: string, n: number) => {
    const on = tab === k;
    return <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }}
      style={{ flex: 1, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: on ? t.card : 'transparent', borderWidth: on ? 1 : 0, borderColor: t.line }}>
      <Text style={{ color: on ? t.ink : t.muted, fontFamily: font.semibold, fontSize: 15 }}>{text}</Text>
      <Text style={mono(12, { color: on ? t.accent : t.muted })}>{n}</Text>
    </Pressable>;
  };

  const finishing = sheet?.status === 'IN_PROGRESS';
  const codeSheet = <CodeSheet visible={!!sheet} finishing={finishing} customer={sheet?.name} busy={busy === sheet?.id || photoBusy} error={sheetErr} thumbs={thumbs}
    onPhoto={() => addPhoto(finishing ? 'AFTER' : 'BEFORE')} onSubmit={(c) => send(sheet, c)} onClose={() => setSheet(null)} />;

  return <Screen refresh={jobs.refresh} refreshing={jobs.refreshing}>
    {codeSheet}
    <View style={{ width: '100%', gap: 20 }}>
      <PageTitle title="My jobs" />
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, gap: 4, borderRadius: 15, backgroundColor: t.surface }}>
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
