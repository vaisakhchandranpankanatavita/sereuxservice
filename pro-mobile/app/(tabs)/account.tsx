import { useState } from 'react';
import { View } from 'react-native';
import { api } from '../../src/api';
import { useSession } from '../../src/session';
import { Avatar, Button, Card, Field, Row, Screen, Status, Stars, Txt, money, useFetch, useTheme } from '../../src/ui';

function Bar({ amount, max, label: l }: { amount: number; max: number; label: string }) {
  const t = useTheme();
  const h = Math.max(4, max > 0 ? Math.round((amount / max) * 54) : 4);
  return <View style={{ alignItems: 'center', gap: 4, width: 20 }}>
    <View style={{ height: 54, justifyContent: 'flex-end' }}>
      <View style={{ height: h, width: 14, borderRadius: 4, backgroundColor: amount > 0 ? t.accent : t.line }} />
    </View>
    <Txt muted size={9}>{l}</Txt>
  </View>;
}

function Earnings() {
  const t = useTheme();
  const e = useFetch<any>('/pro/earnings');
  if (!e.data) return <Status error={e.error} loading={!e.error} />;
  const d = e.data;
  const max = Math.max(1, ...d.daily.map((x: any) => x.amount));
  return <Card>
    <Txt bold size={16}>Earnings</Txt>
    <Row between>
      <View><Txt muted size={12}>Today</Txt><Txt bold size={17}>{money(d.today)}</Txt></View>
      <View><Txt muted size={12}>This week</Txt><Txt bold size={17}>{money(d.week)}</Txt></View>
      <View><Txt muted size={12}>This month</Txt><Txt bold size={17} color={t.accent}>{money(d.month)}</Txt></View>
    </Row>
    <Row between>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 10 }}>
        {d.daily.map((x: any) => <Bar key={x.day} amount={x.amount} max={max} label={new Date(x.day + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric' })} />)}
      </View>
    </Row>
    <Row between><Txt muted>Lifetime earned</Txt><Txt bold>{money(d.lifetime)}</Txt></Row>
    <Row between><Txt muted>Jobs completed</Txt><Txt bold>{d.jobs}</Txt></Row>
    <Row between><Txt muted>Upcoming jobs</Txt><Txt bold>{d.upcoming}</Txt></Row>
  </Card>;
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

  const toggleOnline = async (v: boolean) => { await api('/pro/online', 'PATCH', { online: v }); me.reload(); };

  if (!me.data) return <Screen><Status error={me.error} loading={!me.error} /></Screen>;
  const p = me.data;

  return <Screen refresh={me.refresh} refreshing={me.refreshing}>
    <Row>
      <Avatar name={p.name} size={60} />
      <View style={{ flex: 1 }}>
        <Txt bold size={22}>{p.name}{p.verified ? '  ✓' : ''}</Txt>
        <Txt muted size={14}>{p.years} yrs experience · responds in {p.response}</Txt>
      </View>
    </Row>

    <Card>
      <Row between>
        <Txt bold size={16}>{p.online ? 'You’re online' : 'You’re offline'}</Txt>
        <Button title={p.online ? 'Go offline' : 'Go online'} kind={p.online ? 'ghost' : 'primary'} onPress={() => toggleOnline(!p.online)} />
      </Row>
      <Txt muted size={14}>{p.online ? 'Visible to customers nearby and receiving requests.' : 'Go online to start receiving requests.'}</Txt>
    </Card>

    <Card>
      <Row between><Txt muted>Jobs completed</Txt><Txt bold size={17}>{p.done}</Txt></Row>
      <Row between><Txt muted>Total earned</Txt><Txt bold size={17} color={t.accent}>{money(p.earned)}</Txt></Row>
      <Row between><Txt muted>Rating</Txt>{p.rating != null ? <Stars value={Math.round(p.rating)} /> : <Txt muted>No ratings yet</Txt>}</Row>
    </Card>

    <Earnings />
    <ProfileEdit p={p} onSaved={me.reload} />

    <Card>
      <Txt muted size={13} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Signed in as</Txt>
      <Txt bold size={16}>{user?.name}</Txt>
      <Txt muted size={14}>{user?.email}</Txt>
    </Card>

    <Button title="Sign out" kind="danger" onPress={logout} />
  </Screen>;
}
