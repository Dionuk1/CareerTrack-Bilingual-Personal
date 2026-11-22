import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  I18nContext,
  translate,
  translateCount,
  type Language,
  type I18nValue,
} from '../i18n';
import { DEFAULT_FOLLOW_UP_DAYS } from '../types';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export interface Preferences {
  language: Language;
  theme: Theme;
  followUpDays: number;
}

interface PreferencesValue extends Preferences {
  resolvedTheme: ResolvedTheme;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  setFollowUpDays: (days: number) => void;
}

const STORAGE_KEY = 'careertrack.preferences.v1';
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';
const PreferencesContext = createContext<PreferencesValue | null>(null);

function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? 'dark' : 'light';
}

function readPreferences(): Preferences {
  const fallback: Preferences = { language: 'sq', theme: 'dark', followUpDays: DEFAULT_FOLLOW_UP_DAYS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      language: parsed.language === 'en' ? 'en' : 'sq',
      theme:
        parsed.theme === 'light' || parsed.theme === 'system' ? parsed.theme : 'dark',
      followUpDays:
        typeof parsed.followUpDays === 'number' && parsed.followUpDays >= 1 && parsed.followUpDays <= 90
          ? Math.round(parsed.followUpDays)
          : DEFAULT_FOLLOW_UP_DAYS,
    };
  } catch {
    return fallback;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readSystemTheme);

  const resolvedTheme: ResolvedTheme = preferences.theme === 'system' ? systemTheme : preferences.theme;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(SYSTEM_THEME_QUERY);
    const update = () => setSystemTheme(media.matches ? 'dark' : 'light');
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore quota or privacy-mode failures.
    }
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.lang = preferences.language;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolvedTheme === 'dark' ? '#101D2B' : '#F4F7F9');
  }, [preferences, resolvedTheme]);

  const i18n = useMemo<I18nValue>(
    () => ({
      language: preferences.language,
      setLanguage: (language: Language) => setPreferences((current) => ({ ...current, language })),
      t: (key, vars) => translate(preferences.language, key, vars),
      tn: (key, count, vars) => translateCount(preferences.language, key, count, vars),
    }),
    [preferences.language]
  );

  const value = useMemo<PreferencesValue>(
    () => ({
      ...preferences,
      resolvedTheme,
      setLanguage: (language) => setPreferences((current) => ({ ...current, language })),
      setTheme: (theme) => setPreferences((current) => ({ ...current, theme })),
      setFollowUpDays: (days) =>
        setPreferences((current) => ({
          ...current,
          followUpDays: Math.min(90, Math.max(1, Math.round(days) || DEFAULT_FOLLOW_UP_DAYS)),
        })),
    }),
    [preferences, resolvedTheme]
  );

  return (
    <PreferencesContext.Provider value={value}>
      <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}
