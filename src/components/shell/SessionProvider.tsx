'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, get, post } from '@/lib/api';
import { toUser } from '@/lib/normalize';
import type { User } from '@/lib/types';

interface SessionApi {
  user: User;
  isAdmin: boolean;
  isTeacher: boolean;
  /** Локально обновить пользователя (например, после смены аватара) */
  patchUser: (patch: Partial<User>) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionApi | null>(null);

/** Загружает /api/auth/me. Пока грузится — показывает `fallback`, на 401 — уводит на /login. */
export function SessionProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const router = routerRef.current;
    let alive = true;
    get('/api/auth/me')
      .then((raw) => {
        if (!alive) return;
        const u = toUser(raw);
        if (u) setUser(u);
        else router.replace('/login');
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status !== 401 && e.status !== 0) console.error(e);
        router.replace('/login');
      });
    return () => {
      alive = false;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await post('/api/auth/logout');
    } finally {
      router.replace('/login');
    }
  }, [router]);

  const patchUser = useCallback((patch: Partial<User>) => setUser((u) => (u ? { ...u, ...patch } : u)), []);

  if (!user) return <>{fallback}</>;

  return <Ctx.Provider value={{ user, isAdmin: user.role === 'ADMIN', isTeacher: user.role === 'TEACHER', logout, patchUser }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession вне SessionProvider');
  return ctx;
}
