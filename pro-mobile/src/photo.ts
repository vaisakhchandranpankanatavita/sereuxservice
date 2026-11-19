import * as ImagePicker from 'expo-image-picker';

/* Take a photo (camera if allowed, otherwise the gallery) and return it as a compressed data URL, or null if cancelled. */
export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  const opts = { quality: 0.4, base64: true, mediaTypes: ['images' as const] };
  const r = perm.granted ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.[0]?.base64) return null;
  const a = r.assets[0];
  const mime = a.mimeType === 'image/png' || a.mimeType === 'image/webp' ? a.mimeType : 'image/jpeg';
  return `data:${mime};base64,${a.base64}`;
}
