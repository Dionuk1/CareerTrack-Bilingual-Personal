import { useEffect, useState, type ReactNode } from 'react';
import {
  Briefcase,
  CalendarDays,
  Cloud,
  HardDrive,
  Languages,
  LayoutDashboard,
  Moon,
  Plus,
  Settings as SettingsIcon,
  Sun,
  WifiOff,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { usePreferences } from '../lib/prefs';
import { navigate, parseRoute, useRoute } from '../lib/router';
import { useStore } from '../lib/store';
import { BrandMark } from './BrandMark';

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children ? <div className="page-header__actions">{children}</div> : null}
    </header>
  );
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function Layout({ children, onAdd }: { children: ReactNode; onAdd: () => void }) {
  const { t, language, setLanguage } = useI18n();
  const { resolvedTheme, setTheme } = usePreferences();
  const { mode } = useStore();
  const route = parseRoute(useRoute());
  const online = useOnline();

  const items = [
    { key: 'dashboard', href: '/', label: t('nav.dashboard'), short: t('nav.dashboard'), icon: LayoutDashboard },
    {
      key: 'applications',
      href: '/applications',
      label: t('nav.applications'),
      short: t('nav.applicationsShort'),
      icon: Briefcase,
    },
    { key: 'calendar', href: '/calendar', label: t('nav.calendar'), short: t('nav.calendar'), icon: CalendarDays },
    { key: 'settings', href: '/settings', label: t('nav.settings'), short: t('nav.settings'), icon: SettingsIcon },
  ] as const;

  const isActive = (key: string) =>
    key === route.section || (key === 'applications' && route.section === 'application');

  const toggleLanguage = () => setLanguage(language === 'sq' ? 'en' : 'sq');
  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button type="button" className="brand" onClick={() => navigate('/')}>
          <BrandMark size={34} />
          <span className="brand__text">
            <span className="brand__name">CareerTrack</span>
            <span className="brand__tagline">{t('common.tagline')}</span>
          </span>
        </button>

        <nav className="sidebar__nav" aria-label={t('nav.dashboard')}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-link${isActive(item.key) ? ' nav-link--active' : ''}`}
                onClick={() => navigate(item.href)}
                aria-current={isActive(item.key) ? 'page' : undefined}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar__spacer" />

        <div className="mode-card">
          {mode === 'cloud' ? <Cloud size={16} aria-hidden="true" /> : <HardDrive size={16} aria-hidden="true" />}
          <div>
            <strong>{mode === 'cloud' ? t('settings.cloud') : t('settings.localModeTitle')}</strong>
            <span>{mode === 'cloud' ? t('settings.connected') : t('settings.notConnected')}</span>
          </div>
        </div>

        <div className="sidebar__tools">
          <button type="button" className="icon-button icon-button--soft" onClick={toggleTheme} aria-label={t('settings.theme')}>
            {resolvedTheme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="lang-toggle"
            onClick={toggleLanguage}
            aria-label={t('settings.language')}
          >
            <Languages size={16} aria-hidden="true" />
            <span>{language === 'sq' ? 'SQ' : 'EN'}</span>
          </button>
        </div>
      </aside>

      <div className="mobile-header">
        <button type="button" className="brand brand--compact" onClick={() => navigate('/')}>
          <BrandMark size={28} />
          <span className="brand__name">CareerTrack</span>
        </button>
        <div className="mobile-header__tools">
          <button type="button" className="icon-button icon-button--soft" onClick={toggleTheme} aria-label={t('settings.theme')}>
            {resolvedTheme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          <button type="button" className="lang-toggle" onClick={toggleLanguage} aria-label={t('settings.language')}>
            <span>{language === 'sq' ? 'SQ' : 'EN'}</span>
          </button>
        </div>
      </div>

      <main className="main">
        {!online ? (
          <div className="offline-banner" role="status">
            <WifiOff size={16} aria-hidden="true" />
            <span>{mode === 'cloud' ? t('offline.body') : t('offline.localBody')}</span>
          </div>
        ) : null}
        <div className="content">{children}</div>
      </main>

      <nav className="bottom-nav" aria-label={t('nav.dashboard')}>
        {items.slice(0, 2).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={`bottom-nav__item${isActive(item.key) ? ' bottom-nav__item--active' : ''}`}
              onClick={() => navigate(item.href)}
            >
              <Icon size={21} aria-hidden="true" />
              <span>{item.short}</span>
            </button>
          );
        })}

        <div className="bottom-nav__fab-slot">
          <button type="button" className="fab" onClick={onAdd} aria-label={t('nav.add')}>
            <Plus size={24} aria-hidden="true" />
          </button>
        </div>

        {items.slice(2).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={`bottom-nav__item${isActive(item.key) ? ' bottom-nav__item--active' : ''}`}
              onClick={() => navigate(item.href)}
            >
              <Icon size={21} aria-hidden="true" />
              <span>{item.short}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
