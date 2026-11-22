import { Languages, LogIn, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useI18n } from '../i18n';
import { usePreferences } from '../lib/prefs';
import { BrandMark } from '../components/BrandMark';

export function Auth() {
  const { t, language, setLanguage } = useI18n();
  const { resolvedTheme, setTheme } = usePreferences();

  return (
    <div className="auth">
      <div className="auth__brand">
        <div className="brand">
          <BrandMark size={38} />
          <span className="brand__text">
            <span className="brand__name">CareerTrack</span>
            <span className="brand__tagline">{t('common.tagline')}</span>
          </span>
        </div>
        <div className="auth__pitch">
          <h2>{t('dashboard.subtitle')}</h2>
          <p>{t('auth.subtitle')}</p>
        </div>
        <p className="muted small">{t('settings.storageCloud')}</p>
      </div>

      <div className="auth__panel">
        <div className="auth__tools">
          <button
            type="button"
            className="icon-button icon-button--soft"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label={t('settings.theme')}
          >
            {resolvedTheme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="lang-toggle"
            onClick={() => setLanguage(language === 'sq' ? 'en' : 'sq')}
            aria-label={t('settings.language')}
          >
            <Languages size={16} aria-hidden="true" />
            <span>{language === 'sq' ? 'SQ' : 'EN'}</span>
          </button>
        </div>

        <div className="auth-card">
          <div className="auth-card__mark">
            <BrandMark size={44} />
          </div>
          <h1>{t('auth.title')}</h1>
          <p className="muted">{t('auth.subtitle')}</p>

          <a className="button button--primary button--block" href="/auth/freebuff/signin?returnTo=%2F">
            <LogIn size={17} aria-hidden="true" />
            {t('auth.freebuff')}
          </a>

          <p className="muted small auth-hint">{t('auth.freebuffHint')}</p>

          <p className="auth-note">
            <ShieldCheck size={14} aria-hidden="true" />
            {t('auth.secureNote')}
          </p>
        </div>
      </div>
    </div>
  );
}
