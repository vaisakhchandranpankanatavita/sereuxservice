import { useState } from 'react';
import { Linking, Modal, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { pingLive } from '../../src/live';
import { takePhoto } from '../../src/photo';
import { CodeSheet } from '../../src/codesheet';
import { Button, Money, SlideToConfirm, PageTitle, R, Screen, Status, dayLabel, font, label, mono, overline, tone, useFetch, useTheme } from '../../src/ui';

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

  /* Extra work or parts: the customer must approve before it counts. */
  const [extraFor, setExtraFor] = useState<any | null>(null);
  const [exLabel, setExLabel] = useState('');
  const [exAmt, setExAmt] = useState('');
  const [exErr, setExErr] = useState('');
  const submitExtra = async () => {
    const amount = parseInt(exAmt, 10);
    if (exLabel.trim().length < 3 || !amount || amount < 1) { setExErr('Enter what it is for and an amount.'); return; }
    setBusy(extraFor.id); setExErr('');
    try { await api(`/bookings/${extraFor.id}/extras`, 'POST', { label: exLabel.trim(), amount }); setExtraFor(null); setExLabel(''); setExAmt(''); await jobs.reload(); }
    catch (e: any) { setExErr(e.message); }
    finally { setBusy(null); }
  };

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
    /* "Start work" / "Mark complete" ping the customer so their code pops up on their phone straight away. */
    if (step[0] === 'IN_PROGRESS' || step[0] === 'DONE') api(`/pro/bookings/${j.id}/request-code`, 'POST').catch(() => {});
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
    return <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      {(j.status === 'ON_THE_WAY' || j.status === 'IN_PROGRESS') && <Pressable onPress={() => { setExtraFor(j); setExErr(''); }} accessibilityRole="button" accessibilityLabel="Add extra charge" style={({ pressed }: any) => ({ minHeight: 52, minWidth: 52, borderRadius: 26, backgroundColor: pressed ? t.accentBg : t.card, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' })}><Ionicons name="add" size={22} color={t.ink} /></Pressable>}
      {step ? <SlideToConfirm label={step[1]} icon={step[0] === 'DONE' ? 'checkmark' : 'chevron-forward'} busy={busy === j.id} onConfirm={() => advance(j)} style={{ flex: 1 }} /> : null}
    </View>;
  };

  /* One compact focus card keeps the next action and essential customer details together. */
  const now = (j: any) => {
    const c = tone(t, j.status === 'IN_PROGRESS' ? 'warn' : 'info');
    return <View style={{ backgroundColor: t.card, borderRadius: R.lg, borderCurve: 'continuous', padding: 18, gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: c.bg, borderRadius: R.pill, paddingHorizontal: 10, minHeight: 28 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fg }} />
          <Text style={{ color: c.fg, fontFamily: font.semibold, fontSize: 12 }}>{label(j.status)}</Text>
        </View>
        <Text style={{ color: t.muted, fontFamily: font.medium, fontSize: 13 }}>{dayName(j.day)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
        <Text style={{ color: t.ink, fontFamily: font.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.7, fontVariant: ['lining-nums', 'tabular-nums'] }}>{j.slot}</Text>
        <View style={{ width: 1, height: 38, backgroundColor: t.line }} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={title(18, { color: t.ink })} numberOfLines={1}>{j.service?.name || 'Service'}</Text>
          <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 13 }} numberOfLines={1}>{j.name || 'Customer'}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Ionicons name="location-outline" size={16} color={t.muted} style={{ marginTop: 2 }} />
        <Text style={{ flex: 1, color: t.body, fontFamily: font.regular, fontSize: 13, lineHeight: 19 }} numberOfLines={2}>{j.address}</Text>
      </View>
      <View style={{ height: 1, backgroundColor: t.line }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...overline, color: t.muted }}>{(j.extras ?? []).some((x: any) => x.status === 'APPROVED') ? 'Estimate + extras' : 'Estimate'}</Text>
          <Money amount={net(j)} size={17} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Pressable onPress={() => router.push(`/job/${j.id}`)} accessibilityRole="link" accessibilityLabel="Job details" style={({ pressed }: any) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 10, backgroundColor: pressed ? t.accentBg : 'transparent' })}><Text style={mono(13, { color: t.accent })}>Details</Text></Pressable>{j.phone ? <Pressable onPress={() => Linking.openURL(`tel:${j.phone}`)} accessibilityRole="link" accessibilityLabel={`Call ${j.name}`} style={({ pressed }: any) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 10, backgroundColor: pressed ? t.accentBg : 'transparent' })}><Text style={mono(13, { color: t.accent })}>Call customer</Text></Pressable> : null}</View>
      </View>
      {(j.extras ?? []).length > 0 && <View style={{ gap: 4 }}>{j.extras.map((x: any) => <Text key={x.id} style={{ color: x.status === 'REJECTED' ? t.muted : t.body, fontFamily: font.regular, fontSize: 13 }}>+ {x.label} · ₹{x.amount} · {x.status === 'PENDING' ? 'awaiting customer' : x.status === 'APPROVED' ? 'approved' : 'declined'}</Text>)}</View>}
      {!!j.notes && <Text style={{ color: t.body, fontFamily: font.regular, fontSize: 13, lineHeight: 19, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 12 }} numberOfLines={3}>{j.notes}</Text>}
      {actions(j)}
    </View>;
  };

  /* Dense, ruled rows keep secondary jobs readable without another stack of cards. */
  const entry = (j: any) => <View key={j.id} style={{ borderTopWidth: 1, borderTopColor: t.line, paddingVertical: 13, gap: 10 }}>
    <Pressable onPress={() => router.push(`/job/${j.id}`)} accessibilityRole="button" accessibilityLabel={`${j.service?.name || 'Service'} job details`} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View style={{ width: 58 }}>
        <Text style={mono(14, { color: t.ink })}>{j.slot}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: t.ink, fontFamily: font.semibold, fontSize: 15 }} numberOfLines={1}>{j.service?.name || 'Service'} <Text style={{ color: t.muted, fontFamily: font.regular }}>· {j.name || 'Customer'}</Text></Text>
        <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 12 }} numberOfLines={1}>{j.address}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Money amount={net(j)} size={14} />
        <Text style={{ color: statusColor(j.status), fontFamily: font.semibold, fontSize: 11 }}>{label(j.status)}</Text>
      </View>
    </Pressable>
    {isActive(j) && <View style={{ paddingLeft: 70 }}>{actions(j)}</View>}
  </View>;

  const ledger = (list: any[], newestFirst?: boolean) => {
    const days = Array.from(new Set(list.map((j) => j.day))).sort();
    if (newestFirst) days.reverse();
    return <View style={{ gap: 20 }}>
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

  /* Instead of tabs: two big stat tiles that double as the filter. The chosen tile fills navy and lifts; the other stays a soft pastel. */
  const pick = (k: 'active' | 'done', text: string, n: number, icon: keyof typeof Ionicons.glyphMap, tint: string) => {
    const on = tab === k;
    return <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="button" accessibilityLabel={`${text}, ${n}`} accessibilityState={{ selected: on }}
      style={(st: any) => ({ flex: 1, borderRadius: R.md, padding: 16, gap: 10, backgroundColor: on ? t.ink : tint, transform: [{ scale: st.pressed ? 0.97 : on ? 1 : 0.98 }], opacity: on ? 1 : 0.9,
        ...(on ? { shadowColor: '#141B34', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 } : null) })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: on ? 'rgba(255,255,255,0.14)' : '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={on ? '#FFFFFF' : t.ink} />
        </View>
        {on && <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />}
      </View>
      <Text style={{ color: on ? '#FFFFFF' : t.ink, fontFamily: font.heavy, fontSize: 30, letterSpacing: -1.2 }}>{n}</Text>
      <Text style={{ color: on ? 'rgba(255,255,255,0.7)' : 'rgba(20,27,52,0.62)', fontFamily: font.medium, fontSize: 13 }}>{text}</Text>
    </Pressable>;
  };

  const finishing = sheet?.status === 'IN_PROGRESS';
  const codeSheet = <CodeSheet visible={!!sheet} finishing={finishing} customer={sheet?.name} busy={busy === sheet?.id || photoBusy} error={sheetErr} thumbs={thumbs}
    onPhoto={() => addPhoto(finishing ? 'AFTER' : 'BEFORE')} onSubmit={(c) => send(sheet, c)} onClose={() => setSheet(null)} />;

  return <Screen refresh={jobs.refresh} refreshing={jobs.refreshing} header={<PageTitle title="My jobs" sub="Active work and job history" />}>
    {codeSheet}
    <Modal visible={!!extraFor} transparent animationType="fade" onRequestClose={() => setExtraFor(null)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,20,20,0.45)', justifyContent: 'center', padding: 18 }}>
        <View style={{ backgroundColor: t.card, borderRadius: R.lg, padding: 18, gap: 12 }}>
          <Text style={title(20, { color: t.ink })}>Add an extra charge</Text>
          <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 13 }}>The customer approves it in their app before it is added to the job total.</Text>
          <TextInput value={exLabel} onChangeText={setExLabel} placeholder="e.g. New tap cartridge" maxLength={80} placeholderTextColor={t.muted} accessibilityLabel="What is it for" style={{ borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 12, color: t.ink, fontFamily: font.regular, fontSize: 15 }} />
          <TextInput value={exAmt} onChangeText={(v) => setExAmt(v.replace(/\D/g, ''))} placeholder="Amount (₹)" keyboardType="number-pad" maxLength={6} placeholderTextColor={t.muted} accessibilityLabel="Amount in rupees" style={{ borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 12, color: t.ink, fontFamily: font.regular, fontSize: 15 }} />
          {!!exErr && <Text style={{ color: t.bad, fontFamily: font.medium, fontSize: 13 }}>{exErr}</Text>}
          <Button title="Send to customer" busy={busy === extraFor?.id} onPress={submitExtra} />
          <Button title="Cancel" kind="ghost" onPress={() => setExtraFor(null)} />
        </View>
      </View>
    </Modal>
    <View style={{ width: '100%', gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {pick('active', 'Active jobs', active.length, 'flash-outline', t.peri)}{pick('done', 'Completed', past.length, 'checkmark-done-outline', t.mint)}
      </View>
      {!!err && <Text style={{ color: t.bad, fontFamily: font.medium, fontSize: 14 }}>{err}</Text>}
      {!jobs.data ? <Status error={jobs.error} loading={!jobs.error} loadingLabel="Loading your jobs" /> :
        tab === 'active'
          ? active.length === 0
            ? <Status empty="No active jobs. Accept a request and it will show up here." />
            : <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: wide ? 28 : 20 }}>
              <View style={{ width: wide ? 400 : '100%' }}>{now(first)}</View>
              {rest.length > 0 && <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', paddingTop: wide ? 2 : 0 }}>{ledger(rest)}</View>}
            </View>
          : past.length === 0
            ? <Status empty="Finished jobs will be listed here." />
            : <View style={{ width: '100%', maxWidth: wide ? 900 : undefined, alignSelf: wide ? 'center' : undefined }}>{ledger(past, true)}</View>}
    </View>
  </Screen>;
}
