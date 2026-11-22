import { useRef, useState, type ChangeEvent } from 'react';
import { Cloud, Database, Download, HardDrive, LogIn, LogOut, Upload } from 'lucide-react';
import { useI18n } from '../i18n';
import { usePreferences } from '../lib/prefs';
import { isOfflineError, useStore } from '../lib/store';
import { buildBackupJson, buildCsv, downloadFile, parseBackup, type ImportedApplication } from '../lib/backup';
import { todayISO } from '../lib/dates';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/Layout';
import { useToast } from '../components/Toast';

export function Settings() {
  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme, followUpDays, setFollowUpDays } = usePreferences();
  const store = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ImportedApplication[] | null>(null);
  const [busy, setBusy] = useState(false);

  const exportJson = () => {
    downloadFile(`careertrack-backup-${todayISO()}.json`, buildBackupJson(store.applications), 'application/json');
    toast.show(t('toast.exported'));
  };

  const exportCsv = () => {
    const headers = [
      t('form.company'),
      t('form.position'),
      t('form.status'),
      t('form.schedule'),
      t('form.appliedOn'),
      t('form.interviewDate'),
      t('form.salary'),
      t('form.jobUrl'),
      t('form.companyWebsite'),
      t('form.contactName'),
      t('form.contactEmail'),
      t('form.notes'),
      t('detail.followUp'),
    ];
    const csv = `\uFEFF${buildCsv(store.applications, headers)}`;
    downloadFile(`careertrack-${todayISO()}.csv`, csv, 'text/csv');
    toast.show(t('toast.exported'));
  };

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseBackup(text);
      setPending(parsed);
    } catch {
      toast.show(t('settings.importInvalid'), 'error');
    }
  };

  const runImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const count = await store.replaceAll(pending);
      toast.show(t('settings.imported', { n: count }));
      setPending(null);
    } catch (error) {
      if (isOfflineError(error)) toast.show(t('toast.offlineCloud'), 'error');
      else toast.show(error instanceof Error ? error.message : t('toast.error'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await store.signOut();
  };

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div className="settings-grid">
        <section className="panel">
          <div className="panel__header">
            <h2 className="panel__title">{t('settings.appearance')}</h2>
          </div>

          <div className="setting-row">
            <div>
              <p className="setting-row__label">{t('settings.language')}</p>
              <p className="muted small">{t('settings.languageHint')}</p>
            </div>
            <div className="segmented" role="group" aria-label={t('settings.language')}>
              <button
                type="button"
                className={language === 'sq' ? 'is-active' : ''}
                onClick={() => setLanguage('sq')}
                aria-pressed={language === 'sq'}
              >
                Shqip
              </button>
              <button
                type="button"
                className={language === 'en' ? 'is-active' : ''}
                onClick={() => setLanguage('en')}
                aria-pressed={language === 'en'}
              >
                English
              </button>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <p className="setting-row__label">{t('settings.theme')}</p>
              <p className="muted small">{t('settings.themeHint')}</p>
            </div>
            <div className="segmented" role="group" aria-label={t('settings.theme')}>
              <button
                type="button"
                className={theme === 'dark' ? 'is-active' : ''}
                onClick={() => setTheme('dark')}
                aria-pressed={theme === 'dark'}
              >
                {t('settings.dark')}
              </button>
              <button
                type="button"
                className={theme === 'light' ? 'is-active' : ''}
                onClick={() => setTheme('light')}
                aria-pressed={theme === 'light'}
              >
                {t('settings.light')}
              </button>
              <button
                type="button"
                className={theme === 'system' ? 'is-active' : ''}
                onClick={() => setTheme('system')}
                aria-pressed={theme === 'system'}
              >
                {t('settings.system')}
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2 className="panel__title">{t('settings.preferences')}</h2>
          </div>

          <div className="setting-row">
            <div>
              <p className="setting-row__label">{t('settings.followUpInterval')}</p>
              <p className="muted small">{t('settings.followUpHint')}</p>
            </div>
            <label className="inline-select">
              <span className="visually-hidden">{t('settings.followUpInterval')}</span>
              <input
                className="input input--compact input--number"
                type="number"
                min={1}
                max={90}
                value={followUpDays}
                onChange={(event) => setFollowUpDays(Number(event.target.value))}
              />
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2 className="panel__title">
              <Database size={16} aria-hidden="true" />
              {t('settings.data')}
            </h2>
          </div>
          <p className="muted small">{t('settings.backupNote')}</p>

          <div className="button-row">
            <button type="button" className="button button--soft" onClick={exportJson} disabled={store.applications.length === 0}>
              <Download size={16} aria-hidden="true" />
              {t('settings.exportJson')}
            </button>
            <button type="button" className="button button--ghost" onClick={exportCsv} disabled={store.applications.length === 0}>
              <Download size={16} aria-hidden="true" />
              {t('settings.exportCsv')}
            </button>
            <button type="button" className="button button--ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={16} aria-hidden="true" />
              {t('settings.importJson')}
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFileSelected} />
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2 className="panel__title">
              {store.mode === 'cloud' ? <Cloud size={16} aria-hidden="true" /> : <HardDrive size={16} aria-hidden="true" />}
              {t('settings.cloud')}
            </h2>
            <span className={store.mode === 'cloud' ? 'chip chip--ok' : 'chip chip--warn'}>
              {store.mode === 'cloud' ? t('settings.connected') : t('settings.notConnected')}
            </span>
          </div>
          {store.mode === 'cloud' ? (
            <p className="muted small">{t('settings.storageCloud')}</p>
          ) : store.cloudEnabled ? (
            <>
              <p className="setting-row__label">{t('settings.signedOutTitle')}</p>
              <p className="muted small">{t('settings.signedOutBody')}</p>
              <button type="button" className="button button--soft" onClick={() => store.signIn('/settings')}>
                <LogIn size={16} aria-hidden="true" />
                {t('auth.freebuff')}
              </button>
            </>
          ) : (
            <>
              <p className="setting-row__label">{t('settings.localModeTitle')}</p>
              <p className="muted small">{t('settings.localModeBody')}</p>
            </>
          )}
        </section>

        {store.mode === 'cloud' && store.user ? (
          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">{t('settings.account')}</h2>
            </div>
            <div className="setting-row">
              <div>
                <p className="setting-row__label">{t('settings.signedInAs')}</p>
                <p className="muted small">{store.user.name ?? store.user.email ?? store.user.sub}</p>
                {store.user.name && store.user.email ? <p className="muted small">{store.user.email}</p> : null}
              </div>
              <button type="button" className="button button--ghost" onClick={() => void signOut()}>
                <LogOut size={16} aria-hidden="true" />
                {t('auth.signOut')}
              </button>
            </div>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        title={t('settings.importConfirmTitle')}
        body={t('settings.importConfirmBody', { n: store.applications.length, m: pending?.length ?? 0 })}
        confirmLabel={t('confirm.yes')}
        onCancel={() => setPending(null)}
        onConfirm={() => void runImport()}
        danger
        busy={busy}
      />
    </>
  );
}
