import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './authContext.js';
import { api, setSessionHint, clearSessionHint } from '../lib/api.js';

export function AuthProvider({ children }) {
  // session is { user, portal } when logged in, or null
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, ask the server "who am I?". This keeps you logged in after a reload.
  useEffect(() => {
    let cancelled = false;
    api('GET', '/api/auth/me')
      .then((data) => {
        if (!cancelled) setSession({ user: data.user, portal: data.portal });
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Citizens are signed in immediately. For the admin portal the server
  // answers { step, challengeToken }: not signed in yet, a 2FA step comes next.
  const login = useCallback(async (email, password, portal) => {
    const data = await api('POST', '/api/auth/login', { email, password, portal });
    if (data.step) return data;
    setSessionHint();
    setSession({ user: data.user, portal: data.portal });
    return data;
  }, []);

  // The second step for admins: a correct 6-digit code finishes the login
  const completeTwoFactor = useCallback(async (challengeToken, code) => {
    const data = await api('POST', '/api/auth/2fa/verify', { challengeToken, code });
    setSessionHint();
    setSession({ user: data.user, portal: data.portal });
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('POST', '/api/auth/logout');
    } finally {
      clearSessionHint();
      setSession(null);
    }
  }, []);

  const value = useMemo(
    () => ({ session, loading, login, completeTwoFactor, logout }),
    [session, loading, login, completeTwoFactor, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}