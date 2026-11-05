import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, Eyebrow, Chips, Field, Screen, Status, Tile, Txt, money, useFetch, useTheme } from '../../src/ui';
import { ServiceArt } from '../../src/serviceArt';

export default function Services() {
  const router = useRouter();
  const t = useTheme();
  const { data, error, refreshing, refresh } = useFetch<any[]>('/services');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');

  const cats = useMemo(() => [...new Set((data ?? []).map((s) => s.category))], [data]);
  const rows = useMemo(() => (data ?? []).filter((s) => (!cat || s.category === cat)
    && `${s.name} ${s.description} ${s.terms}`.toLowerCase().includes(q.trim().toLowerCase())), [data, q, cat]);

  return <Screen refresh={refresh} refreshing={refreshing}>
    <Eyebrow>Our services</Eyebrow>
    <Txt bold size={30}>What needs fixing today?</Txt>
    <Field label="Search services" value={q} onChangeText={setQ} placeholder="Plumbing, AC, cleaning…" />
    <Chips>
      <Chip title="All" on={!cat} onPress={() => setCat('')} />
      {cats.map((c) => <Chip key={c} title={c} on={cat === c} onPress={() => setCat(c)} />)}
    </Chips>
    <Status error={error} loading={!data && !error} empty={data && !rows.length ? 'No services match.' : undefined} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {rows.map((s) => <View key={s.id} style={{ width: '47.5%', flexGrow: 1 }}>
        <Tile onPress={() => router.push(`/service/${s.id}`)} media={<ServiceArt name={s.name} />}>
          <Txt bold size={16} color="#fff">{s.name}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
            <View style={{ backgroundColor: t.accent, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
              <Txt bold size={15} color="#17160f">{money(s.fromPrice)}</Txt>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
              <Txt bold size={15} color="#17160f">{s.duration} min</Txt>
            </View>
          </View>
        </Tile>
      </View>)}
    </View>
  </Screen>;
}
