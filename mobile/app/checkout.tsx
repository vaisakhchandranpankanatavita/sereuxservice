import { useState } from 'react';
import { useRouter } from 'expo-router';
import { api } from '../src/api';
import { useCart } from '../src/cart';
import { usePayment } from '../src/payment';
import { useSession } from '../src/session';
import { Button, Card, Chip, Field, Row, Screen, Txt, money, useTheme } from '../src/ui';

export default function Checkout() {
  const { lines, subtotal, clear } = useCart();
  const { user } = useSession();
  const router = useRouter();
  const t = useTheme();
  const { payNow, node } = usePayment();
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', address: '', city: '', pin: '', coupon: '' });
  const [pay, setPay] = useState<'COD' | 'ONLINE'>('COD');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const ready = lines.length && f.name.trim() && /^[0-9+\s-]{8,15}$/.test(f.phone) && f.address.trim() && f.city.trim() && /^[0-9]{6}$/.test(f.pin);

  const place = async () => {
    setBusy(true); setErr('');
    try {
      const o = await api('/orders', 'POST', {
        name: f.name.trim(), phone: f.phone, address: f.address.trim(), city: f.city.trim(), pin: f.pin,
        ...(f.coupon.trim() ? { coupon: f.coupon.trim() } : {}),
        paymentMethod: pay,
        items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
      });
      clear();
      if (pay === 'ONLINE' && user) {
        try { await payNow(o.id, { name: user.name, email: user.email, phone: user.phone }); } catch (e: any) { setErr(e.message); }
      }
      router.replace(`/order/${o.id}`);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return <Screen>
    <Card><Row between><Txt muted>{lines.length} item{lines.length === 1 ? '' : 's'}</Txt><Txt bold size={18}>{money(subtotal)}</Txt></Row></Card>
    <Field label="Name" value={f.name} onChangeText={set('name')} />
    <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
    <Field label="Address" value={f.address} onChangeText={set('address')} multiline />
    <Field label="City" value={f.city} onChangeText={set('city')} />
    <Field label="PIN code (6 digits)" value={f.pin} onChangeText={set('pin')} keyboardType="number-pad" maxLength={6} />
    <Field label="Coupon code (optional)" value={f.coupon} onChangeText={set('coupon')} autoCapitalize="characters" />
    <Row><Chip title="Cash on delivery" on={pay === 'COD'} onPress={() => setPay('COD')} /><Chip title="Pay online" on={pay === 'ONLINE'} onPress={() => setPay('ONLINE')} /></Row>
    {!!err && <Txt color={t.bad}>{err}</Txt>}
    <Button title={pay === 'ONLINE' ? 'Pay now' : 'Place order'} onPress={place} busy={busy} disabled={!ready} />
    {node}
  </Screen>;
}
