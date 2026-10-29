import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, setUnauthorizedHandler, type Me } from './api';

// 로그인 상태. 서버 세션 쿠키가 기준이고, 화면은 /api/auth/me 응답(401이면 로그아웃 상태)으로 판단한다 (R00).
interface AuthValue {
  /** undefined: 확인 중, null: 로그인 안 함 */
  me: Me | null | undefined;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const nav = useNavigate();

  useEffect(() => {
    api.get<Me>('/api/auth/me').then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setMe(null);
      nav('/login', { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [nav]);

  const login = useCallback(async (email: string, password: string) => setMe(await api.post<Me>('/api/auth/login', { email, password })), []);
  const signup = useCallback(async (email: string, password: string) => setMe(await api.post<Me>('/api/auth/signup', { email, password })), []);
  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => {});
    setMe(null);
    nav('/login', { replace: true });
  }, [nav]);

  const value = useMemo(() => ({ me, login, signup, logout }), [me, login, signup, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider 안에서만 사용할 수 있어요');
  return v;
}

/** 로그인해야 볼 수 있는 화면. 로그인 전이면 로그인 화면으로 보내고, 로그인 뒤 원래 화면으로 돌아온다. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const { pathname, search } = useLocation();
  if (me === undefined) return null;
  if (!me) return <Navigate to="/login" replace state={{ from: pathname + search }} />;
  return <>{children}</>;
}
