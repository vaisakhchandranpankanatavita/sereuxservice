import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, restore, signIn, signOut } from './api';

export type User = { id: string; name: string; email: string; phone: string; role: string };
type Ctx = {
  user: User | null | undefined; // undefined = still restoring
  login: (e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string;
};
const C = createContext<Ctx>(null as any);
export const useSession = () => useContext(C);

/* Only PROVIDER accounts may use this app — a customer or admin login is rejected and signed back out. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    restore().then((u) => setUser(u && u.role === 'PROVIDER' ? u : null), () => setUser(null));
  }, []);
  const login = useCallback(async (e: string, p: string) => {
    setError('');
    const u = await signIn(e.trim().toLowerCase(), p);
    if (u.role !== 'PROVIDER') {
      await signOut();
      setError('This account is not set up as a service pro. Contact support to get linked.');
      throw new Error('not a provider');
    }
    setUser(u);
  }, []);
  const logout = useCallback(async () => { await signOut(); setUser(null); }, []);
  const v = useMemo(() => ({ user, login, logout, error }), [user, login, logout, error]);
  return <C.Provider value={v}>{children}</C.Provider>;
}

export type Pro = { id: number; name: string; years: number; verified: boolean; response: string; bio: string; online: boolean; lat: number | null; lng: number | null; done: number; earned: number; rating: number | null };
export const fetchMe = () => api('/pro/me') as Promise<Pro>;
