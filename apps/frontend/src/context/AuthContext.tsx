import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { authService } from '../services/authService';
import { configureApi, toApiError } from '../services/apiClient';
import type { AuthSession, SessionUser } from '../types/api';
import { STORAGE_KEYS, secureStorage } from '../utils/secureStorage';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  /** true mientras dura un login/logout manual. */
  pending: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Revalida el perfil contra GET /auth/me (p. ej. tras cambiar permisos). */
  refreshUser: () => Promise<void>;
  /** RBAC: ¿posee el usuario el permiso dado? */
  can: (permission: string) => boolean;
  /** RBAC: ¿posee ALGÚNO de los permisos dados? */
  canAny: (permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [pending, setPending] = useState(false);

  // Refs espejo: el adapter de apiClient se registra UNA vez y lee de aquí.
  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);

  useEffect(() => {
    configureApi({
      getAccessToken: () => accessTokenRef.current,
      getRefreshToken: () => refreshTokenRef.current,
      onTokens: (accessToken, refreshToken) => {
        accessTokenRef.current = accessToken;
        refreshTokenRef.current = refreshToken;
        void secureStorage.set(STORAGE_KEYS.accessToken, accessToken);
        void secureStorage.set(STORAGE_KEYS.refreshToken, refreshToken);
      },
      onSessionExpired: () => {
        accessTokenRef.current = null;
        refreshTokenRef.current = null;
        setUser(null);
        setStatus('unauthenticated');
        void secureStorage.remove(STORAGE_KEYS.accessToken);
        void secureStorage.remove(STORAGE_KEYS.refreshToken);
      },
    });
  }, []);

  const applySession = useCallback(async (session: AuthSession) => {
    accessTokenRef.current = session.accessToken;
    refreshTokenRef.current = session.refreshToken;
    await Promise.all([
      secureStorage.set(STORAGE_KEYS.accessToken, session.accessToken),
      secureStorage.set(STORAGE_KEYS.refreshToken, session.refreshToken),
    ]);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(async () => {
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    setUser(null);
    setStatus('unauthenticated');
    await Promise.all([
      secureStorage.remove(STORAGE_KEYS.accessToken),
      secureStorage.remove(STORAGE_KEYS.refreshToken),
    ]);
  }, []);

  // Restauración de sesión al arrancar (tokens guardados → GET /auth/me).
  useEffect(() => {
    let active = true;
    (async () => {
      const [access, refresh] = await Promise.all([
        secureStorage.get(STORAGE_KEYS.accessToken),
        secureStorage.get(STORAGE_KEYS.refreshToken),
      ]);
      if (!active) return;
      if (!access) {
        setStatus('unauthenticated');
        return;
      }
      accessTokenRef.current = access;
      refreshTokenRef.current = refresh;
      try {
        const me = await authService.me();
        if (!active) return;
        setUser(me);
        setStatus('authenticated');
      } catch (err) {
        if (!active) return;
        // 401 definitivo (el refresh falló) → se limpia; otro error (p. ej.
        // red caída) → se cierra sesión pero se conservan los tokens.
        if (toApiError(err).status === 401) await clearSession();
        else setStatus('unauthenticated');
      }
    })();
    return () => {
      active = false;
    };
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setPending(true);
      try {
        const session = await authService.login(email, password);
        await applySession(session);
      } finally {
        setPending(false);
      }
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    setPending(true);
    try {
      const refresh = refreshTokenRef.current;
      // Best-effort: el cierre remoto no debe bloquear el local.
      try {
        await authService.logout(refresh ?? undefined);
      } catch {
        // Se ignora: el token local se invalida en cualquier caso.
      }
      await clearSession();
    } finally {
      setPending(false);
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const me = await authService.me();
    setUser(me);
  }, []);

  const permissions = useMemo(() => {
    const set = new Set(user?.role?.permissions ?? []);
    return set;
  }, [user]);

  const can = useCallback(
    (permission: string) => permissions.has(permission),
    [permissions]
  );

  const canAny = useCallback(
    (list: string[]) => list.some((p) => permissions.has(p)),
    [permissions]
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, pending, login, logout, refreshUser, can, canAny }),
    [status, user, pending, login, logout, refreshUser, can, canAny]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
