import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from './api';
import { takePendingCoupon } from './promo';
import { Banner, Button, Field, Row, Txt } from './ui';

export type AppliedCoupon = { code: string; percent: number; maxDiscount?: number | null };

/* Rupee discount for a basket, honouring the coupon's cap. The server computes the real figure when placing. */
export const couponOff = (c: AppliedCoupon | null, amount: number) => {
  if (!c) return 0;
  const off = Math.round(amount * c.percent / 100);
  return c.maxDiscount ? Math.min(off, c.maxDiscount) : off;
};

/* Coupon entry with a live check, so the customer sees the saving before they commit.
   The server re-validates the code when the booking or order is actually placed. */
export default function CouponBox({ applied, onChange, onCard, amount }: { applied: AppliedCoupon | null; onChange: (c: AppliedCoupon | null) => void; onCard?: boolean; amount?: number }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const q = amount !== undefined ? `?amount=${amount}` : '';

  const apply = async () => {
    setBusy(true); setErr('');
    try { onChange(await api(`/orders/coupon/${encodeURIComponent(code.trim())}${q}`)); setCode(''); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  /* A code picked from a home banner is applied automatically the first time a coupon box appears. */
  useEffect(() => {
    if (applied) return;
    const c = takePendingCoupon();
    if (c) api(`/orders/coupon/${encodeURIComponent(c)}${q}`).then(onChange).catch((e: any) => setErr(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (applied) return <Row between>
    <View style={{ flex: 1 }}><Txt bold>{applied.code} applied</Txt><Txt muted size={13}>{applied.percent}% off{applied.maxDiscount ? ` (up to ₹${applied.maxDiscount})` : ''}</Txt></View>
    <Button title="Remove" kind="ghost" onPress={() => onChange(null)} />
  </Row>;

  return <View style={{ gap: 8 }}>
    <Row style={{ alignItems: 'flex-end' }}>
      <View style={{ flex: 1 }}><Field onCard={onCard} label="Coupon code (optional)" value={code} onChangeText={(v) => { setCode(v); setErr(''); }} autoCapitalize="characters" /></View>
      <Button title="Apply" kind="ghost" disabled={!code.trim()} busy={busy} onPress={apply} />
    </Row>
    {!!err && <Banner kind="bad">{err}</Banner>}
  </View>;
}
