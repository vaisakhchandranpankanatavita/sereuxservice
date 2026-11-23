import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import {
  Avatar,
  Button,
  Card,
  Chip,
  PageTitle,
  R,
  Row,
  Screen,
  Status,
  Txt,
  font,
  mono,
  overline,
  useFetch,
  useTheme,
} from '../../src/ui';

type Review = {
  id: string;
  rating: number;
  text: string;
  reply?: string | null;
  createdAt: string;
  customer: string;
  service: string | null;
};

type Data = {
  average: number | null;
  count: number;
  breakdown: { stars: number; count: number }[];
  items: Review[];
};

type FilterType = 'all' | '5' | '4' | 'low' | 'comments';
type SortType = 'newest' | 'highest' | 'lowest';

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - d.getTime());
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
      }
      return `${diffHours}h ago`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return dateStr;
  }
}

/* Crisp 5-star row with vector star glyphs */
/* The pro's public reply under a review: shows it, or offers a small box to write (or edit) one. */
function ReplyBox({ review, onDone }: { review: Review; onDone: () => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.reply ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try { await api(`/pro/reviews/${review.id}/reply`, 'POST', { text }); setOpen(false); onDone(); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  if (!open) return <View style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.line }}>
    {!!review.reply && <Txt size={13} muted>Your reply: {review.reply}</Txt>}
    <Button title={review.reply ? 'Edit reply' : 'Reply'} kind="ghost" onPress={() => setOpen(true)} style={{ alignSelf: 'flex-start' }} />
  </View>;
  return <View style={{ gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.line }}>
    <TextInput value={text} onChangeText={setText} multiline maxLength={500} placeholder="Reply publicly to this review" placeholderTextColor={t.muted}
      style={{ color: t.ink, borderWidth: 1, borderColor: t.line, borderRadius: 10, padding: 10, minHeight: 70, textAlignVertical: 'top' }} />
    {!!err && <Txt size={13} style={{ color: t.bad }}>{err}</Txt>}
    <Row>
      <Button title="Post reply" onPress={save} busy={busy} style={{ flex: 1 }} />
      <Button title="Cancel" kind="ghost" onPress={() => setOpen(false)} disabled={busy} />
    </Row>
  </View>;
}

function StarGlyphs({ value, size = 18 }: { value: number; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= Math.round(value);
        return (
          <Ionicons
            key={n}
            name={active ? 'star' : 'star-outline'}
            size={size}
            color={active ? t.star : t.lineStrong}
          />
        );
      })}
    </View>
  );
}

/* Pro Rating Tier badge */
function TierPill({ average, count }: { average: number | null; count: number }) {
  const t = useTheme();
  if (average == null || count === 0) return null;

  if (average >= 4.8 && count >= 5) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: t.okBg,
          borderWidth: 1,
          borderColor: t.okLine,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: R.pill,
        }}
      >
        <Ionicons name="sparkles" size={13} color={t.ok} />
        <Text style={{ fontFamily: font.bold, fontSize: 11, color: t.ok, letterSpacing: 0.5 }}>
          TOP RATED PRO
        </Text>
      </View>
    );
  }
  if (average >= 4.5) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: t.infoBg,
          borderWidth: 1,
          borderColor: t.infoLine,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: R.pill,
        }}
      >
        <Ionicons name="shield-checkmark" size={13} color={t.info} />
        <Text style={{ fontFamily: font.bold, fontSize: 11, color: t.info, letterSpacing: 0.5 }}>
          HIGHLY RATED
        </Text>
      </View>
    );
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: t.surface,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: R.pill,
      }}
    >
      <Ionicons name="checkmark-circle" size={13} color={t.body} />
      <Text style={{ fontFamily: font.semibold, fontSize: 11, color: t.body, letterSpacing: 0.5 }}>
        VERIFIED PRO
      </Text>
    </View>
  );
}

/* Interactive Star Breakdown */
function Breakdown({
  rows,
  total,
  activeFilter,
  onFilterChange,
}: {
  rows: Data['breakdown'];
  total: number;
  activeFilter: FilterType;
  onFilterChange: (f: FilterType) => void;
}) {
  const t = useTheme();

  return (
    <View style={{ gap: 8 }}>
      {rows.map((r) => {
        const pct = total ? Math.round((r.count / total) * 100) : 0;
        const filterKey: FilterType = r.stars === 5 ? '5' : r.stars === 4 ? '4' : 'low';
        const isSelected =
          (r.stars === 5 && activeFilter === '5') ||
          (r.stars === 4 && activeFilter === '4') ||
          (r.stars <= 3 && activeFilter === 'low');

        return (
          <Pressable
            key={r.stars}
            onPress={() => onFilterChange(isSelected ? 'all' : filterKey)}
            accessibilityRole="button"
            accessibilityLabel={`${r.stars} stars: ${r.count} reviews (${pct}%). Tap to filter`}
            style={({ pressed, hovered }: any) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 5,
              paddingHorizontal: 8,
              borderRadius: 10,
              backgroundColor: isSelected
                ? t.surface
                : hovered || pressed
                ? 'rgba(20,27,52,0.03)'
                : 'transparent',
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, width: 40 }}>
              <Text
                style={{
                  fontFamily: isSelected ? font.bold : font.semibold,
                  fontSize: 13,
                  color: isSelected ? t.ink : t.body,
                }}
              >
                {r.stars}
              </Text>
              <Ionicons name="star" size={12} color={t.star} />
            </View>

            {/* Progress track */}
            <View
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                backgroundColor: t.surface,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${pct}%`,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: isSelected ? t.accent : r.stars >= 4 ? t.ink : t.muted,
                }}
              />
            </View>

            {/* Count & Percentage */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                width: 68,
                justifyContent: 'flex-end',
              }}
            >
              <Text
                style={mono(13, {
                  color: isSelected ? t.ink : t.body,
                  fontFamily: isSelected ? font.bold : font.mono,
                })}
              >
                {r.count}
              </Text>
              <Text style={mono(12, { color: t.muted, width: 34, textAlign: 'right' })}>
                {pct}%
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Reviews() {
  const t = useTheme();
  const wide = useWindowDimensions().width >= 768;
  const r = useFetch<Data>('/pro/reviews', 60000);

  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('newest');

  const count5 = useMemo(() => r.data?.breakdown.find((x) => x.stars === 5)?.count ?? 0, [r.data]);
  const count4 = useMemo(() => r.data?.breakdown.find((x) => x.stars === 4)?.count ?? 0, [r.data]);
  const countLow = useMemo(
    () =>
      r.data?.breakdown
        .filter((x) => x.stars <= 3)
        .reduce((sum, x) => sum + x.count, 0) ?? 0,
    [r.data]
  );
  const countWithComments = useMemo(
    () => r.data?.items.filter((x) => !!x.text?.trim()).length ?? 0,
    [r.data]
  );

  const satisfactionPct = useMemo(() => {
    if (!r.data || !r.data.count) return 0;
    const positive = count5 + count4;
    return Math.round((positive / r.data.count) * 100);
  }, [r.data, count5, count4]);

  /* Filter and sort list */
  const visibleItems = useMemo(() => {
    if (!r.data?.items) return [];

    let list = [...r.data.items];

    if (filter === '5') {
      list = list.filter((x) => x.rating === 5);
    } else if (filter === '4') {
      list = list.filter((x) => x.rating === 4);
    } else if (filter === 'low') {
      list = list.filter((x) => x.rating <= 3);
    } else if (filter === 'comments') {
      list = list.filter((x) => !!x.text?.trim());
    }

    if (sort === 'highest') {
      list.sort(
        (a, b) =>
          b.rating - a.rating ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sort === 'lowest') {
      list.sort(
        (a, b) =>
          a.rating - b.rating ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else {
      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return list;
  }, [r.data?.items, filter, sort]);

  const activeFilterLabel =
    filter === '5'
      ? '5 Stars'
      : filter === '4'
      ? '4 Stars'
      : filter === 'low'
      ? '3 Stars & below'
      : filter === 'comments'
      ? 'With comments'
      : null;

  return (
    <Screen
      refresh={r.refresh}
      refreshing={r.refreshing}
      header={
        <PageTitle
          title="Reviews"
          sub={
            r.data
              ? r.data.count
                ? `${r.data.count} verified customer rating${r.data.count === 1 ? '' : 's'} · ${r.data.average != null ? r.data.average.toFixed(1) : '—'} overall`
                : 'Customer feedback on completed bookings'
              : 'Loading reviews…'
          }
          right={
            r.data && r.data.average != null ? (
              <TierPill average={r.data.average} count={r.data.count} />
            ) : null
          }
        />
      }
    >
      {!r.data ? (
        <Status error={r.error} loading={!r.error} />
      ) : (
        <>
          {/* Main Unified Rating Overview Card */}
          <Card style={{ padding: 24, gap: 20, borderRadius: R.lg, borderCurve: 'continuous' }}>
            <View
              style={{
                flexDirection: wide ? 'row' : 'column',
                gap: 28,
                alignItems: wide ? 'center' : 'stretch',
              }}
            >
              {/* Score Block */}
              <View
                style={{
                  alignItems: wide ? 'flex-start' : 'center',
                  minWidth: 200,
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text
                    style={mono(58, {
                      color: t.ink,
                      letterSpacing: -2.5,
                      lineHeight: 62,
                      fontFamily: font.heavy,
                    })}
                  >
                    {r.data.average != null ? r.data.average.toFixed(1) : '—'}
                  </Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 20, color: t.muted }}>/ 5.0</Text>
                </View>

                <StarGlyphs value={r.data.average != null ? r.data.average : 0} size={22} />

                {/* Key Metrics Row */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginTop: 6,
                    flexWrap: 'wrap',
                    justifyContent: wide ? 'flex-start' : 'center',
                  }}
                >
                  <View style={{ gap: 1 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 14, color: t.ink }}>
                      {r.data.count}
                    </Text>
                    <Text style={{ ...overline, color: t.muted, fontSize: 10 }}>Total ratings</Text>
                  </View>

                  <View style={{ width: 1, height: 22, backgroundColor: t.line }} />

                  <View style={{ gap: 1 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 14, color: t.ok }}>
                      {satisfactionPct}%
                    </Text>
                    <Text style={{ ...overline, color: t.muted, fontSize: 10 }}>Positive</Text>
                  </View>

                  <View style={{ width: 1, height: 22, backgroundColor: t.line }} />

                  <View style={{ gap: 1 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 14, color: t.accent }}>
                      {countWithComments}
                    </Text>
                    <Text style={{ ...overline, color: t.muted, fontSize: 10 }}>Comments</Text>
                  </View>
                </View>
              </View>

              {/* Vertical / Horizontal Divider */}
              {wide ? (
                <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: t.line }} />
              ) : (
                <View style={{ height: 1, backgroundColor: t.line }} />
              )}

              {/* Interactive Star Breakdown bars */}
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ ...overline, color: t.muted, marginBottom: 8 }}>Rating distribution</Text>
                <Breakdown
                  rows={r.data.breakdown}
                  total={r.data.count}
                  activeFilter={filter}
                  onFilterChange={setFilter}
                />
              </View>
            </View>
          </Card>

          {/* Filter Chips & Sorting Control Toolbar */}
          {r.data.count > 0 && (
            <View style={{ gap: 10, marginTop: 4 }}>
              {/* Filter Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
                style={{ flexGrow: 0 }}
              >
                <Chip
                  title={`All (${r.data.count})`}
                  on={filter === 'all'}
                  onPress={() => setFilter('all')}
                />
                <Chip
                  title={`5 ★ (${count5})`}
                  on={filter === '5'}
                  onPress={() => setFilter('5')}
                />
                <Chip
                  title={`4 ★ (${count4})`}
                  on={filter === '4'}
                  onPress={() => setFilter('4')}
                />
                {countLow > 0 && (
                  <Chip
                    title={`3★ & under (${countLow})`}
                    on={filter === 'low'}
                    onPress={() => setFilter('low')}
                  />
                )}
                {countWithComments > 0 && (
                  <Chip
                    title={`With comments (${countWithComments})`}
                    on={filter === 'comments'}
                    onPress={() => setFilter('comments')}
                  />
                )}
              </ScrollView>

              {/* Sub-bar: Result Count & Segmented Sort */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 4,
                  paddingTop: 2,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: font.medium, fontSize: 13, color: t.muted }}>
                    Showing {visibleItems.length} of {r.data.count} review{r.data.count === 1 ? '' : 's'}
                    {activeFilterLabel ? ` · ${activeFilterLabel}` : ''}
                  </Text>
                  {filter !== 'all' && (
                    <Pressable
                      onPress={() => setFilter('all')}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Clear filter"
                    >
                      <Text style={{ fontFamily: font.semibold, fontSize: 12, color: t.accent }}>
                        Clear
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Sort Toggle */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: t.card,
                    borderRadius: R.pill,
                    padding: 3,
                  }}
                >
                  {(['newest', 'highest', 'lowest'] as SortType[]).map((st) => (
                    <Pressable
                      key={st}
                      onPress={() => setSort(st)}
                      accessibilityRole="button"
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: R.pill,
                        backgroundColor: sort === st ? '#FFFFFF' : 'transparent',
                        shadowColor: '#141B34',
                        shadowOpacity: sort === st ? 0.08 : 0,
                        shadowRadius: 4,
                        shadowOffset: { width: 0, height: 1 },
                        elevation: sort === st ? 1 : 0,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: sort === st ? font.bold : font.medium,
                          fontSize: 12,
                          color: sort === st ? t.ink : t.muted,
                          textTransform: 'capitalize',
                        }}
                      >
                        {st}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Reviews List */}
          {r.data.items.length === 0 ? (
            <Card style={{ padding: 36, alignItems: 'center', gap: 14, marginVertical: 8, borderRadius: R.lg, borderCurve: 'continuous' }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: t.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="star-outline" size={28} color={t.muted} />
              </View>
              <Text style={{ color: t.ink, fontFamily: font.bold, fontSize: 18, textAlign: 'center' }}>
                No customer reviews yet
              </Text>
              <Text
                style={{
                  color: t.muted,
                  fontFamily: font.regular,
                  fontSize: 14,
                  lineHeight: 22,
                  textAlign: 'center',
                  maxWidth: 380,
                }}
              >
                Customer ratings and written feedback will automatically appear here once customers complete
                bookings with you.
              </Text>
            </Card>
          ) : visibleItems.length === 0 ? (
            <Card style={{ padding: 32, alignItems: 'center', gap: 12, marginVertical: 8, borderRadius: R.lg, borderCurve: 'continuous' }}>
              <Ionicons name="funnel-outline" size={30} color={t.muted} />
              <Text style={{ color: t.ink, fontFamily: font.bold, fontSize: 16 }}>
                No reviews match this filter
              </Text>
              <Text style={{ color: t.muted, fontFamily: font.regular, fontSize: 13, textAlign: 'center' }}>
                Try selecting "All" or a different star rating above.
              </Text>
              <Pressable
                onPress={() => setFilter('all')}
                style={{
                  marginTop: 8,
                  height: 40,
                  paddingHorizontal: 18,
                  borderRadius: R.pill,
                  backgroundColor: t.ink,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontFamily: font.semibold, fontSize: 13 }}>
                  Show all reviews
                </Text>
              </Pressable>
            </Card>
          ) : (
            visibleItems.map((x) => (
              <Card
                key={x.id}
                style={{
                  padding: 20,
                  gap: 14,
                  borderRadius: R.lg,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: 'rgba(20,27,52,0.06)',
                }}
              >
                {/* Header: Customer, verified badge, rating pill */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }}>
                    <Avatar name={x.customer} size={44} />
                    <View style={{ gap: 3, flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Txt bold size={16} style={{ fontFamily: font.semibold }}>
                          {x.customer}
                        </Txt>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: t.okBg,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: R.pill,
                          }}
                        >
                          <Ionicons name="shield-checkmark" size={11} color={t.ok} />
                          <Text
                            style={{
                              fontFamily: font.semibold,
                              fontSize: 10.5,
                              color: t.ok,
                              letterSpacing: 0.2,
                            }}
                          >
                            Verified customer
                          </Text>
                        </View>
                      </View>

                      {/* Service tag & Relative date */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {x.service ? (
                          <View
                            style={{
                              backgroundColor: t.surface,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: R.pill,
                            }}
                          >
                            <Text style={{ fontFamily: font.medium, fontSize: 11.5, color: t.body }}>
                              {x.service}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={mono(12, { color: t.muted })}>
                          {formatRelativeTime(x.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Rating Pill */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      backgroundColor: 'rgba(245,158,11,0.12)',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: R.pill,
                    }}
                  >
                    <Ionicons name="star" size={13} color="#D97706" />
                    <Text style={{ fontFamily: font.bold, fontSize: 13, color: '#B45309' }}>
                      {x.rating.toFixed(1)}
                    </Text>
                  </View>
                </View>

                {/* Comment Body */}
                {x.text ? (
                  <Text
                    style={{
                      fontFamily: font.regular,
                      fontSize: 15,
                      lineHeight: 23,
                      color: t.ink,
                      marginTop: 2,
                    }}
                  >
                    {x.text}
                  </Text>
                ) : (
                  <Text
                    style={{
                      fontFamily: font.regular,
                      fontSize: 13,
                      fontStyle: 'italic',
                      color: t.muted,
                    }}
                  >
                    Rated {x.rating} stars without written comments.
                  </Text>
                )}

                {/* Quality Sentiment footer tag */}
                {x.rating === 5 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: t.line,
                    }}
                  >
                    <Ionicons name="sparkles" size={13} color="#D97706" />
                    <Text
                      style={{
                        fontFamily: font.semibold,
                        fontSize: 11,
                        color: t.muted,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                      }}
                    >
                      5-Star experience
                    </Text>
                  </View>
                )}

                <ReplyBox review={x} onDone={r.reload} />
              </Card>
            ))
          )}

          {/* Authenticity Guarantee Card */}
          {r.data.count > 0 && (
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 18,
                backgroundColor: t.card,
                borderRadius: R.md,
                marginTop: 6,
                borderCurve: 'continuous',
              }}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={t.muted} />
              <Text
                style={{
                  flex: 1,
                  fontFamily: font.regular,
                  fontSize: 12,
                  lineHeight: 18,
                  color: t.muted,
                }}
              >
                All ratings are authenticated by Fixzy. Only customers who completed a booking with
                you can submit feedback.
              </Text>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
