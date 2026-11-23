import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../../src/api';
import { useSession } from '../../src/session';
import { KycCard } from '../../src/kyc';
import { Avatar, Button, PageTitle, Card, Field, Row, Screen, Status, Stars, Txt, Money, OnlineSwitch, PulseDot, font, mono, money, overline, setOnlineFlag, useFetch, useTheme, R } from '../../src/ui';

/* Shared building blocks: a big-number tile and a card with a clear heading. */
function Tile({ label: l, value, amount, sub, bg, fg, sub2 }: { label: string; value?: string; amount?: number; sub?: string; bg: string; fg: string; sub2?: string }) {
  /* Metric tile: bordered surface, overline label, mono number. Semantic tiles keep a soft tint; the neutral "dark" tile becomes a plain card. */
  const t = useTheme();
  const semantic = ['Paid out', 'Balance due', 'Today'].includes(l); // only money-state tiles get a tint; the rest stay neutral
  const tint = semantic ? bg : t.card;
  const ink = semantic ? fg : t.ink;
  return <View style={{ flexGrow: 1, flexBasis: 150, minWidth: 140, backgroundColor: tint, borderRadius: R.md, padding: 16, gap: 6 }}>
    <Text style={[overline, { color: sub2 ?? t.muted }]}>{l}</Text>
    {amount != null
      ? <Money amount={amount} size={24} style={{ marginTop: 2 }} />
      : <Text style={mono(24, { color: ink, letterSpacing: -0.7 })} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>}
    {!!sub && <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 12 }}>{sub}</Text>}
  </View>;
}
const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) =>
  <Card style={{ gap: 16, padding: 20 }}>
    <View style={{ gap: 2 }}><Txt bold size={16} style={{ fontFamily: font.semibold }}>{title}</Txt>{!!hint && <Txt muted size={13}>{hint}</Txt>}</View>
    {children}
  </Card>;

function Earnings() {
  const t = useTheme();
  const e = useFetch<any>('/pro/earnings');
  if (!e.data) return <Status error={e.error} loading={!e.error} />;
  const d = e.data;
  const max = Math.max(1, ...d.daily.map((x: any) => x.amount));
  const todayIso = new Date().toISOString().slice(0, 10);
  const best = d.daily.reduce((m: any, x: any) => (x.amount > (m?.amount ?? 0) ? x : m), null);
  return <Section title="Earnings" hint={`Net of ${d.commissionPercent}% platform commission`}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Tile label="Today" amount={d.today} bg={t.okBg} fg={t.ok} />
      <Tile label="This week" amount={d.week} bg={t.infoBg} fg={t.ink} />
      <Tile label="This month" amount={d.month} bg={t.ink} fg={t.brandInk} />
    </View>
    <View>
      <Row between><Text style={[overline, { color: t.muted }]}>Last {d.daily.length} days</Text>{best && <Text style={mono(12, { color: t.muted })}>Best day {money(best.amount)}</Text>}</Row>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 150, marginTop: 10 }}>
        {d.daily.map((x: any) => {
          const h = Math.max(6, Math.round((x.amount / max) * 100));
          const isToday = x.day === todayIso;
          return <View key={x.day} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
            <Text style={mono(10, { color: t.body })} numberOfLines={1}>{x.amount > 0 ? money(x.amount) : ''}</Text>
            <View style={{ width: '70%', maxWidth: 34, height: h, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: x.amount === 0 ? t.line : isToday ? t.ok : t.accent }} />
            <Text style={mono(11, { color: isToday ? t.ink : t.muted, fontFamily: isToday ? font.mono : font.monoRegular })}>{new Date(x.day + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric' })}</Text>
          </View>;
        })}
      </View>
    </View>
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
      <Row><View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: t.accent }} /><Txt muted size={12}>Earned</Txt></Row>
      <Row><View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: t.ok }} /><Txt muted size={12}>Today</Txt></Row>
    </View>
  </Section>;
}

function Payouts() {
  const t = useTheme();
  const e = useFetch<any>('/pro/earnings');
  const h = useFetch<any>('/pro/payouts');
  const r = useFetch<any[]>('/pro/payout-requests');
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!e.data) return null;
  const waiting = r.data?.find((x) => x.status === 'REQUESTED');
  const last = r.data?.find((x) => x.status !== 'REQUESTED');
  const send = async () => {
    setBusy(true); setErr('');
    try {
      await api('/pro/payout-requests', 'POST', { amount: Number(amount), details: details.trim() });
      setOpen(false); setAmount('');
      await Promise.all([r.reload(), e.reload()]);
    } catch (x: any) { setErr(x.message); }
    setBusy(false);
  };
  const paid = e.data.paidOut || 0, due = e.data.balanceDue || 0, total = Math.max(1, paid + due);
  return <Section title="Payouts" hint="What we've paid you and what's still owed">
    <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: t.line }}>
      <View style={{ flex: paid, backgroundColor: t.ok }} /><View style={{ flex: due, backgroundColor: t.warn }} />
      {paid + due === 0 && <View style={{ flex: 1 }} />}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Tile label="Paid out" amount={paid} sub={`${Math.round((paid / total) * 100)}% of earnings`} bg={t.okBg} fg={t.ok} />
      <Tile label="Balance due" amount={due} sub="Waiting to be paid" bg={t.warnBg} fg={t.warn} />
    </View>
    {waiting
      ? <Txt muted size={13}>Request for {money(waiting.amount)} is waiting for review.</Txt>
      : open
        ? <View style={{ gap: 8 }}>
          <Field label={`Amount (up to ${money(due)})`} value={amount} onChangeText={setAmount} keyboardType="number-pad" />
          <Field label="UPI id or bank details" value={details} onChangeText={setDetails} autoCapitalize="none" />
          {!!err && <Txt size={13} style={{ color: t.bad }}>{err}</Txt>}
          <Row>
            <Button title="Send request" onPress={send} busy={busy} disabled={!Number(amount) || details.trim().length < 3} style={{ flex: 1 }} />
            <Button title="Cancel" kind="ghost" onPress={() => setOpen(false)} disabled={busy} />
          </Row>
        </View>
        : <Button title="Request payout" kind="ghost" disabled={due <= 0} onPress={() => { setAmount(String(due)); setOpen(true); }} />}
    {!waiting && last?.status === 'REJECTED' && <Txt size={13} style={{ color: t.bad }}>Last request declined: {last.note}</Txt>}
    {!!h.data?.length && <View style={{ gap: 2 }}>
      <Text style={[overline, { color: t.muted, marginBottom: 4 }]}>Recent payouts</Text>
      {h.data.slice(0, 5).map((x: any) => <Row key={x.id} between>
        <View style={{ paddingVertical: 8 }}><Text style={mono(13, { color: t.ink })}>{new Date(x.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>{!!x.note && <Txt muted size={12}>{x.note}</Txt>}</View>
        <Money amount={x.amount} size={16} />
      </Row>)}
    </View>}
  </Section>;
}

function ProfileEdit({ p, onSaved }: { p: any; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(p.bio ?? '');
  const [response, setResponse] = useState(p.response ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!editing) return <Card>
    <Row between>
      <Txt bold size={16} style={{ fontFamily: font.semibold }}>Profile</Txt>
      <Button title="Edit profile" kind="ghost" icon="create-outline" iconOnly onPress={() => setEditing(true)} style={{ alignSelf: 'flex-start' }} />
    </Row>
    <Txt muted size={14}>Responds in {p.response}</Txt>
    <Txt size={14}>{p.bio || 'No bio yet — add a line about your experience.'}</Txt>
  </Card>;

  const save = async () => {
    setBusy(true); setErr('');
    try { await api('/pro/profile', 'PATCH', { bio, response }); setEditing(false); onSaved(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return <Card>
    <Txt bold size={16}>Edit profile</Txt>
    <Field label="Responds in" value={response} onChangeText={setResponse} placeholder="e.g. 10 mins" />
    <Field label="Bio" value={bio} onChangeText={setBio} placeholder="A line about your experience" multiline />
    {!!err && <Txt color={useTheme().bad}>{err}</Txt>}
    <Row>
      <Button title="Save" icon="checkmark" onPress={save} busy={busy} style={{ flex: 1 }} />
      <Button title="Cancel" kind="ghost" icon="close" iconOnly onPress={() => setEditing(false)} disabled={busy} />
    </Row>
  </Card>;
}

export default function Account() {
  const t = useTheme();
  const { user, logout } = useSession();
  const me = useFetch<any>('/pro/me');
  useEffect(() => { if (me.data) setOnlineFlag(!!me.data.online); }, [me.data]);

  const [err, setErr] = useState('');
  const toggleOnline = async (v: boolean) => {
    setErr('');
    try { await api('/pro/online', 'PATCH', { online: v }); setOnlineFlag(v); me.reload(); }
    catch (e: any) { setErr(e.message); }
  };

  if (!me.data) return <Screen header={<PageTitle title="Account" />}>
    <Status error={me.error} loading={!me.error} />
    {!!me.error && <>
      <Card>
        <Txt muted size={13} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Signed in as</Txt>
        <Txt bold size={16}>{user?.name}</Txt>
        <Txt muted size={14}>{user?.email}</Txt>
      </Card>
      <Button title="Sign out" kind="danger" icon="power" iconOnly onPress={logout} style={{ alignSelf: 'center' }} />
    </>}
  </Screen>;
  const p = me.data;

  return <Screen refresh={me.refresh} refreshing={me.refreshing} header={<PageTitle title="Account" />}>
    <KycCard onChange={me.reload} />
    <Card style={{ padding: 20, gap: 16 }}>
      <Row>
        <Avatar name={p.name} size={64} />
        <View style={{ flex: 1 }}>
          <Txt bold size={24} numberOfLines={1}>{p.name}</Txt>
          <Row>
            {p.verified && <View style={{ backgroundColor: t.okBg, borderRadius: 999, paddingHorizontal: 8, height: 22, justifyContent: 'center' }}><Txt bold size={11} color={t.ok}>✓ Verified</Txt></View>}
            <Txt muted size={14}>{p.years} yrs experience</Txt>
          </Row>
        </View>
      </Row>
      <View style={{ backgroundColor: p.online ? t.okBg : t.idleBg, borderRadius: R.md, padding: 14, gap: 10 }}>
        <Row between>
          <Row>
            <PulseDot on={!!p.online} />
            <Txt bold size={16} color={p.online ? t.ok : t.ink} style={{ fontFamily: font.semibold }}>{p.online ? 'You’re online' : 'You’re offline'}</Txt>
          </Row>
          <OnlineSwitch on={!!p.online} onToggle={() => toggleOnline(!p.online)} />
        </Row>
        <Txt muted size={13}>{p.online ? 'Visible to customers nearby and receiving requests.' : 'Go online to start receiving requests.'}</Txt>
        {!!err && <Txt color={t.bad}>{err}</Txt>}
      </View>
    </Card>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Tile label="Total earned" amount={p.earned} bg={t.ink} fg={t.brandInk} />
      <Tile label="Jobs completed" value={String(p.done)} bg={t.infoBg} fg={t.ink} />
      <Tile label="Rating" value={p.rating != null ? `${Number(p.rating).toFixed(1)} ★` : '—'} sub={p.rating != null ? 'Average from customers' : 'No ratings yet'} bg={t.warnBg} fg={t.warn} />
      <Tile label="Replies in" value={String(p.response)} bg={t.okBg} fg={t.ok} />
    </View>

    <Earnings />
    <Payouts />
    <ProfileEdit p={p} onSaved={me.reload} />

    <Card>
      <Text style={[overline, { color: t.muted }]}>Signed in as</Text>
      <Txt bold size={16} style={{ fontFamily: font.semibold }}>{user?.name}</Txt>
      <Txt muted size={14}>{user?.email}</Txt>
    </Card>

    <Button title="Sign out" kind="danger" icon="power" iconOnly onPress={logout} style={{ alignSelf: 'center' }} />
  </Screen>;
}
