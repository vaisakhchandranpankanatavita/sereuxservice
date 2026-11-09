import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, Empty, FadeIn, Screen, Segmented, Skeleton, Status, Tap, Txt, dayLabel, money, useFetch, useTheme, when } from '../../src/ui';
import { ServiceArt } from '../../src/serviceArt';
import PageHeader, { PageSpace } from '../../src/PageHeader';

export default function Activity() {
  const router = useRouter();
  const t = useTheme();
  const [tab, setTab] = useState<'bookings' | 'orders'>('bookings');
  /* Two separate fetches: switching tabs on one shared fetch showed the previous tab's rows
     (bookings have no `items`, orders have no `service`) for a render and crashed the list. */
  const bookingsQ = useFetch<any[]>('/bookings', 20000);
  const ordersQ = useFetch<any[]>('/orders', 20000);
  const { data, error, refreshing, refresh } = tab === 'bookings' ? bookingsQ : ordersQ;
  const loading = !data && !error;

  return <View style={{ flex: 1 }}>
   <PageHeader tone="activity" eyebrow="TRACK EVERYTHING" title="Your activity" right={tab === 'bookings'
     ? <Tap onPress={() => router.push('/')} accessibilityRole="button" accessibilityLabel="New booking" scaleTo={0.95}
       style={{ backgroundColor: t.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
       <Ionicons name="add" size={18} color="#fff" /><Txt bold size={13} color="#fff">New booking</Txt>
     </Tap>
     : <Tap onPress={() => router.push('/shop')} accessibilityRole="button" accessibilityLabel="Open the shop" scaleTo={0.95}
       style={{ backgroundColor: t.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
       <Ionicons name="bag-handle-outline" size={16} color="#fff" /><Txt bold size={13} color="#fff">Shop</Txt>
     </Tap>} />
   <Screen refresh={refresh} refreshing={refreshing}>
    <PageSpace />
    <Segmented value={tab} onChange={(k) => setTab(k as any)} options={[{ key: 'bookings', label: 'Bookings' }, { key: 'orders', label: 'Orders' }]} />
    {loading && <Skeleton height={92} />}
    {!!error && <Status error={error} />}
    {data && !data.length && (tab === 'bookings'
      ? <Empty icon="calendar-outline" title="No bookings yet" text="Book a verified pro and you can follow every step here." action="Browse services" onAction={() => router.push('/')} />
      : <Empty icon="bag-handle-outline" tint={t.peach} title="No orders yet" text="Things you buy from the shop show up here, with delivery tracking." action="Open the shop" onAction={() => router.push('/shop')} />)}
    {tab === 'bookings' && (data ?? []).map((b, i) => <FadeIn key={b.id} i={i}><Card onPress={() => router.push(`/booking/${b.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 22, paddingHorizontal: 16, minHeight: 116 }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, overflow: 'hidden', backgroundColor: '#fff' }}><ServiceArt name={b.service.name} /></View>
      <View style={{ flex: 1, gap: 3 }}>
        <Txt bold size={19}>{b.service.name}</Txt>
        <Txt size={15} color={t.body}>{dayLabel(b.day)} · {b.slot}</Txt>
        <Txt size={13} muted>#{b.id}{b.provider ? ` · ${b.provider.name}` : ''}</Txt>
      </View>
      <Badge v={b.status} />
    </Card></FadeIn>)}
    {tab === 'orders' && (data ?? []).map((o, i) => <FadeIn key={o.id} i={i}><Card onPress={() => router.push(`/order/${o.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 22, paddingHorizontal: 16, minHeight: 116 }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: t.peach, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="bag-handle" size={30} color={t.ink} /></View>
      <View style={{ flex: 1, gap: 3 }}>
        <Txt bold size={19}>Order #{o.id}</Txt>
        <Txt size={15} color={t.body}>{o.items.length} item{o.items.length === 1 ? '' : 's'} · {money(o.total)}</Txt>
        <Txt size={13} muted>{when(o.createdAt)}</Txt>
      </View>
      <Badge v={o.status} />
    </Card></FadeIn>)}
   </Screen>
  </View>;
}
