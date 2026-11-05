import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, restore, signIn, signOut, signUp } from './api';

export type User = { id: string; name: string; email: string; phone: string; role: string };
type Ctx = {
  user: User | null | undefined; // undefined = still restoring
  login: (e: string, p: string) => Promise<void>;
  register: (d: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (d: { name: string; phone: string }) => Promise<void>;
  transitioning: boolean; // true right after sign-in/sign-up, while the cinematic loader plays
  endTransition: () => void;
};
const C = createContext<Ctx>(null as any);
export const useSession = () => useContext(C);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [transitioning, setTransitioning] = useState(false);
  useEffect(() => { restore().then(setUser, () => setUser(null)); }, []);
  const login = useCallback(async (e: string, p: string) => { const u = await signIn(e.trim().toLowerCase(), p); setTransitioning(true); setUser(u); }, []);
  const register = useCallback(async (d: any) => { const u = await signUp({ ...d, email: d.email.trim().toLowerCase() }); setTransitioning(true); setUser(u); }, []);
  const logout = useCallback(async () => { await signOut(); setUser(null); }, []);
  const updateProfile = useCallback(async (d: any) => setUser(await api('/auth/me', 'PATCH', d)), []);
  const endTransition = useCallback(() => setTransitioning(false), []);
  const v = useMemo(() => ({ user, login, register, logout, updateProfile, transitioning, endTransition }), [user, login, register, logout, updateProfile, transitioning, endTransition]);
  return <C.Provider value={v}>{children}</C.Provider>;
}
