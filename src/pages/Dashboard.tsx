import { useMemo } from 'react';
import {
  AlarmClock,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Hourglass,
  Layers3,
  Plus,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useI18n, localeOf } from '../i18n';
import { usePreferences } from '../lib/prefs';
import { useStore } from '../lib/store';
import { formatDate, formatTime, monthShort } from '../lib/dates';
import {
  dashboardStats,
  daysSinceApplied,
  latestActivity,
  needsFollowUp,
  upcomingInterviews,
} from '../lib/format';
import { navigate } from '../lib/router';
import type { Application, Interview } from '../types';
import { ApplicationCard } from '../components/ApplicationCard';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/Layout';

interface EventEntry {
  application: Application;
  interview: Interview;
}

export function Dashboard({ onAdd }: { onAdd: () => void }) {
  const { t, tn, language } = useI18n();
  const { followUpDays } = usePreferences();
  const { applications, loading } = useStore();
  const locale = localeOf[language];

  const stats = useMemo(() => dashboardStats(applications), [applications]);

  const upcoming = useMemo<EventEntry[]>(() => {
    const entries: EventEntry[] = [];
    for (const application of applications) {
      for (const interview of upcomingInterviews(application)) {
        entries.push({ application, interview });
      }
    }
    return entries
      .sort((a, b) => new Date(a.interview.scheduledAt).getTime() - new Date(b.interview.scheduledAt).getTime())
      .slice(0, 5);
  }, [applications]);

  const followUps = useMemo(
    () =>
      applications
        .filter((application) => needsFollowUp(application, followUpDays))
        .sort((a, b) => daysSinceApplied(b) - daysSinceApplied(a))
        .slice(0, 5),
    [applications, followUpDays]
  );

  const recent = useMemo(
    () =>
      [...applications]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3),
    [applications]
  );

  const activity = useMemo(() => latestActivity(applications, 5), [applications]);

  const cards = [
    { key: 'total', label: t('dashboard.total'), value: stats.total, icon: Layers3, tone: 'neutral' },
    { key: 'interviews', label: t('dashboard.interviews'), value: stats.interviews, icon: CalendarCheck, tone: 'accent' },
    { key: 'waiting', label: t('dashboard.waiting'), value: stats.waiting, icon: Hourglass, tone: 'wait' },
    { key: 'accepted', label: t('dashboard.accepted'), value: stats.accepted, icon: CheckCircle2, tone: 'ok' },
    { key: 'rejected', label: t('dashboard.rejected'), value: stats.rejected, icon: XCircle, tone: 'bad' },
  ];

  return (
    <>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}>
        <button type="button" className="button button--primary" onClick={onAdd}>
          <Plus size={17} aria-hidden="true" />
          {t('applications.add')}
        </button>
      </PageHeader>

      <section className="stat-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.key} className={`stat stat--${card.tone}`}>
              <span className="stat__icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="stat__value">{card.value}</span>
              <span className="stat__label">{card.label}</span>
            </article>
          );
        })}
      </section>

      {applications.length === 0 && !loading ? (
        <div className="panel panel--spaced">
          <EmptyState
            icon={<Sparkles size={22} />}
            title={t('applications.emptyAll')}
            body={t('applications.emptyAllBody')}
            action={
              <button type="button" className="button button--primary" onClick={onAdd}>
                <Plus size={17} aria-hidden="true" />
                {t('dashboard.quickAdd')}
              </button>
            }
          />
        </div>
      ) : (
        <div className="dash-grid">
          <div className="dash-column">
            <section className="panel">
              <div className="panel__header">
                <h2 className="panel__title">{t('dashboard.upcoming')}</h2>
                <button type="button" className="text-button" onClick={() => navigate('/calendar')}>
                  {t('common.viewAll')}
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
              {upcoming.length === 0 ? (
                <p className="muted small">{t('dashboard.noUpcoming')}</p>
              ) : (
                <div className="event-list">
                  {upcoming.map(({ application, interview }) => (
                    <button
                      key={interview.id}
                      type="button"
                      className="event"
                      onClick={() => navigate(`/applications/${application.id}`)}
                    >
                      <span className="event__date">
                        <strong>{new Date(interview.scheduledAt).getDate()}</strong>
                        {monthShort(interview.scheduledAt, locale)}
                      </span>
                      <span className="event__body">
                        <span className="event__title">{application.company}</span>
                        <span className="event__meta">
                          {application.position}
                          {interview.round ? ` · ${interview.round}` : ''} · {formatTime(interview.scheduledAt, locale)}
                        </span>
                      </span>
                      <ChevronRight size={16} className="event__chevron" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel__header">
                <h2 className="panel__title">{t('dashboard.recent')}</h2>
                <button type="button" className="text-button" onClick={() => navigate('/applications')}>
                  {t('common.viewAll')}
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
              {recent.length === 0 ? (
                <p className="muted small">{t('dashboard.noRecent')}</p>
              ) : (
                <div className="apps-grid apps-grid--compact">
                  {recent.map((application) => (
                    <ApplicationCard key={application.id} application={application} followUpDays={followUpDays} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="dash-column">
            <section className="panel">
              <div className="panel__header">
                <h2 className="panel__title">
                  <AlarmClock size={16} aria-hidden="true" />
                  {t('dashboard.followUp')}
                </h2>
              </div>
              {followUps.length === 0 ? (
                <div>
                  <p className="muted small">{t('dashboard.noFollowUp')}</p>
                  <p className="muted small">{t('dashboard.followUpHint', { n: followUpDays })}</p>
                </div>
              ) : (
                <div className="event-list">
                  {followUps.map((application) => (
                    <button
                      key={application.id}
                      type="button"
                      className="event event--plain"
                      onClick={() => navigate(`/applications/${application.id}`)}
                    >
                      <span className="event__body">
                        <span className="event__title">{application.company}</span>
                        <span className="event__meta">
                          {application.position} · {tn('time.appliedAgo', daysSinceApplied(application))}
                        </span>
                      </span>
                      <ChevronRight size={16} className="event__chevron" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel__header">
                <h2 className="panel__title">{t('dashboard.activity')}</h2>
              </div>
              {activity.length === 0 ? (
                <p className="muted small">{t('dashboard.noActivity')}</p>
              ) : (
                <ul className="activity">
                  {activity.map((item) => (
                    <li key={item.id} className="activity__item">
                      <span className={`activity__dot activity__dot--${item.kind}`} aria-hidden="true" />
                      <span className="activity__text">
                        <strong>{applicationLabel(item.company, item.position)}</strong>
                        <span>{t(`activity.${item.kind}`)}</span>
                      </span>
                      <time className="activity__time" dateTime={item.at}>
                        {formatDate(item.at.slice(0, 10), locale, false)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel panel--accent">
              <p className="panel__title">{t('dashboard.quickAdd')}</p>
              <p className="muted small">{t('common.tagline')}</p>
              <button type="button" className="button button--primary button--block" onClick={onAdd}>
                <Plus size={17} aria-hidden="true" />
                {t('applications.add')}
              </button>
            </section>
          </div>
        </div>
      )}

    </>
  );
}

function applicationLabel(company: string, position: string): string {
  return `${company} — ${position}`;
}
