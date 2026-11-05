import { Image } from 'react-native';

/* Category background photos (AI-illustrated, cropped per service) — fill the whole card. */
const PHOTOS: Record<string, any> = {
  plumbing: require('../assets/services/plumbing.png'),
  electrical: require('../assets/services/electrical.png'),
  'ac repair': require('../assets/services/ac-repair.png'),
  carpentry: require('../assets/services/carpentry.png'),
  painting: require('../assets/services/painting.png'),
  cleaning: require('../assets/services/cleaning.png'),
  appliances: require('../assets/services/appliances.png'),
  'pest control': require('../assets/services/pest-control.png'),
};

export function ServiceArt({ name }: { name: string }) {
  const src = PHOTOS[name.trim().toLowerCase()] ?? PHOTOS.cleaning;
  return <Image source={src} resizeMode="cover" accessibilityLabel={`${name} illustration`} style={{ width: '100%', height: '100%' }} />;
}
