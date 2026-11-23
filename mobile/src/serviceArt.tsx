import { useState } from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API } from './api';
import { useTheme } from './ui';

/* Service art comes from the host (uploaded in the admin app). A service without one, or an image that fails to load, gets a plain placeholder. */
export function ServiceArt({ name, service }: { name: string; service?: { id: number; imageVersion?: number } | null }) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = service?.imageVersion && !failed ? `${API}/services/${service.id}/image?v=${service.imageVersion}` : null;
  if (!uri) {
    return <View accessibilityLabel={name} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: t.card }}>
      <Ionicons name="construct-outline" size={28} color={t.muted} />
    </View>;
  }
  return <Image source={{ uri }} onError={() => setFailed(true)} resizeMode="cover" accessibilityLabel={`${name} illustration`} style={{ width: '100%', height: '100%' }} />;
}
