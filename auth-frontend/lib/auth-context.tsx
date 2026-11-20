'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, clearToken, getToken } from './api';
import type { Me } from './api-types';

type AuthContextValue = {
  me: Me | null;
  loading: boolean;
  error: string | null;
  /** Canonical permission keys only; missing data fails closed. */
  has: (permission: string) => boolean;
  refresh: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function fetchMe() {
  return api<Me>('/auth/me');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastRefreshRef = useRef(0);

  // Load the session once on mount. State updates happen in async callbacks,
  // so they do not trigger cascading synchronous renders.
  useEffect(() => {
    let active = true;

    async function initialLoad() {
      if (!getToken()) {
        if (active) {
          setMe(null);
          setLoading(false);
          setError(null);
        }
        return;
      }

      try {
        const data = await fetchMe();
        lastRefreshRef.current = Date.now();
        if (active) {
          setMe(data);
          setError(null);
        }
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          setMe(null);
          setError(null);
        } else if (err instanceof ApiError && err.status === 403) {
          setMe(null);
          setError('Anda tidak memiliki akses');
        } else {
          setMe(null);
          setError(err instanceof Error ? err.message : 'Gagal memuat sesi');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialLoad();
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      setError(null);
      return;
    }
    try {
      const data = await fetchMe();
      lastRefreshRef.current = Date.now();
      setMe(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        setMe(null);
        setError(null);
      } else if (err instanceof ApiError && err.status === 403) {
        setMe(null);
        setError('Anda tidak memiliki akses');
      } else {
        setMe(null);
        setError(err instanceof Error ? err.message : 'Gagal memuat sesi');
      }
    }
  }, []);

  // Throttled refresh when the tab becomes visible again: role/permission
  // changes made elsewhere are picked up without creating a refresh loop.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !getToken()) return;
      if (Date.now() - lastRefreshRef.current < 60_000) return;
      lastRefreshRef.current = Date.now();
      void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refresh]);

  const has = useCallback(
    (permission: string) => {
      const keys = me?.canonicalPermissions;
      if (!Array.isArray(keys)) return false;
      return keys.includes(permission);
    },
    [me],
  );

  const logout = useCallback(() => {
    clearToken();
    setMe(null);
    setError(null);
    router.replace('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ me, loading, error, has, refresh, logout }),
    [me, loading, error, has, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus dipakai di dalam AuthProvider');
  }
  return context;
}
