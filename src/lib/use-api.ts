'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, get } from './api';

export interface ApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * GET + нормализация. На 401 уводит на /login.
 * `map` должен быть стабильной функцией (импорт из normalize.ts).
 */
export function useApi<T>(path: string | null, map: (raw: unknown) => T): ApiState<T> {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(path !== null);
  const [nonce, setNonce] = useState(0);
  const mapRef = useRef(map);
  mapRef.current = map;
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    setError(null);
    get(path)
      .then((raw) => {
        if (alive) setData(mapRef.current(raw));
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const err = e instanceof ApiError ? e : new ApiError(0, 'Неизвестная ошибка', null);
        if (err.status === 401) {
          routerRef.current.replace('/login');
          return;
        }
        setError(err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload, setData };
}
