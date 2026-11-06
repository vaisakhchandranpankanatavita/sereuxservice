import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { usePayment } from '../../src/payment';
import { useSession } from '../../src/session';
import { Badge, Button, Card, Field, Row, Screen, Stars, Status, Txt, label, money, useFetch, useTheme, when } from '../../src/ui';

const FLOW = ['PLACED', 'SHIPPED', 'DELIVERED'];

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
    <Field label="Comment (optional)" value={text} onChangeText={setText} multiline />
    {!!err && <Txt color={t.bad}>{err}</Txt>}
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

  if (!o) return <Screen><Status error={error} loading={!error} /></Screen>;

  const step = FLOW.indexOf(o.status);
  const needsPayment = o.paymentMethod === 'ONLINE' && o.payment?.status !== 'PAID';
  const completePayment = async () => {
    if (!user) return;
    setPaying(true); setPayErr('');
    try { await payNow(o.id, { name: user.name, email: user.email, phone: user.phone }); await refresh(); }
    catch (e: any) { setPayErr(e.message); }
    finally { setPaying(false); }
  };

  return <Screen refresh={refresh} refreshing={refreshing}>
    <Row between><Txt bold size={22}>#{o.id}</Txt><Badge v={o.status} /></Row>
    <Txt muted>Placed {when(o.createdAt)}</Txt>

    {o.status !== 'CANCELLED' && <Card>
      {FLOW.map((s, i) => <Row key={s}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: i <= step ? t.brand : t.line }} />
        <Txt bold={i === step} muted={i > step}>{label(s)}</Txt>
      </Row>)}
    </Card>}

    {o.items.map((i: any) => <Card key={i.id}>
      <Row between><Txt bold style={{ flex: 1 }}>{i.qty}× {i.product.name}</Txt><Txt>{money(i.unitPrice * i.qty)}</Txt></Row>
      {o.status === 'DELIVERED' && (done[i.productId] ? <Txt color={t.ok}>Thanks for reviewing!</Txt> : <Rate productId={i.productId} onDone={() => setDone((d) => ({ ...d, [i.productId]: true }))} />)}
    </Card>)}
    <Card>
      <Row between><Txt muted>Subtotal</Txt><Txt>{money(o.subtotal)}</Txt></Row>
      {o.discount > 0 && <Row between><Txt muted>Discount{o.coupon ? ` (${o.coupon})` : ''}</Txt><Txt>−{money(o.discount)}</Txt></Row>}
      <Row between><Txt bold>Total</Txt><Txt bold>{money(o.total)}</Txt></Row>
      <Txt muted size={13}>{o.paymentMethod === 'ONLINE' ? (o.payment?.status === 'PAID' ? 'Paid online' : 'Awaiting payment') : 'Pay on delivery'}</Txt>
    </Card>
    {needsPayment && <>
      {!!payErr && <Txt color={t.bad}>{payErr}</Txt>}
      <Button title="Complete payment" busy={paying} onPress={completePayment} />
    </>}
    <Card><Txt bold>Delivering to</Txt><Txt muted>{o.name} · {o.phone}</Txt><Txt muted>{o.address}, {o.city} {o.pin}</Txt></Card>
    <Button title="Back to activity" kind="ghost" onPress={() => router.replace('/activity')} />
    {node}
  </Screen>;
}
