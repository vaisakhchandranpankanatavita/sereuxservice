import { useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { img } from '../../src/api';
import { useCart } from '../../src/cart';
import { Card, Chip, Chips, FadeIn, Field, RoundBtn, Screen, Skeleton, Status, Txt, money, useFetch, useTheme } from '../../src/ui';
import PageHeader, { PageSpace } from '../../src/PageHeader';

export default function Shop() {
  const router = useRouter();
  const t = useTheme();
  const cart = useCart();
  const { data, error, refreshing, refresh } = useFetch<any[]>('/products');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const cats = useMemo(() => [...new Set((data ?? []).map((p) => p.category))], [data]);
  const rows = useMemo(() => (data ?? []).filter((p) => (!cat || p.category === cat) && `${p.name} ${p.seller}`.toLowerCase().includes(q.trim().toLowerCase())), [data, q, cat]);

  return <View style={{ flex: 1 }}>
   <PageHeader tone="shop" eyebrow="THINGS FOR THE PLACE YOU LOVE" title="Shop" right={<RoundBtn size={40} icon="cart-outline" label={`Cart, ${cart.count} items`} onPress={() => router.push('/cart')} />} />
   <PageSpace />
   {/* filters stay pinned; only the product grid below scrolls */}
   <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6, gap: 12 }}>
      <Field label="" small value={q} onChangeText={setQ} placeholder="Search…" />
      <Chips><Chip title="All" on={!cat} onPress={() => setCat('')} />{cats.map((c) => <Chip key={c} title={c} on={cat === c} onPress={() => setCat(c)} />)}</Chips>
   </View>
   <Screen refresh={refresh} refreshing={refreshing}>
    {!data && !error && <Skeleton height={180} count={2} />}
    <Status error={error} empty={data && !rows.length ? 'No products match. Try another word or clear the filter.' : undefined} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
      {rows.map((p, i) => <FadeIn key={p.id} i={i} style={{ width: '31.5%' }}>
        <Card style={{ flex: 1, padding: 8, gap: 4, borderRadius: 16 }}>
          <Pressable onPress={() => router.push(`/product/${p.id}`)} accessibilityRole="link" accessibilityLabel={p.name} style={{ gap: 4 }}>
          <Image source={{ uri: img(p.img) }} style={{ width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#fff' }} resizeMode="cover" accessibilityLabel={p.name} />
          <Txt bold size={13} numberOfLines={2} style={{ lineHeight: 16 }}>{p.name}</Txt>
          <Txt bold size={11} color={t.body} numberOfLines={1}>{p.seller}</Txt>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            <Txt bold size={14} color={t.brand} style={{ flexShrink: 1 }} numberOfLines={1}>{money(p.price)}</Txt>
            <RoundBtn dark size={30} icon="cart-outline" label={`Add ${p.name} to cart`} onPress={() => cart.add(p)} />
          </View>
        </Card>
      </FadeIn>)}
    </View>
   </Screen>
  </View>;
}
