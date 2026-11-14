import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from './api';

/* Show alerts even while the app is open. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let current: string | null = null;

/* Ask for permission, fetch this device's Expo push token and register it with the API.
   Never throws: push is a nicety, and Expo Go / emulators / missing Firebase config simply skip it. */
export async function registerPush() {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Updates', importance: Notifications.AndroidImportance.HIGH });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    current = data;
    await api('/push-token', 'PUT', { token: data, platform: Platform.OS });
  } catch {
    /* ignore */
  }
}

/* Call before signing out so this device stops receiving the previous user's alerts. */
export async function unregisterPush() {
  const token = current;
  current = null;
  if (token) await api('/push-token', 'DELETE', { token }).catch(() => {});
}

/* Opens the right screen when an alert is tapped. Returns an unsubscribe function. */
export function onNotificationTap(go: (path: string) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener(() => go('/jobs'));
  return () => sub.remove();
}
