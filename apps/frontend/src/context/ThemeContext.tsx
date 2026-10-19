import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { THEMES, type AppTheme, type ThemeScheme } from '../theme/palettes';
import { STORAGE_KEYS, secureStorage } from '../utils/secureStorage';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  theme: AppTheme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  /** Alterna entre claro y oscuro (fija la preferencia). */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let active = true;
    secureStorage.get(STORAGE_KEYS.theme).then((stored) => {
      if (!active) return;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    void secureStorage.set(STORAGE_KEYS.theme, pref);
  }, []);

  const scheme: ThemeScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const toggleTheme = useCallback(() => {
    setPreference(scheme === 'dark' ? 'light' : 'dark');
  }, [scheme, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: THEMES[scheme], preference, setPreference, toggleTheme }),
    [scheme, preference, setPreference, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx.theme;
}

export function useThemePreference(): Pick<ThemeContextValue, 'preference' | 'setPreference'> {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemePreference debe usarse dentro de ThemeProvider');
  return { preference: ctx.preference, setPreference: ctx.setPreference };
}
