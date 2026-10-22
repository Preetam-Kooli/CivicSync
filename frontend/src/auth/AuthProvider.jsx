import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './authContext.js';
import { api, setSessionHint, clearSessionHint } from '../lib/api.js';

export function AuthProvider({ children }) {
  // session is { user, portal } when logged in, or null
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // When the app first loads, ask the server "who am I?". This is what keeps
  // you logged in after a page reload.
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

  // The browser's Back/Forward button can restore a FROZEN copy of the page
  // (the "back/forward cache"), including its old login state. When that
  // happens ("pageshow" with persisted = true), hide the page and ask the
  // server again whether we are still logged in.
  useEffect(() => {
    function onPageShow(event) {
      if (!event.persisted) return;
      setLoading(true); // shows the spinner instead of stale content
      api('GET', '/api/auth/me')
        .then((data) => setSession({ user: data.user, portal: data.portal }))
        .catch((err) => {
          // Only a real "not logged in" answer logs us out. A network
          // hiccup (status 0) should not.
          if (err.status === 401) {
            clearSessionHint();
            setSession(null);
          }
        })
        .finally(() => setLoading(false));
    }
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const login = useCallback(async (email, password, portal) => {
    const data = await api('POST', '/api/auth/login', { email, password, portal });
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
    () => ({ session, loading, login, logout }),
    [session, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}