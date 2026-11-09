import { Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import { img } from '../src/api';
import { useCart } from '../src/cart';
import { Button, Card, Empty, FadeIn, R, Row, Screen, Stepper, Txt, money, useTheme } from '../src/ui';

export default function Cart() {
  const { lines, subtotal, setQty } = useCart();
  const router = useRouter();
  const t = useTheme();

  if (!lines.length) return <Screen>
    <Empty icon="cart-outline" title="Your cart is empty" text="Add something from the shop and it will wait for you here." action="Browse the shop" onAction={() => router.replace('/shop')} />
  </Screen>;

  return <Screen>
    {lines.map(({ product: p, qty }, i) => <FadeIn key={p.id} i={i}><Card style={{ gap: 12, padding: 14 }}>
      <Row style={{ gap: 14 }}>
        <Image source={{ uri: img(p.img) }} style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: '#fff' }} accessibilityLabel={p.name} />
        <View style={{ flex: 1, gap: 2 }}><Txt bold size={16} numberOfLines={2}>{p.name}</Txt><Txt size={13} color={t.body}>{money(p.price)} each</Txt></View>
      </Row>
      <Row between><Stepper value={qty} onChange={(n) => setQty(p.id, n)} /><Txt bold size={19}>{money(p.price * qty)}</Txt></Row>
    </Card></FadeIn>)}

    <Card tint={t.ink} style={{ borderRadius: R.lg, padding: 20, gap: 14 }}>
      <Row between><Txt color="rgba(255,255,255,0.7)">Subtotal</Txt><Txt bold size={26} color="#fff">{money(subtotal)}</Txt></Row>
      <Txt size={13} color="rgba(255,255,255,0.6)">Coupons are applied at checkout. Pay on delivery or online.</Txt>
      <Button title="Go to checkout" kind="accent" onPress={() => router.push('/checkout')} />
    </Card>
  </Screen>;
}
