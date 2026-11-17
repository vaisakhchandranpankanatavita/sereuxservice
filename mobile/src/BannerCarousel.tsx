import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { img } from './api';
import { setPendingCoupon } from './promo';
import { R, Tap, Txt, useFetch } from './ui';

type Ad = { id: number; title: string; subtitle: string; img: string | null; color: string; coupon: string | null; percent: number | null; serviceId: number | null };

/* Admin-managed ads at the top of the home screen. Banners with a coupon get an Apply button
   that stashes the code so it is applied at booking/checkout. */
export default function BannerCarousel() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data } = useFetch<Ad[]>('/banners', 120000);
  const [i, setI] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  const list = useRef<FlatList<Ad>>(null);
  const w = width - 36;
  const n = data?.length ?? 0;

  useEffect(() => {
    if (n < 2) return;
    const id = setInterval(() => setI((p) => { const nx = (p + 1) % n; list.current?.scrollToOffset({ offset: nx * (w + 10), animated: true }); return nx; }), 5000);
    return () => clearInterval(id);
  }, [n, w]);

  if (!data?.length) return null;

  const open = (b: Ad) => { if (b.serviceId) router.push(`/service/${b.serviceId}`); };
  const apply = (b: Ad) => {
    setPendingCoupon(b.coupon);
    if (b.serviceId) router.push(`/service/${b.serviceId}`); else setSaved(b.coupon);
  };

  return <View style={{ gap: 8 }}>
    <FlatList ref={list} data={data} horizontal keyExtractor={(b) => String(b.id)} showsHorizontalScrollIndicator={false}
      snapToInterval={w + 10} decelerationRate="fast" ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
      onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / (w + 10)))}
      renderItem={({ item: b }) => {
        const dark = false;
        const Info = b.serviceId ? Tap : View;
        const infoProps = b.serviceId
          ? { onPress: () => open(b), scaleTo: 0.98, accessibilityRole: 'button' as const, accessibilityLabel: `${b.title}. ${b.subtitle}` }
          : {};
        /* The "open service" tap and the "apply coupon" tap are siblings, not nested — a button
           inside another button is invalid on web and risks double-firing both handlers on native. */
        return <View style={{ width: w, minHeight: 110, backgroundColor: b.color, borderRadius: R.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Info {...infoProps} style={{ gap: 4 }}>
              <Txt bold size={20} numberOfLines={2} color={dark ? '#fff' : undefined}>{b.title}</Txt>
              {!!b.subtitle && <Txt size={13} numberOfLines={2}>{b.subtitle}</Txt>}
            </Info>
            {!!b.coupon && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Tap onPress={() => apply(b)} scaleTo={0.94} accessibilityRole="button" accessibilityLabel={`Apply code ${b.coupon}`}
                style={{ backgroundColor: '#1c1c1c', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
                <Txt bold size={13} color="#fff">{saved === b.coupon ? 'Saved ✓' : b.percent ? `Apply · ${b.percent}% off` : 'Apply'}</Txt>
              </Tap>
              <Txt size={12} bold>{b.coupon}</Txt>
            </View>}
            {saved === b.coupon && !!b.coupon && <Txt size={11}>Code will be applied when you book or check out.</Txt>}
          </View>
          {!!b.img && <Image source={{ uri: img(b.img) }} style={{ width: 84, height: 84, borderRadius: 18 }} resizeMode="cover" />}
        </View>;
      }} />
    {n > 1 && <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
      {data.map((b, k) => <View key={b.id} style={{ width: k === i ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? '#1c1c1c' : '#cfcfcf' }} />)}
    </View>}
  </View>;
}
