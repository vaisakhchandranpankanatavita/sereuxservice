import { Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, img } from '../src/api';
import { Card, Empty, FadeIn, RoundBtn, Row, Screen, Skeleton, Status, Txt, money, useFetch, useTheme } from '../src/ui';

export default function Wishlist() {
  const router = useRouter();
  const t = useTheme();
  const { data, error, refreshing, refresh, reload } = useFetch<any[]>('/wishlist');

  const remove = async (id: number) => { await api(`/wishlist/${id}`, 'DELETE').catch(() => {}); reload(); };

  return <Screen refresh={refresh} refreshing={refreshing}>
    {!data && !error && <Skeleton height={92} />}
    <Status error={error} />
    {data && !data.length && <Empty icon="heart-outline" tint={t.pink} title="Nothing saved yet" text="Tap the heart on a product and it will be kept here." action="Browse the shop" onAction={() => router.replace('/shop')} />}
    {(data ?? []).map((p, i) => <FadeIn key={p.id} i={i}><Card style={{ padding: 14 }}>
      <Row style={{ gap: 14 }}>
        <Pressable onPress={() => router.push(`/product/${p.id}`)} accessibilityRole="button" accessibilityLabel={p.name} style={{ flex: 1 }}>
          <Row style={{ gap: 14 }}>
            <Image source={{ uri: img(p.img) }} style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: '#fff' }} accessibilityLabel={p.name} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt bold size={16} numberOfLines={2}>{p.name}</Txt>
              <Txt color={t.body}>{money(p.price)}</Txt>
            </View>
          </Row>
        </Pressable>
        <RoundBtn icon="heart" dark label={`Remove ${p.name} from wishlist`} onPress={() => remove(p.id)} />
      </Row>
    </Card></FadeIn>)}
  </Screen>;
}
