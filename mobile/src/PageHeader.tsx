import { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBg, { TONES, Tone } from './HeaderBg';
import { Txt } from './ui';

/* Shared page header: a frosted-glass bar that floats over the page, so content scrolls behind its rounded
   bottom corners. Pair it with <PageSpace /> as the first item of the scrolling content, so content starts below it. */
const glassWeb = Platform.OS === 'web' ? ({ backdropFilter: 'blur(18px) saturate(160%)', WebkitBackdropFilter: 'blur(18px) saturate(160%)' } as any) : null;

export default function PageHeader({ eyebrow, title, right, left, tone = 'home' }: { eyebrow: string; title: string; right?: ReactNode; left?: ReactNode; tone?: Tone }) {
  const top = useSafeAreaInsets().top;
  return <View style={[{
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: TONES[tone].base + '8C', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
    borderBottomLeftRadius: 44, borderBottomRightRadius: 44, overflow: 'hidden',
    paddingTop: Math.max(top, 14) + 18, paddingHorizontal: 20, paddingBottom: 34, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 5,
  }, glassWeb]}>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 0.9 }]}><HeaderBg tone={tone} /></View>
    {/* soft fade into the page, like the floating bottom bar's glassy edge */}
    <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.8)']} locations={[0, 0.65, 1]} start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
    {left}
    <View style={{ flex: 1, gap: 2 }} accessible accessibilityRole="header" accessibilityLabel={`${eyebrow.toLowerCase()} ${title}`}>
      <Txt size={11} bold color="rgba(35,35,35,0.6)" style={{ letterSpacing: 1.6 }} numberOfLines={1}>{eyebrow}</Txt>
      <Txt bold size={28} numberOfLines={1}>{title}</Txt>
    </View>
    {right}
  </View>;
}

/* Empty space the height of the floating header: first item in each page's scrolling content. */
export function PageSpace() {
  const top = useSafeAreaInsets().top;
  return <View style={{ height: Math.max(top, 14) + 18 + 52 + 34 }} />;
}
