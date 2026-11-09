import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, Button, Card, Empty, FadeIn, H, R, Row, RoundBtn, Screen, Skeleton, Stars, Status, Txt, money, useFetch, useTheme } from '../../src/ui';
import PageHeader, { PageSpace } from '../../src/PageHeader';

export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const svc = useFetch<any>(`/services/${id}`);
  const reviews = useFetch<any[]>(`/reviews?kind=service&target=${id}`);
  const s = svc.data;
  const header = <PageHeader tone="home" eyebrow="SERVICE" title={s ? s.name : 'Service'}
    left={<RoundBtn size={40} icon="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />} />;

  if (!s) return <View style={{ flex: 1 }}>{header}<Screen><PageSpace /><Status error={svc.error} /><Skeleton height={220} count={2} /></Screen></View>;
  const book = (providerId?: number) => router.push({ pathname: '/service/book', params: { serviceId: String(s.id), ...(providerId ? { providerId: String(providerId) } : {}) } });

  return <View style={{ flex: 1 }}>
    {header}
    <Screen pad={false} refresh={() => { svc.refresh(); reviews.refresh(); }} refreshing={svc.refreshing}>
      <PageSpace />
      <View style={{ padding: 18, gap: 14 }}>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <View style={{ backgroundColor: '#f4f4f6', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}><Txt bold size={14}>from {money(s.fromPrice)}</Txt></View>
          <View style={{ backgroundColor: '#f4f4f6', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Ionicons name="time-outline" size={15} color={t.ink} /><Txt bold size={14}>about {s.duration} min</Txt>
          </View>
        </Row>
        <Txt color={t.body} style={{ lineHeight: 22 }}>{s.description}</Txt>
        <Button title="Book the first available pro" onPress={() => book()} />

        <H>Choose a pro</H>
        {!s.providers.length && <Txt muted>No pros listed for this service yet.</Txt>}
        {s.providers.map((p: any, i: number) => <FadeIn key={p.id} i={i}><Card style={{ gap: 10, borderRadius: R.lg, padding: 16 }}>
          <Row>
            <Avatar name={p.name} size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <Row style={{ gap: 6 }}><Txt bold size={17}>{p.name}</Txt>{!!p.verified && <Ionicons name="checkmark-circle" size={17} color={t.ok} />}</Row>
              <Txt size={13} color={t.body}>{p.years} yrs experience · replies in {p.response}</Txt>
            </View>
          </Row>
          {!!p.bio && <Txt size={14} color={t.body}>{p.bio}</Txt>}
          <Button title={`Book ${p.name.split(' ')[0]}`} onPress={() => book(p.id)} style={{ backgroundColor: '#fff' }} kind="ghost" />
        </Card></FadeIn>)}

        <H>Reviews</H>
        {reviews.data && !reviews.data.length && <Txt muted>No reviews yet. Be the first after your visit.</Txt>}
        {(reviews.data ?? []).map((r) => <Card key={r.id} style={{ gap: 8 }}>
          <Row between><Txt bold>{r.user.name}</Txt><Stars value={r.rating} /></Row>
          {!!r.text && <Txt color={t.body}>{r.text}</Txt>}
        </Card>)}
      </View>
    </Screen>
  </View>;
}
