import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type SavedAddress = { id: string; label: string; name?: string; phone?: string; address: string; city?: string; pin?: string };

const KEY = 'fixzy_addresses';
/* SecureStore has no web implementation; fall back to localStorage there (mirrors api.ts). */
const store = {
  get: async (): Promise<string | null> => (Platform.OS === 'web' ? localStorage.getItem(KEY) : SecureStore.getItemAsync(KEY)),
  set: async (v: string) => { if (Platform.OS === 'web') localStorage.setItem(KEY, v); else await SecureStore.setItemAsync(KEY, v); },
};

/* Addresses are saved on-device only — there's no backend address book yet. */
export function useAddresses() {
  const [list, setList] = useState<SavedAddress[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    store.get().then((raw) => { setList(raw ? JSON.parse(raw) : []); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const persist = useCallback(async (next: SavedAddress[]) => { setList(next); await store.set(JSON.stringify(next)).catch(() => {}); }, []);

  const add = useCallback((a: Omit<SavedAddress, 'id'>) => {
    const entry = { id: `${Date.now()}`, ...a };
    return persist([entry, ...list].slice(0, 10));
  }, [list, persist]);

  const remove = useCallback((id: string) => persist(list.filter((x) => x.id !== id)), [list, persist]);

  return { list, loaded, add, remove };
}
