import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api, setSessionToken } from '../api/client';
import { connectSocket, disconnectSocket } from '../api/socket';
import type { Guest } from '../types';

const TOKEN_KEY = 'guest-session';

type Status = 'loading' | 'offline' | 'guest-needed' | 'ready';

interface Session {
  status: Status;
  guest: Guest | null;
  retry: () => void;
  start: (name: string, avatar: string) => Promise<void>;
  setGuest: (guest: Guest) => void;
  refresh: () => Promise<void>;
  forget: () => Promise<void>;
}

const Context = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [guest, setGuest] = useState<Guest | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return setStatus('guest-needed');
    setSessionToken(token);
    try {
      const me = await api.me();
      setGuest(me.guest);
      connectSocket(token);
      setStatus('ready');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setSessionToken(null);
        setStatus('guest-needed');
      } else {
        // The identity is still good: this is only the network.
        setStatus('offline');
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = useCallback(async (name: string, avatar: string) => {
    const { token, guest: created } = await api.createGuest(name, avatar);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setSessionToken(token);
    setGuest(created);
    connectSocket(token);
    setStatus('ready');
  }, []);

  const refresh = useCallback(async () => {
    const me = await api.me();
    setGuest(me.guest);
  }, []);

  const forget = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setSessionToken(null);
    disconnectSocket();
    setGuest(null);
    setStatus('guest-needed');
  }, []);

  const value = useMemo(
    () => ({ status, guest, retry: load, start, setGuest, refresh, forget }),
    [status, guest, load, start, refresh, forget],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSession() {
  const session = useContext(Context);
  if (!session) throw new Error('useSession outside SessionProvider');
  return session;
}

/** The signed-in guest, for screens that only exist once there is one. */
export function useGuest() {
  const { guest } = useSession();
  if (!guest) throw new Error('useGuest before a guest exists');
  return guest;
}
