import { View } from 'react-native';
import { Text } from 'react-native';
import { Card, PageTitle, Row, Screen, Stars, Status, Txt, font, mono, useFetch, useTheme, when } from '../../src/ui';

type Review = { id: string; rating: number; text: string; createdAt: string; customer: string; service: string | null };
type Data = { average: number | null; count: number; breakdown: { stars: number; count: number }[]; items: Review[] };

function Breakdown({ rows, total }: { rows: Data['breakdown']; total: number }) {
  const t = useTheme();
  return <View style={{ gap: 6, marginTop: 6 }}>
    {rows.map((r) => <Row key={r.stars}>
      <Text style={mono(12, { color: t.muted, width: 32 })}>{r.stars} ★</Text>
      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: t.surface, overflow: 'hidden' }}>
        <View style={{ width: `${total ? (r.count / total) * 100 : 0}%`, height: 8, backgroundColor: t.ink }} />
      </View>
      <Text style={mono(12, { color: t.muted, width: 28, textAlign: 'right' })}>{r.count}</Text>
    </Row>)}
  </View>;
}

export default function Reviews() {
  const t = useTheme();
  const r = useFetch<Data>('/pro/reviews', 60000);

  return <Screen refresh={r.refresh} refreshing={r.refreshing}>
    <PageTitle title="Reviews" sub={r.data ? (r.data.count ? `${r.data.count} from customers` : 'No reviews yet') : ' '} />
    {!r.data ? <Status error={r.error} loading={!r.error} /> : <>
      <Card>
        <Row between>
          <View>
            <Text style={mono(48, { color: t.ink, letterSpacing: -2, lineHeight: 52 })}>{r.data.average != null ? r.data.average.toFixed(1) : '—'}</Text>
            <Txt muted size={13}>{r.data.count} review{r.data.count === 1 ? '' : 's'}</Txt>
          </View>
          {r.data.average != null && <Stars value={Math.round(r.data.average)} />}
        </Row>
        <Breakdown rows={r.data.breakdown} total={r.data.count} />
      </Card>
      {r.data.items.length === 0 ? <Status empty="Customer reviews will appear here after completed jobs." /> :
        r.data.items.map((x) => <Card key={x.id}>
          <Row between>
            <Txt bold size={15} style={{ fontFamily: font.semibold }}>{x.customer}</Txt>
            <Stars value={x.rating} />
          </Row>
          {!!x.text && <Txt size={14}>{x.text}</Txt>}
          <Text style={mono(11, { color: t.muted })}>{[x.service, when(x.createdAt)].filter(Boolean).join(' · ')}</Text>
        </Card>)}
    </>}
  </Screen>;
}
