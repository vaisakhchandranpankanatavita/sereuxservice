import { useMemo, useState } from 'react';
import { Image, Linking, Modal, Platform, Share, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import PageHeader, { PageSpace } from '../../src/PageHeader';
import { api } from '../../src/api';
import { usePayment } from '../../src/payment';
import { useSession } from '../../src/session';
import { Chat } from '../../src/chat';
import { LiveMap } from '../../src/map';
import { useConfig } from '../../src/config';
import { Timeline, type Step } from '../../src/timeline';
import { Avatar, Badge, Banner, Button, Card, Chip, Field, RoundBtn, Screen, Skeleton, Stars, Status, Tap, Txt, dayLabel, money, useFetch, useTheme } from '../../src/ui';

const STEPS: Step[] = [
  { key: 'REQUESTED', label: 'Requested', hint: "We've got your request.", icon: 'hourglass-outline', iconDone: 'hourglass' },
  { key: 'CONFIRMED', label: 'Confirmed', hint: 'A pro has been assigned.', icon: 'checkmark-circle-outline', iconDone: 'checkmark-circle' },
  { key: 'ON_THE_WAY', label: 'On the way', hint: 'Your pro is heading over.', icon: 'car-outline', iconDone: 'car' },
  { key: 'IN_PROGRESS', label: 'In progress', hint: "The job's underway.", icon: 'construct-outline', iconDone: 'construct' },
  { key: 'DONE', label: 'Done', icon: 'checkmark-done-outline', iconDone: 'checkmark-done' },
];
const HEADLINE: Record<string, { icon: string; title: string; text: string }> = {
  REQUESTED: { icon: 'hourglass', title: 'Request received', text: "We're lining up the right pro for you." },
  CONFIRMED: { icon: 'checkmark-circle', title: "You're all set", text: 'Your pro is confirmed for the slot below.' },
  ON_THE_WAY: { icon: 'car', title: 'Your pro is on the way', text: 'Keep your phone handy and the door open.' },
  IN_PROGRESS: { icon: 'construct', title: 'Work in progress', text: 'Your pro is on the job right now.' },
  DONE: { icon: 'checkmark-done', title: 'All done', text: 'Hope it went well. A quick review helps others.' },
  CANCELLED: { icon: 'close-circle', title: 'Booking cancelled', text: 'This booking is closed. You can book again anytime.' },
};
const when = (iso: string) => {
  const n = Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n > 1 ? `In ${n} days` : `${-n} day${n === -1 ? '' : 's'} ago`;
};
const isoDay = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const chatOn = !!useConfig().get('flags.chatEnabled');
  const router = useRouter();
  const { user } = useSession();
  const { payNow, node: payNode } = usePayment();
  const [tracking, setTracking] = useState(false);
  const { data: b, error, refreshing, refresh, reload } = useFetch<any>(`/bookings/${id}`, 15000);
  const [msg, setMsg] = useState('');
  const [resched, setResched] = useState(false);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => isoDay(i + 1)), []);
  const [day, setDay] = useState(days[0]);
  const avail = useFetch<any>(b && resched ? `/services/${b.serviceId}/availability?day=${day}${b.providerId ? `&providerId=${b.providerId}` : ''}` : null);
  const [slot, setSlot] = useState('');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const withPhotos = !!b && (b.status === 'IN_PROGRESS' || b.status === 'DONE');
  const photos = useFetch<any[]>(withPhotos ? `/bookings/${id}/photos` : null);
  const [reason, setReason] = useState('');

  const header = <PageHeader tone="activity" eyebrow={b ? `BOOKING #${b.id}` : 'BOOKING'} title={b ? b.service.name : 'Booking'} right={b ? <Badge v={b.status} /> : undefined}
    left={<RoundBtn size={40} icon="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />} />;
  if (!b) return <View style={{ flex: 1 }}>{header}<Screen><PageSpace /><Status error={error} />{!error && <Skeleton height={140} count={2} />}</Screen></View>;

  const step = STEPS.findIndex((s) => s.key === b.status);

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true); setMsg('');
    try { await fn(); setMsg(ok); await reload(); } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  };
  const paid = b.payment?.status === 'PAID';
  const refunded = b.payment?.status === 'REFUNDED';
  const canPay = b.status !== 'CANCELLED' && !paid && !refunded && !!user;
  const pay = () => run(() => payNow(b.id, { name: user!.name, email: user!.email, phone: user!.phone }, 'bookings'), 'Payment received. Thank you!');
  const open = b.status !== 'DONE' && b.status !== 'CANCELLED';
  const canMove = b.status === 'REQUESTED' || b.status === 'CONFIRMED';

  const live = (b.status === 'ON_THE_WAY' || b.status === 'IN_PROGRESS') && b.provider?.lat != null && b.provider?.lng != null && b.lat != null && b.lng != null;
  const facts = [
    { icon: 'calendar', chip: t.accent, label: 'Date', value: dayLabel(b.day), sub: `at ${b.slot}` },
    { icon: 'cash', chip: t.green, label: 'Estimate', value: money(b.estimate), sub: paid ? 'paid online' : 'pay online or after the job' },
  ] as const;

  const canTrack = !!b.provider && open;
  const hl = HEADLINE[b.status] ?? HEADLINE.REQUESTED;
  const directions = () => {
    const q = b.lat != null && b.lng != null ? `${b.lat},${b.lng}` : encodeURIComponent(b.address);
    Linking.openURL(Platform.OS === 'ios' ? `http://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
  };
  const share = () => Share.share({ message: `${b.service.name} booking #${b.id}
${dayLabel(b.day)} at ${b.slot}
${b.address}` }).catch(() => {});

  return <View style={{ flex: 1 }}>
   {payNode}
   <View style={{ zIndex: 1100, elevation: 1100 }}>{header}</View>
   <Screen pad={false} bottomPad={110} refresh={refresh} refreshing={refreshing}>
    <PageSpace />
    <View style={{ padding: 18, gap: 16 }}>
      {/* status summary: what's happening and when, at a glance */}
      <View style={{ backgroundColor: t.lime, borderRadius: 26, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={hl.icon as any} size={28} color={t.ink} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt bold size={22}>{hl.title}</Txt>
          <Txt size={15} color={t.body}>{hl.text}</Txt>
        </View>
        {open && <View style={{ backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><Txt bold size={13}>{when(b.day)}</Txt></View>}
      </View>
      {/* the two facts people check first */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {facts.map((f) => <View key={f.label} style={{ flex: 1, backgroundColor: t.card, borderRadius: 26, padding: 16, gap: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: f.chip, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={f.icon} size={22} color={t.ink} /></View>
          <View>
            <Txt size={15} color={t.body}>{f.label}</Txt>
            <Txt bold size={24}>{f.value}</Txt>
            <Txt size={14} color={t.body}>{f.sub}</Txt>
          </View>
        </View>)}
      </View>

      {/* pro, address and notes as one grouped list */}
      <View style={{ backgroundColor: t.card, borderRadius: 26, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
          {b.provider ? <Avatar name={b.provider.name} size={52} /> : <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.lime, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person-outline" size={24} color={t.ink} /></View>}
          <View style={{ flex: 1 }}>
            <Txt size={15} color={t.body}>Your pro</Txt>
            <Txt bold size={20}>{b.provider ? b.provider.name : 'Assigning a pro shortly'}</Txt>
            {!!b.provider && <Txt size={14} color={t.body}>{b.provider.verified ? 'Verified · ' : ''}{b.provider.years} yrs experience · replies {b.provider.response}</Txt>}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: 1, borderColor: t.line }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.pink, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="location" size={24} color={t.ink} /></View>
          <View style={{ flex: 1 }}>
            <Txt size={15} color={t.body}>Service address</Txt>
            <Txt bold size={18} style={{ lineHeight: 24 }}>{b.address}</Txt>
          </View>
        </View>
        {!!b.notes && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: 1, borderColor: t.line }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.peach, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="document-text" size={22} color={t.ink} /></View>
          <View style={{ flex: 1 }}>
            <Txt size={15} color={t.body}>Your notes</Txt>
            <Txt bold size={18} style={{ lineHeight: 24 }}>{b.notes}</Txt>
          </View>
        </View>}
      </View>

      {b.status === 'CANCELLED' && !!b.cancelReason && <View style={{ backgroundColor: t.card, borderRadius: 26, padding: 18, gap: 4 }}>
        <Txt size={15} color={t.body}>Cancellation reason</Txt>
        <Txt bold size={18} style={{ lineHeight: 24 }}>{b.cancelReason}</Txt>
      </View>}

      {/* about the service */}
      <View style={{ backgroundColor: t.card, borderRadius: 26, padding: 18, gap: 12 }}>
        <Txt bold size={24}>About this service</Txt>
        {!!b.service.description && <Txt size={16} color={t.body} style={{ lineHeight: 22 }}>{b.service.description}</Txt>}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', gap: 6, alignItems: 'center' }}><Ionicons name="time-outline" size={16} color={t.ink} /><Txt bold size={13}>About {b.service.duration} min</Txt></View>
          <View style={{ backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', gap: 6, alignItems: 'center' }}><Ionicons name="pricetag-outline" size={16} color={t.ink} /><Txt bold size={13}>{b.service.category}</Txt></View>
        </View>
        {!!b.service.terms && <Txt size={13} color={t.body} style={{ lineHeight: 19 }}>{b.service.terms}</Txt>}
      </View>

      {/* booking summary */}
      <View style={{ backgroundColor: t.card, borderRadius: 26, padding: 18, gap: 10 }}>
        <Txt bold size={24}>Booking summary</Txt>
        {([['Booked for', b.name], ['Contact', b.phone], ['Booked on', new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })], ['Estimate', money(b.estimate)], ['Payment', paid ? 'Paid online' : refunded ? 'Refunded' : 'Not paid yet']] as const).map(([k, v]) =>
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Txt size={15} color={t.body}>{k}</Txt><Txt bold size={15} style={{ flexShrink: 1, textAlign: 'right' }}>{v}</Txt></View>)}
      </View>

      {b.status !== 'CANCELLED' && <View style={{ backgroundColor: t.card, borderRadius: 26, padding: 18, gap: 6 }}>
        <Txt bold size={24} style={{ marginBottom: 6 }}>Where things stand</Txt>
        <Timeline steps={STEPS} current={step} play />
        {live && <LiveMap home={{ lat: b.lat, lng: b.lng }} pro={{ lat: b.provider.lat, lng: b.provider.lng }} label={b.status === 'IN_PROGRESS' ? `${b.provider.name} is on the job` : `${b.provider.name} is on the way`} />}
      </View>}

      {!!b.otp && (b.status === 'ON_THE_WAY' || b.status === 'IN_PROGRESS') && <View style={{ backgroundColor: t.ink, borderRadius: 26, padding: 20, gap: 8, alignItems: 'center' }}>
        <Txt size={14} color={t.brandInk} style={{ opacity: 0.75 }}>{b.status === 'ON_THE_WAY' ? 'Start code' : 'Completion code'}</Txt>
        <Txt bold size={44} color={t.brandInk} style={{ letterSpacing: 12 }}>{b.otp}</Txt>
        <Txt size={13} color={t.brandInk} style={{ opacity: 0.75, textAlign: 'center' }}>{b.status === 'ON_THE_WAY' ? 'Share this with your pro when they arrive, to start the work.' : 'Share this only once you’re happy with the finished work.'}</Txt>
      </View>}

      {!!photos.data?.length && <View style={{ backgroundColor: t.card, borderRadius: 26, padding: 18, gap: 12 }}>
        <Txt bold size={24}>Photos from your pro</Txt>
        {(['BEFORE', 'AFTER'] as const).map((k) => { const list = photos.data!.filter((p) => p.kind === k); return list.length ? <View key={k} style={{ gap: 8 }}>
          <Txt size={14} color={t.body}>{k === 'BEFORE' ? 'Before' : 'After'}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{list.map((p) => <Image key={p.id} source={{ uri: p.data }} style={{ width: 96, height: 96, borderRadius: 14 }} />)}</View>
        </View> : null; })}
      </View>}

      {!!b.provider && b.status !== 'REQUESTED' && chatOn && <View style={{ backgroundColor: t.card, borderRadius: 26, padding: 18, gap: 12 }}>
        <Txt bold size={24}>Chat with {b.provider.name.split(' ')[0]}</Txt>
        <Chat bookingId={b.id} canSend={open} />
      </View>}

      {canTrack && <View style={{ backgroundColor: t.card, borderRadius: 26, padding: 18, gap: 12 }}>
        <Button title={tracking ? 'Hide tracking' : `Track ${b.provider.name}`} kind={tracking ? 'ghost' : undefined} onPress={() => { setTracking((v) => !v); reload(); }} />
        {tracking && (b.lat != null && b.lng != null
          ? <>
            <LiveMap home={{ lat: b.lat, lng: b.lng }} pro={b.provider.lat != null && b.provider.lng != null ? { lat: b.provider.lat, lng: b.provider.lng } : null} label={`${b.provider.name}`} />
            {(b.provider.lat == null || b.provider.lng == null) && <Txt size={14} color={t.body}>{b.provider.name}'s live location isn't shared yet. It appears here once they're on the way.</Txt>}
          </>
          : <Txt size={14} color={t.body}>No map location was saved for this booking.</Txt>)}
      </View>}

      {canPay && <Card style={{ borderRadius: 26, padding: 18, gap: 10 }}>
        <Txt bold size={24}>Pay online</Txt>
        <Txt size={15} color={t.body}>Settle the {money(b.estimate)} estimate now with UPI, card or netbanking, or pay your pro after the job.</Txt>
        <Button title={`Pay ${money(b.estimate)}`} busy={busy} onPress={pay} />
      </Card>}

      {!!msg && <Banner kind={/fail|cannot|taken|late|closed|Cannot|Payment cancelled/.test(msg) ? 'bad' : 'ok'}>{msg}</Banner>}

      {resched && <Card style={{ borderRadius: 26, padding: 18, gap: 14 }}>
        <Txt bold size={24}>Pick a new time</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{days.map((d) => <Chip onCard key={d} title={dayLabel(d)} on={d === day} onPress={() => { setDay(d); setSlot(''); }} />)}</View>
        {avail.data && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {avail.data.slots.map((s: any) => <Chip onCard key={s.slot} title={s.slot} on={slot === s.slot} disabled={!s.available} onPress={() => setSlot(s.slot)} />)}
        </View>}
        <Button title="Save new time" disabled={!slot} busy={busy} onPress={() => run(async () => { await api(`/bookings/${b.id}`, 'PATCH', { day, slot }); setResched(false); }, 'Rescheduled.')} />
        <Button title="Never mind" kind="ghost" onPress={() => setResched(false)} />
      </Card>}

      {/* actions side by side: reschedule is the main one, cancel is a quiet outline */}
      {cancelling && <Modal transparent animationType="fade" visible onRequestClose={() => { setCancelling(false); setReason(''); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(20,20,20,0.45)', justifyContent: 'center', padding: 18 }}>
          <Card style={{ borderRadius: 26, padding: 18, gap: 14 }}>
            <Txt bold size={24}>Cancel booking #{b.id}?</Txt>
            <Field onCard label="Reason (optional)" placeholder="Tell us why you're cancelling" value={reason} onChangeText={setReason} multiline maxLength={300} />
            <Button title="Yes, cancel booking" busy={busy} onPress={() => run(async () => { const r = reason.trim(); await api(`/bookings/${b.id}`, 'PATCH', { status: 'CANCELLED', ...(r ? { reason: r } : {}) }); setCancelling(false); setReason(''); }, 'Booking cancelled.')} />
            <Button title="Keep it" kind="ghost" onPress={() => { setCancelling(false); setReason(''); }} />
          </Card>
        </View>
      </Modal>}

      {/* quick actions */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[
          { icon: 'navigate', label: 'Directions', onPress: directions },
          { icon: 'share-social', label: 'Share', onPress: share },
          { icon: 'repeat', label: 'Book again', onPress: () => router.push(`/service/book?serviceId=${b.serviceId}&rebook=${b.id}${b.providerId ? `&providerId=${b.providerId}` : ''}` as any) },
        ].map((a) => <Tap key={a.label} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label} scaleTo={0.96}
          style={{ flex: 1, backgroundColor: t.card, borderRadius: 22, paddingVertical: 14, alignItems: 'center', gap: 6 }}>
          <Ionicons name={a.icon as any} size={22} color={t.ink} />
          <Txt bold size={13}>{a.label}</Txt>
        </Tap>)}
      </View>

      {open && !resched && !cancelling && <View style={{ flexDirection: 'row', gap: 12 }}>
        {canMove && <Button title="Reschedule" onPress={() => setResched(true)} style={{ flex: 1, paddingVertical: 18 }} />}
        <Tap onPress={() => setCancelling(true)} accessibilityRole="button" accessibilityLabel="Cancel booking" scaleTo={0.97} disabled={busy}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(210,58,74,0.45)', backgroundColor: 'rgba(210,58,74,0.06)' }}>
          <Txt bold size={16} color={t.bad}>Cancel booking</Txt>
        </Tap>
      </View>}

      {b.status === 'DONE' && (b.review
        ? <Card style={{ borderRadius: 26, padding: 18, gap: 10 }}><Txt bold size={24}>Your review</Txt><Stars value={b.review.rating} />{!!b.review.text && <Txt size={17}>{b.review.text}</Txt>}</Card>
        : <Card style={{ borderRadius: 26, padding: 18, gap: 14 }}>
          <Txt bold size={24}>How did it go?</Txt>
          <Stars value={rating} onChange={setRating} />
          <Field onCard label="Comment (optional)" value={text} onChangeText={setText} multiline />
          <Button title="Submit review" disabled={!rating} busy={busy} onPress={() => run(() => api('/reviews', 'POST', { kind: 'service', target: b.serviceId, bookingId: b.id, rating, ...(text.trim() ? { text: text.trim() } : {}) }), 'Thanks for your review!')} />
        </Card>)}
    </View>
   </Screen>
  </View>;
}
