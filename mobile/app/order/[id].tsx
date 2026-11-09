import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import PageHeader, { PageSpace } from '../../src/PageHeader';
import { api } from '../../src/api';
import { usePayment } from '../../src/payment';
import { useSession } from '../../src/session';
import { StatusIntro } from '../../src/StatusIntro';
import { Timeline, type Step } from '../../src/timeline';
import { Badge, Banner, Button, Card, Field, NoteCard, NoteLine, RoundBtn, Row, Screen, Skeleton, Stars, Status, Txt, money, useFetch, useTheme, when } from '../../src/ui';

const STEPS: Step[] = [
  { key: 'PLACED', label: 'Order placed', hint: "We've got it — packing starts shortly.", icon: 'receipt-outline', iconDone: 'receipt' },
  { key: 'SHIPPED', label: 'Shipped', hint: 'On its way to you.', icon: 'cube-outline', iconDone: 'cube' },
  { key: 'DELIVERED', label: 'Delivered', icon: 'home-outline', iconDone: 'checkmark-done' },
];

function Rate({ productId, onDone }: { productId: number; onDone: () => void }) {
  const t = useTheme();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr('');
    try { await api('/reviews', 'POST', { kind: 'product', target: productId, rating, ...(text.trim() ? { text: text.trim() } : {}) }); onDone(); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return <>
    <Stars value={rating} onChange={setRating} />
    <Field onCard label="Comment (optional)" value={text} onChangeText={setText} multiline />
    {!!err && <Banner kind="bad">{err}</Banner>}
    <Button title="Submit review" disabled={!rating} busy={busy} onPress={submit} />
  </>;
}

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const { data: o, error, refreshing, refresh } = useFetch<any>(`/orders/${id}`, 20000);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const { user } = useSession();
  const { payNow, node } = usePayment();
  const [payErr, setPayErr] = useState('');
  const [paying, setPaying] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  const header = <PageHeader tone="shop" eyebrow="ORDER" title={o ? `Order #${o.id}` : 'Order'} right={o ? <Badge v={o.status} /> : undefined}
    left={<RoundBtn size={40} icon="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/activity'))} />} />;
  if (!o) return <View style={{ flex: 1 }}>{header}<Screen><PageSpace /><Status error={error} />{!error && <Skeleton height={140} count={2} />}</Screen></View>;

  const step = STEPS.findIndex((s) => s.key === o.status);

  const needsPayment = o.paymentMethod === 'ONLINE' && o.payment?.status !== 'PAID';
  const completePayment = async () => {
    if (!user) return;
    setPaying(true); setPayErr('');
    try { await payNow(o.id, { name: user.name, email: user.email, phone: user.phone }); await refresh(); }
    catch (e: any) { setPayErr(e.message); }
    finally { setPaying(false); }
  };

  return <View style={{ flex: 1 }}>
   {header}
   <Screen refresh={refresh} refreshing={refreshing}>
    <PageSpace />
    <Txt color={t.body}>Placed {when(o.createdAt)}</Txt>

    {o.status !== 'CANCELLED' && <Card>
      <Txt bold size={18} style={{ marginBottom: 8 }}>Order status</Txt>
      <Timeline steps={STEPS} current={step} play={introDone || step < 0} />
    </Card>}

    {o.items.map((i: any) => <Card key={i.id}>
      <Row between><Txt bold size={16} style={{ flex: 1 }}>{i.qty}× {i.product.name}</Txt><Txt>{money(i.unitPrice * i.qty)}</Txt></Row>
      {o.status === 'DELIVERED' && (done[i.productId] ? <Banner kind="ok">Thanks for reviewing!</Banner> : <Rate productId={i.productId} onDone={() => setDone((d) => ({ ...d, [i.productId]: true }))} />)}
    </Card>)}
    <Card>
      <Row between><Txt muted>Subtotal</Txt><Txt>{money(o.subtotal)}</Txt></Row>
      {o.discount > 0 && <Row between><Txt muted>Discount{o.coupon ? ` (${o.coupon})` : ''}</Txt><Txt>−{money(o.discount)}</Txt></Row>}
      <Row between><Txt bold>Total</Txt><Txt bold>{money(o.total)}</Txt></Row>
      <Txt muted size={13}>{o.paymentMethod === 'ONLINE' ? (o.payment?.status === 'PAID' ? 'Paid online' : 'Awaiting payment') : 'Pay on delivery'}</Txt>
    </Card>
    {needsPayment && <>
      {!!payErr && <Banner kind="bad">{payErr}</Banner>}
      <Button title="Complete payment" busy={paying} onPress={completePayment} />
    </>}
    <NoteCard>
      <NoteLine bold size={22}>Delivering to</NoteLine>
      <NoteLine muted>{o.name} · {o.phone}</NoteLine>
      <NoteLine last>{o.address}, {o.city} {o.pin}</NoteLine>
    </NoteCard>
    <Button title="Back to activity" kind="ghost" onPress={() => router.replace('/activity')} />
    {node}
   </Screen>
   {!introDone && step >= 0 && <StatusIntro steps={STEPS} current={step} eyebrow="Order" title={`#${o.id}`} onDone={() => setIntroDone(true)} />}
  </View>;
}
