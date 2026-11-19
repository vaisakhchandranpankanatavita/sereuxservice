import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../../src/api';
import { useSession } from '../../src/session';
import { Avatar, Button, Card, Field, Row, Screen, Status, Stars, Txt, Money, OnlineSwitch, PulseDot, font, money, setOnlineFlag, useFetch, useTheme, R } from '../../src/ui';

/* Shared building blocks: a big-number tile and a card with a clear heading. */
function Tile({ label: l, value, amount, sub, bg, fg, sub2 }: { label: string; value?: string; amount?: number; sub?: string; bg: string; fg: string; sub2?: string }) {
  return <View style={{ flexGrow: 1, flexBasis: 150, minWidth: 140, backgroundColor: bg, borderRadius: R.md, padding: 16, gap: 2 }}>
    <Text style={{ color: sub2 ?? fg, opacity: 0.75, fontFamily: font.medium, fontSize: 13 }}>{l}</Text>
    {amount != null
      ? <Money amount={amount} size={30} dark={fg === '#f9f5f2'} style={{ marginTop: 2, paddingVertical: 3 }} />
      : <Text style={{ color: fg, fontFamily: font.heavy, fontSize: 30, letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>}
    {!!sub && <Text style={{ color: fg, opacity: 0.7, fontFamily: font.regular, fontSize: 12 }}>{sub}</Text>}
  </View>;
}
const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) =>
  <Card style={{ gap: 14, padding: 18 }}>
    <View><Txt bold size={18}>{title}</Txt>{!!hint && <Txt muted size={13}>{hint}</Txt>}</View>
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
      <Row between><Txt bold size={14}>Last {d.daily.length} days</Txt>{best && <Txt muted size={12}>Best day: <Money amount={best.amount} size={12} /></Txt>}</Row>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 150, marginTop: 10 }}>
        {d.daily.map((x: any) => {
          const h = Math.max(6, Math.round((x.amount / max) * 100));
          const isToday = x.day === todayIso;
          return <View key={x.day} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
            <Text style={{ color: t.body, fontFamily: font.bold, fontSize: 10 }} numberOfLines={1}>{x.amount > 0 ? money(x.amount) : ''}</Text>
            <View style={{ width: '70%', maxWidth: 34, height: h, borderRadius: 8, backgroundColor: x.amount === 0 ? t.line : isToday ? t.ok : t.accent }} />
            <Text style={{ color: isToday ? t.ink : t.muted, fontFamily: isToday ? font.bold : font.regular, fontSize: 11 }}>{new Date(x.day + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric' })}</Text>
          </View>;
        })}
      </View>
    </View>
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
      <Row><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.accent }} /><Txt muted size={12}>Earned</Txt></Row>
      <Row><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.ok }} /><Txt muted size={12}>Today</Txt></Row>
    </View>
  </Section>;
}

function Payouts() {
  const t = useTheme();
  const e = useFetch<any>('/pro/earnings');
  const h = useFetch<any>('/pro/payouts');
  if (!e.data) return null;
  const paid = e.data.paidOut || 0, due = e.data.balanceDue || 0, total = Math.max(1, paid + due);
  return <Section title="Payouts" hint="What we've paid you and what's still owed">
    <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: t.line }}>
      <View style={{ flex: paid, backgroundColor: t.ok }} /><View style={{ flex: due, backgroundColor: t.accent }} />
      {paid + due === 0 && <View style={{ flex: 1 }} />}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Tile label="Paid out" amount={paid} sub={`${Math.round((paid / total) * 100)}% of earnings`} bg={t.okBg} fg={t.ok} />
      <Tile label="Balance due" amount={due} sub="Waiting to be paid" bg={t.warnBg} fg={t.warn} />
    </View>
    {!!h.data?.length && <View style={{ gap: 2 }}>
      <Txt bold size={14}>Recent payouts</Txt>
      {h.data.slice(0, 5).map((x: any) => <Row key={x.id} between>
        <View style={{ paddingVertical: 8 }}><Txt size={14}>{new Date(x.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Txt>{!!x.note && <Txt muted size={12}>{x.note}</Txt>}</View>
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
      <Txt bold size={16}>Profile</Txt>
      <Button title="Edit" kind="ghost" onPress={() => setEditing(true)} />
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
    {!!err && <Txt color="#a13a2a">{err}</Txt>}
    <Row>
      <Button title="Save" onPress={save} busy={busy} style={{ flex: 1 }} />
      <Button title="Cancel" kind="ghost" onPress={() => setEditing(false)} disabled={busy} style={{ flex: 1 }} />
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

  if (!me.data) return <Screen>
    <Status error={me.error} loading={!me.error} />
    {!!me.error && <>
      <Card>
        <Txt muted size={13} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Signed in as</Txt>
        <Txt bold size={16}>{user?.name}</Txt>
        <Txt muted size={14}>{user?.email}</Txt>
      </Card>
      <Button title="Sign out" kind="danger" onPress={logout} />
    </>}
  </Screen>;
  const p = me.data;

  return <Screen refresh={me.refresh} refreshing={me.refreshing}>
    <Card style={{ padding: 18, gap: 14 }}>
      <Row>
        <Avatar name={p.name} size={64} />
        <View style={{ flex: 1 }}>
          <Txt bold size={24} numberOfLines={1}>{p.name}</Txt>
          <Row>
            {p.verified && <View style={{ backgroundColor: t.okBg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}><Txt bold size={12} color={t.ok}>✓ Verified</Txt></View>}
            <Txt muted size={14}>{p.years} yrs experience</Txt>
          </Row>
        </View>
      </Row>
      <View style={{ backgroundColor: p.online ? t.okBg : t.idleBg, borderRadius: R.md, padding: 14, gap: 10 }}>
        <Row between>
          <Row>
            <PulseDot on={!!p.online} />
            <Txt bold size={17} color={p.online ? t.ok : t.ink}>{p.online ? 'You’re online' : 'You’re offline'}</Txt>
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
      <Txt muted size={13} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Signed in as</Txt>
      <Txt bold size={16}>{user?.name}</Txt>
      <Txt muted size={14}>{user?.email}</Txt>
    </Card>

    <Button title="Sign out" kind="danger" onPress={logout} />
  </Screen>;
}
