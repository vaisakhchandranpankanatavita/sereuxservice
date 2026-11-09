import { useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useSession } from '../../src/session';
import { Avatar, Badge, Banner, Button, Card, Field, H, Row, Screen, Tap, Txt, Wash, dayLabel, money, useFetch, useTheme } from '../../src/ui';
import { ServiceArt } from '../../src/serviceArt';
import PageHeader, { PageSpace } from '../../src/PageHeader';

const FAQ = [
  { q: 'How do I reschedule a booking?', a: 'Open the booking from Activity and choose a new day and slot. You can move it until the pro is confirmed.' },
  { q: 'When do I pay for a service?', a: 'You see the price before you book. Pay once the job is done, using the method you picked at checkout.' },
  { q: 'Can I cancel an order or booking?', a: 'Bookings can be cancelled from their page while still open. Shop orders can be cancelled before they ship.' },
  { q: 'How are pros verified?', a: 'Every pro is identity-checked and reviewed before they can take jobs. Ratings from past customers are shown on each service.' },
];

export default function Account() {
  const { user, logout, updateProfile } = useSession();
  const router = useRouter();
  const t = useTheme();
  const notes = useFetch<any[]>('/notifications');
  const bookings = useFetch<any[]>('/bookings');
  const orders = useFetch<any[]>('/orders');
  const wishlist = useFetch<any[]>('/wishlist');
  const unread = notes.data?.filter((n) => !n.read).length ?? 0;
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState({ open: false, text: '', sent: false, err: '' });
  const [faq, setFaq] = useState<number | null>(null);
  const dirty = name !== user?.name || phone !== user?.phone;
  const refreshAll = () => { notes.refresh(); bookings.refresh(); orders.refresh(); wishlist.refresh(); };

  const next = useMemo(() => (bookings.data ?? []).filter((b) => b.status !== 'DONE' && b.status !== 'CANCELLED')
    .sort((a, b) => `${a.day} ${a.slot}`.localeCompare(`${b.day} ${b.slot}`))[0], [bookings.data]);
  const spent = useMemo(() => (orders.data ?? []).filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + Number(o.total || 0), 0), [orders.data]);
  const recent = useMemo(() => [
    ...(bookings.data ?? []).map((b) => ({ key: `b${b.id}`, kind: 'b', title: b.service.name, sub: `${dayLabel(b.day)} · ${b.slot}`, status: b.status, ts: String(b.createdAt ?? b.day), href: `/booking/${b.id}`, service: b.service.name })),
    ...(orders.data ?? []).map((o) => ({ key: `o${o.id}`, kind: 'o', title: `Order #${o.id}`, sub: `${o.items.length} item${o.items.length === 1 ? '' : 's'} · ${money(o.total)}`, status: o.status, ts: String(o.createdAt ?? ''), href: `/order/${o.id}`, service: '' })),
  ].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 4), [bookings.data, orders.data]);

  const save = async () => {
    setBusy(true); setMsg(null);
    try { await updateProfile({ name: name.trim(), phone }); setMsg({ ok: true, text: 'Profile saved.' }); } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const send = async () => {
    try { await api('/contact', 'POST', { name: user!.name, email: user!.email, message: help.text.trim() }); setHelp({ open: false, text: '', sent: true, err: '' }); }
    catch (e: any) { setHelp((h) => ({ ...h, err: e.message })); }
  };
  const invite = async () => {
    try { await Share.share({ message: 'I book verified home-service pros on Fixzy: plumbing, AC repair, cleaning and more, with upfront prices. Give it a try.' }); } catch { /* user dismissed the sheet */ }
  };

  const stub = [
    { label: 'Bookings', n: bookings.data?.length, href: '/activity' },
    { label: 'Orders', n: orders.data?.length, href: '/activity' },
    { label: 'Saved', n: wishlist.data?.length, href: '/wishlist' },
  ];
  const rows = [
    { icon: 'notifications', label: 'Notifications', sub: unread ? `${unread} unread` : 'You are all caught up', chip: t.lime, badge: unread, onPress: () => router.push('/notifications') },
    { icon: 'heart', label: 'Wishlist', sub: 'Products you saved', chip: t.pink, badge: 0, onPress: () => router.push('/wishlist') },
  ] as const;

  return <View style={{ flex: 1 }}>
   <PageHeader tone="account" eyebrow="MANAGE YOUR PROFILE" title="Your account" />
   <Screen refresh={refreshAll} refreshing={notes.refreshing}>
    <PageSpace />
    {/* member card: identity on top, tear line, tappable stub below */}
    <View style={{ backgroundColor: t.accent, borderRadius: 30, overflow: 'hidden' }}>
      <Wash />
      <View style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ padding: 3, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.75)' }}><Avatar name={user?.name ?? '?'} size={62} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt bold size={22} numberOfLines={1}>{user?.name}</Txt>
          <Txt size={14} color={t.body} numberOfLines={1}>{user?.email}</Txt>
          {!!user?.phone && <Txt size={14} color={t.body} numberOfLines={1}>{user.phone}</Txt>}
        </View>
        <Tap onPress={() => { setEditing((v) => !v); setMsg(null); }} accessibilityRole="button" accessibilityLabel={editing ? 'Close edit profile' : 'Edit profile'} scaleTo={0.94}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.ink, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={editing ? 'close' : 'create-outline'} size={19} color="#fff" />
        </Tap>
      </View>

      <View style={{ height: 22, justifyContent: 'center' }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: 'transparent' }} />
        <View pointerEvents="none" style={{ position: 'absolute', right: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: 'transparent' }} />
        <View pointerEvents="none" style={{ marginHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
          {Array.from({ length: 28 }).map((_, i) => <View key={i} style={{ width: 5, height: 2, borderRadius: 1, backgroundColor: 'rgba(35,35,35,0.28)' }} />)}
        </View>
      </View>

      <View style={{ flexDirection: 'row', paddingBottom: 8 }}>
        {stub.map((s, i) => <Tap key={s.label} onPress={() => router.push(s.href as any)} accessibilityRole="button" accessibilityLabel={`${s.label}, ${s.n ?? 0}`} scaleTo={0.96}
          style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderLeftWidth: i ? 1 : 0, borderColor: 'rgba(35,35,35,0.12)' }}>
          <Txt bold size={26}>{s.n ?? '–'}</Txt>
          <Txt size={13} color={t.body}>{s.label}</Txt>
        </Tap>)}
      </View>
    </View>

    {editing && <Card style={{ gap: 12 }}>
      <Field onCard label="Name" value={name} onChangeText={setName} />
      <Field onCard label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      {!!msg && <Banner kind={msg.ok ? 'ok' : 'bad'}>{msg.text}</Banner>}
      <Button title="Save changes" onPress={save} busy={busy} disabled={!dirty || name.trim().length < 2} />
    </Card>}

    {/* next appointment, or a prompt to book one */}
    {next
      ? <Tap onPress={() => router.push(`/booking/${next.id}`)} accessibilityRole="button" accessibilityLabel={`Next appointment, ${next.service.name}`} scaleTo={0.98}
        style={{ backgroundColor: t.lime, borderRadius: 24, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
        <Wash />
        <View style={{ width: 52, height: 52, borderRadius: 18, overflow: 'hidden', backgroundColor: '#fff' }}><ServiceArt name={next.service.name} /></View>
        <View style={{ flex: 1, gap: 1 }}>
          <Txt size={12} color={t.body}>Next appointment</Txt>
          <Txt bold size={17} numberOfLines={1}>{next.service.name}</Txt>
          <Txt size={13} color={t.body}>{dayLabel(next.day)} · {next.slot}</Txt>
        </View>
        <Badge v={next.status} />
      </Tap>
      : bookings.data && <Tap onPress={() => router.push('/')} accessibilityRole="button" accessibilityLabel="Book a service" scaleTo={0.98}
        style={{ backgroundColor: t.lime, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
        <Wash />
        <View style={{ flex: 1 }}><Txt bold size={17}>Nothing booked yet</Txt><Txt size={13} color={t.body}>Find a verified pro for your next job.</Txt></View>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.ink, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="arrow-forward" size={19} color="#fff" /></View>
      </Tap>}

    {/* recent activity across bookings and shop orders */}
    {recent.length > 0 && <>
      <Row between><H>Recent activity</H>{spent > 0 && <Txt size={13} color={t.body}>{money(spent)} spent in the shop</Txt>}</Row>
      <View style={{ backgroundColor: t.card, borderRadius: 24, overflow: 'hidden' }}>
        {recent.map((r, i) => <Tap key={r.key} onPress={() => router.push(r.href as any)} accessibilityRole="button" accessibilityLabel={`${r.title}, ${r.sub}`} scaleTo={0.99}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderColor: t.line }}>
          <View style={{ width: 44, height: 44, borderRadius: 16, overflow: 'hidden', backgroundColor: t.peach, alignItems: 'center', justifyContent: 'center' }}>
            {r.kind === 'b' ? <ServiceArt name={r.service} /> : <Ionicons name="bag-handle" size={20} color={t.ink} />}
          </View>
          <View style={{ flex: 1 }}><Txt bold size={15} numberOfLines={1}>{r.title}</Txt><Txt size={13} color={t.body} numberOfLines={1}>{r.sub}</Txt></View>
          <Badge v={r.status} />
        </Tap>)}
      </View>
    </>}

    <View style={{ backgroundColor: t.card, borderRadius: 24, overflow: 'hidden' }}>
      {rows.map((r, i) => <Tap key={r.label} onPress={r.onPress} accessibilityRole="button" accessibilityLabel={`${r.label}, ${r.sub}`} scaleTo={0.99}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderTopWidth: i ? 1 : 0, borderColor: t.line }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: r.chip, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={r.icon} size={19} color={t.ink} /></View>
        <View style={{ flex: 1 }}><Txt bold size={16}>{r.label}</Txt><Txt size={13} color={t.body}>{r.sub}</Txt></View>
        {r.badge > 0 && <View style={{ backgroundColor: t.ink, borderRadius: 10, minWidth: 22, height: 22, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }}><Txt bold size={12} color="#fff">{r.badge}</Txt></View>}
        <Ionicons name="chevron-forward" size={18} color={t.muted} />
      </Tap>)}
    </View>

    {/* invite friends via the system share sheet */}
    <View style={{ backgroundColor: t.pink, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
      <Wash />
      <View style={{ flex: 1 }}><Txt bold size={17}>Invite a friend</Txt><Txt size={13} color={t.body}>Share Fixzy with someone who needs a hand at home.</Txt></View>
      <Tap onPress={invite} accessibilityRole="button" accessibilityLabel="Share Fixzy" scaleTo={0.94}
        style={{ backgroundColor: t.ink, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="share-social-outline" size={16} color="#fff" /><Txt bold size={13} color="#fff">Share</Txt>
      </Tap>
    </View>

    {/* help: short answers first, then a way to write to us */}
    <H>Help</H>
    <View style={{ backgroundColor: t.card, borderRadius: 24, overflow: 'hidden' }}>
      {FAQ.map((f, i) => <View key={f.q} style={{ borderTopWidth: i ? 1 : 0, borderColor: t.line }}>
        <Tap onPress={() => setFaq(faq === i ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: faq === i }} scaleTo={0.995}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
          <Txt bold size={15} style={{ flex: 1 }}>{f.q}</Txt>
          <Ionicons name={faq === i ? 'chevron-up' : 'chevron-down'} size={18} color={t.muted} />
        </Tap>
        {faq === i && <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}><Txt size={14} color={t.body} style={{ lineHeight: 20 }}>{f.a}</Txt></View>}
      </View>)}
      <Tap onPress={() => setHelp((h) => ({ ...h, open: !h.open, sent: false }))} accessibilityRole="button" scaleTo={0.99}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderTopWidth: 1, borderColor: t.line }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.green, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chatbubble-ellipses" size={19} color={t.ink} /></View>
        <View style={{ flex: 1 }}><Txt bold size={16}>Still need help?</Txt><Txt size={13} color={t.body}>Write to support, we reply by email</Txt></View>
        <Ionicons name={help.open ? 'chevron-up' : 'chevron-forward'} size={18} color={t.muted} />
      </Tap>
    </View>
    {help.sent && <Banner kind="ok">Message sent. We will get back to you by email.</Banner>}
    {help.open && <Card style={{ gap: 12 }}>
      <Field onCard label="How can we help? (10+ characters)" value={help.text} onChangeText={(text) => setHelp((h) => ({ ...h, text }))} multiline />
      {!!help.err && <Banner kind="bad">{help.err}</Banner>}
      <Row><Button title="Send" onPress={send} disabled={help.text.trim().length < 10} style={{ flex: 1 }} /><Button title="Cancel" kind="ghost" onPress={() => setHelp((h) => ({ ...h, open: false }))} style={{ flex: 1 }} /></Row>
    </Card>}

    <Tap onPress={logout} accessibilityRole="button" accessibilityLabel="Sign out" scaleTo={0.97}
      style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(210,58,74,0.45)', backgroundColor: 'rgba(210,58,74,0.06)' }}>
      <Ionicons name="log-out-outline" size={20} color={t.bad} />
      <Txt bold size={15} color={t.bad}>Sign out</Txt>
    </Tap>
   </Screen>
  </View>;
}
