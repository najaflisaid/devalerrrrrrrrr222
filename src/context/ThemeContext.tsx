import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSiteTheme, setSiteTheme, SiteTheme } from '../services/contentService';

interface ThemeContextValue {
  theme: SiteTheme;
  setTheme: (t: SiteTheme) => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: async () => {},
  loading: true,
});

const LS_KEY = 'dv_site_theme_cache';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize synchronously from localStorage to avoid flash
  const initial: SiteTheme = (typeof window !== 'undefined'
    ? ((localStorage.getItem(LS_KEY) as SiteTheme) || 'light')
    : 'light');
  const [theme, setThemeState] = useState<SiteTheme>(initial);
  const [loading, setLoading] = useState(true);

  // Apply class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(LS_KEY, theme);
    } catch { /* ignore */ }
  }, [theme]);

  // Fetch canonical theme from Firestore on mount
  useEffect(() => {
    (async () => {
      try {
        const t = await getSiteTheme();
        setThemeState(t);
      } catch (err) {
        console.error('Theme load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setTheme = useCallback(async (t: SiteTheme) => {
    setThemeState(t);
    try {
      await setSiteTheme(t);
    } catch (err) {
      console.error('Theme save error:', err);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
