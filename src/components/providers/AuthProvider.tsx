'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, api } from '@/lib/api';
import type { PublicUser } from '@/lib/shared-types';

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  setUser: (user: PublicUser | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const KEEP_ALIVE_INTERVAL_MS = 1000 * 60;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<PublicUser | null>(null);
  const refreshingRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refreshUser = useCallback(async () => {
    if (refreshingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false);
      return;
    }

    refreshingRef.current = true;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await api.me();
        setUser(response.user);
        setLoading(false);
        refreshingRef.current = false;
        return;
      } catch (error) {
        lastError = error;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setUser(null);
          setLoading(false);
          refreshingRef.current = false;
          return;
        }

        if (attempt === 0) {
          await wait(400);
        }
      }
    }

    setLoading(false);
    refreshingRef.current = false;
    console.warn('Unable to refresh authenticated user state.', lastError);
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshUser();
    }, KEEP_ALIVE_INTERVAL_MS);

    const handleFocus = () => {
      void refreshUser();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshUser();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      refreshUser,
      logout
    }),
    [loading, logout, refreshUser, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
