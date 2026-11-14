import { useState } from 'react';
import { View } from 'react-native';
import { api } from './api';
import { Banner, Button, Field, Row, Txt } from './ui';

export type AppliedCoupon = { code: string; percent: number };

/* Coupon entry with a live check, so the customer sees the saving before they commit.
   The server re-validates the code when the booking or order is actually placed. */
export default function CouponBox({ applied, onChange, onCard }: { applied: AppliedCoupon | null; onChange: (c: AppliedCoupon | null) => void; onCard?: boolean }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const apply = async () => {
    setBusy(true); setErr('');
    try { onChange(await api(`/orders/coupon/${encodeURIComponent(code.trim())}`)); setCode(''); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  if (applied) return <Row between>
    <View style={{ flex: 1 }}><Txt bold>{applied.code} applied</Txt><Txt muted size={13}>{applied.percent}% off</Txt></View>
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
