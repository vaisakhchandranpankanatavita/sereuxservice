import { Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, img } from '../src/api';
import { Button, Card, Row, Screen, Status, Txt, money, useFetch, useTheme } from '../src/ui';

export default function Wishlist() {
  const router = useRouter();
  const t = useTheme();
  const { data, error, refreshing, refresh, reload } = useFetch<any[]>('/wishlist');

  const remove = async (id: number) => { await api(`/wishlist/${id}`, 'DELETE').catch(() => {}); reload(); };

  return <Screen refresh={refresh} refreshing={refreshing}>
    <Status error={error} loading={!error && !data} empty={data && !data.length ? 'Nothing saved yet. Tap “Save to wishlist” on a product to see it here.' : undefined} />
    {(data ?? []).map((p) => <Card key={p.id}>
      <Pressable onPress={() => router.push(`/product/${p.id}`)} accessibilityRole="button">
        <Row>
          <Image source={{ uri: img(p.img) }} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: t.idleBg }} accessibilityLabel={p.name} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt bold numberOfLines={2}>{p.name}</Txt>
            <Txt muted>{money(p.price)}</Txt>
          </View>
        </Row>
      </Pressable>
      <Button title="Remove from wishlist" kind="ghost" onPress={() => remove(p.id)} />
    </Card>)}
  </Screen>;
}
