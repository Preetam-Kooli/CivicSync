import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeContext } from './useTheme.js';

const KEY = 'civicsync_theme';
const readPref = () => {
  try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; }
};

// theme = what the person chose ('light' | 'dark' | 'system'); dark = what is actually shown
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readPref);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const dark = theme === 'dark' || (theme === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  const setTheme = useCallback((value) => {
    setThemeState(value);
    try { localStorage.setItem(KEY, value); } catch { /* storage unavailable */ }
  }, []);

  const value = useMemo(() => ({ theme, dark, setTheme }), [theme, dark, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}