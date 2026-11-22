import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Application } from './types';
import { useI18n } from './i18n';
import { PreferencesProvider } from './lib/prefs';
import { parseRoute, useRoute } from './lib/router';
import { StoreProvider, useStore } from './lib/store';
import { ToastProvider } from './components/Toast';
import { ApplicationForm } from './components/ApplicationForm';
import { Layout } from './components/Layout';
import { BrandMark } from './components/BrandMark';
import { Dashboard } from './pages/Dashboard';
import { Applications } from './pages/Applications';
import { ApplicationDetail } from './pages/ApplicationDetail';
import { CalendarPage } from './pages/CalendarPage';
import { Settings } from './pages/Settings';
import { Auth } from './pages/Auth';

function Splash() {
  return (
    <div className="splash">
      <div className="splash__inner">
        <BrandMark size={52} />
        <span className="spinner" aria-hidden="true" />
      </div>
    </div>
  );
}

function Shell() {
  const { t } = useI18n();
  const store = useStore();
  const route = parseRoute(useRoute());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (application: Application) => {
    setEditing(application);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  if (store.booting) return <Splash />;
  if (store.cloudEnabled && !store.user) return <Auth />;

  return (
    <>
      <Layout onAdd={openAdd}>
        {store.loadError ? (
          <div className="banner banner--error" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{t('toast.error')}</span>
          </div>
        ) : null}

        {route.section === 'dashboard' ? <Dashboard onAdd={openAdd} /> : null}
        {route.section === 'applications' ? <Applications onAdd={openAdd} /> : null}
        {route.section === 'application' && route.id ? (
          <ApplicationDetail id={route.id} onEdit={openEdit} />
        ) : null}
        {route.section === 'application' && !route.id ? <Applications onAdd={openAdd} /> : null}
        {route.section === 'calendar' ? <CalendarPage /> : null}
        {route.section === 'settings' ? <Settings /> : null}
      </Layout>

      <ApplicationForm open={formOpen} application={editing} onClose={closeForm} />
    </>
  );
}

export default function App() {
  return (
    <PreferencesProvider>
      <ToastProvider>
        <StoreProvider>
          <Shell />
        </StoreProvider>
      </ToastProvider>
    </PreferencesProvider>
  );
}
