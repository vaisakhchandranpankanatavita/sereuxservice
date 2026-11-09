import { useState } from 'react';
import { Image, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, img } from '../../src/api';
import { useCart } from '../../src/cart';
import { Banner, Button, Card, H, R, RoundBtn, Row, Screen, Skeleton, Stars, Status, Txt, Wash, money, useFetch, useTheme } from '../../src/ui';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const cart = useCart();
  const p = useFetch<any>(`/products/${id}`);
  const reviews = useFetch<any[]>(`/reviews?kind=product&target=${id}`);
  const wish = useFetch<any[]>('/wishlist');
  const [added, setAdded] = useState(false);
  const saved = !!wish.data?.some((x) => String(x.id) === id);

  const toggleWish = async () => {
    await api(`/wishlist/${id}`, saved ? 'DELETE' : 'PUT').catch(() => {});
    wish.reload();
  };

  if (!p.data) return <Screen><Status error={p.error} /><Skeleton height={320} count={2} /></Screen>;
  const d = p.data;
  const save = d.oldPrice > d.price ? Math.round((1 - d.price / d.oldPrice) * 100) : 0;

  return <Screen>
    <View style={{ backgroundColor: t.lime, borderRadius: R.lg + 4, padding: 18, overflow: 'hidden' }}>
      <Wash />
      <Image source={{ uri: img(d.img) }} style={{ width: '100%', aspectRatio: 1, borderRadius: R.lg, backgroundColor: '#fff' }} resizeMode="contain" accessibilityLabel={d.name} />
      <View style={{ position: 'absolute', top: 28, right: 28 }}>
        <RoundBtn icon={saved ? 'heart' : 'heart-outline'} dark={saved} label={saved ? 'Remove from wishlist' : 'Save to wishlist'} onPress={toggleWish} />
      </View>
      {save > 0 && <View style={{ position: 'absolute', top: 28, left: 28, backgroundColor: t.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><Txt bold size={13} color="#fff">{save}% off</Txt></View>}
    </View>
    <Txt bold size={28}>{d.name}</Txt>
    <Txt color={t.body}>Sold by {d.seller}</Txt>
    <Row style={{ alignItems: 'baseline', gap: 10 }}>
      <Txt bold size={30}>{money(d.price)}</Txt>
      {d.oldPrice > d.price && <Txt muted size={16} style={{ textDecorationLine: 'line-through' }}>{money(d.oldPrice)}</Txt>}
    </Row>
    {!!d.blurb && <Txt color={t.body} style={{ lineHeight: 22 }}>{d.blurb}</Txt>}
    {added && <Banner kind="ok">Added to your cart.</Banner>}
    <Button title={added ? 'Add another' : 'Add to cart'} onPress={() => { cart.add(d); setAdded(true); }} />
    {added && <Button title="Go to cart" kind="accent" onPress={() => router.push('/cart')} />}

    <H>Reviews</H>
    {reviews.data && !reviews.data.length && <Txt muted>No reviews yet. Buyers can review from their order.</Txt>}
    {(reviews.data ?? []).map((r) => <Card key={r.id} style={{ gap: 8 }}><Row between><Txt bold>{r.user.name}</Txt><Stars value={r.rating} /></Row>{!!r.text && <Txt color={t.body}>{r.text}</Txt>}</Card>)}
  </Screen>;
}
