import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { Card, Empty, FadeIn, Screen, Skeleton, Status, Txt, useFetch, useTheme, when } from '../src/ui';

export default function Notifications() {
  const router = useRouter();
  const t = useTheme();
  const { data, error, refreshing, refresh } = useFetch<any[]>('/notifications');

  /* Mark everything read once the list has been shown (keep the unread highlight for this visit). */
  useEffect(() => {
    if (data?.some((n) => !n.read)) { const id = setTimeout(() => api('/notifications/read-all', 'POST').catch(() => {}), 1500); return () => clearTimeout(id); }
  }, [data]);

  const go = (href?: string) => {
    if (href?.startsWith('/orders')) router.push('/activity');
    else if (href?.startsWith('/booking/')) router.push(href.split('?')[0] as any);
  };

  return <Screen refresh={refresh} refreshing={refreshing}>
    {!data && !error && <Skeleton height={76} />}
    <Status error={error} />
    {data && !data.length && <Empty icon="notifications-outline" title="You're all caught up" text="Updates about your bookings and orders will land here." />}
    {(data ?? []).map((n, i) => <FadeIn key={n.id} i={i}><Card onPress={() => go(n.href)} tint={n.read ? undefined : t.infoBg} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: n.read ? '#fff' : t.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={n.read ? 'notifications-outline' : 'notifications'} size={19} color={t.ink} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt bold={!n.read}>{n.text}</Txt>
        <Txt muted size={12}>{when(n.createdAt)}</Txt>
      </View>
    </Card></FadeIn>)}
  </Screen>;
}
