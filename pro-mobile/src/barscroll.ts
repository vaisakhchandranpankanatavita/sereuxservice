import { Animated, Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

/* Scroll-aware bottom bar: 0 = shown, 1 = hidden. Scrolling down tucks it away, scrolling up (or reaching the top) brings it back. */
export const barHide = new Animated.Value(0);
let hidden = false;
let last = 0;
const DELTA = 8; /* ignore jitter */
const TOP = 24; /* always visible near the top */

function set(h: boolean) {
  if (h === hidden) return;
  hidden = h;
  Animated.timing(barHide, { toValue: h ? 1 : 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
}

export const showBar = () => { last = 0; set(false); };

export function onBarScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
  const y = Math.max(0, contentOffset.y);
  const atBottom = y + layoutMeasurement.height >= contentSize.height - 24;
  const dy = y - last;
  if (y <= TOP || atBottom) set(false); /* rubber-banding past the end must not flip it */
  else if (dy > DELTA) set(true);
  else if (dy < -DELTA) set(false);
  if (Math.abs(dy) > DELTA || y <= TOP) last = y;
}
