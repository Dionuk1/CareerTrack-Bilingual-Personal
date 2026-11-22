import { useMemo, useState } from 'react';
import { Plus, Search, SlidersHorizontal, X, Briefcase } from 'lucide-react';
import { useI18n } from '../i18n';
import { usePreferences } from '../lib/prefs';
import { useStore } from '../lib/store';
import { SCHEDULES, STATUSES, type Schedule, type Status } from '../types';
import { upcomingInterviews, sortByAppliedDateDesc } from '../lib/format';
import { ApplicationCard } from '../components/ApplicationCard';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/Layout';

type SortKey = 'newest' | 'oldest' | 'interview' | 'company';
type InterviewFilter = 'all' | 'with' | 'without';

export function Applications({ onAdd }: { onAdd: () => void }) {
  const { t, tn } = useI18n();
  const { followUpDays } = usePreferences();
  const { applications, loading } = useStore();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [schedule, setSchedule] = useState<'all' | Schedule>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [interviewFilter, setInterviewFilter] = useState<InterviewFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [filtersOpen, setFiltersOpen] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth >= 960
  );

  const activeFilters =
    (status !== 'all' ? 1 : 0) +
    (schedule !== 'all' ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0) +
    (interviewFilter !== 'all' ? 1 : 0);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = applications.filter((application) => {
      if (term) {
        const haystack = `${application.company} ${application.position} ${application.jobDescription ?? ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (status !== 'all' && application.status !== status) return false;
      if (schedule !== 'all' && application.workSchedule !== schedule) return false;
      if (from && application.appliedOn < from) return false;
      if (to && application.appliedOn > to) return false;
      if (interviewFilter === 'with' && application.interviews.length === 0) return false;
      if (interviewFilter === 'without' && application.interviews.length > 0) return false;
      return true;
    });

    switch (sort) {
      case 'oldest':
        return list.sort((a, b) => sortByAppliedDateDesc(b, a));
      case 'company':
        return list.sort((a, b) => a.company.localeCompare(b.company, undefined, { sensitivity: 'base' }));
      case 'interview':
        return list.sort((a, b) => {
          const nextA = upcomingInterviews(a)[0];
          const nextB = upcomingInterviews(b)[0];
          if (nextA && nextB) {
            return new Date(nextA.scheduledAt).getTime() - new Date(nextB.scheduledAt).getTime();
          }
          if (nextA) return -1;
          if (nextB) return 1;
          return sortByAppliedDateDesc(a, b);
        });
      default:
        return list.sort((a, b) => {
          const byDate = sortByAppliedDateDesc(a, b);
          return byDate !== 0 ? byDate : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }
  }, [applications, search, status, schedule, from, to, interviewFilter, sort]);

  const resetFilters = () => {
    setStatus('all');
    setSchedule('all');
    setFrom('');
    setTo('');
    setInterviewFilter('all');
  };

  return (
    <>
      <PageHeader title={t('applications.title')} subtitle={t('applications.subtitle')}>
        <button type="button" className="button button--primary" onClick={onAdd}>
          <Plus size={17} aria-hidden="true" />
          {t('applications.add')}
        </button>
      </PageHeader>

      <div className="toolbar">
        <div className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            className="input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('applications.searchPlaceholder')}
            aria-label={t('common.search')}
          />
          {search ? (
            <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label={t('common.clear')}>
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <label className="toolbar__sort">
          <span className="visually-hidden">{t('applications.sort')}</span>
          <select className="input input--compact" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="newest">{t('applications.sortNewest')}</option>
            <option value="oldest">{t('applications.sortOldest')}</option>
            <option value="interview">{t('applications.sortInterview')}</option>
            <option value="company">{t('applications.sortCompany')}</option>
          </select>
        </label>

        <button
          type="button"
          className={`button button--ghost button--with-badge${filtersOpen ? ' is-active' : ''}`}
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          {t('applications.filters')}
          {activeFilters > 0 ? <span className="badge">{activeFilters}</span> : null}
        </button>
      </div>

      {filtersOpen ? (
        <div className="filter-panel">
          <label className="field">
            <span className="field__label">{t('applications.filterStatus')}</span>
            <select className="input" value={status} onChange={(event) => setStatus(event.target.value as 'all' | Status)}>
              <option value="all">{t('common.all')}</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`status.${value}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">{t('applications.filterSchedule')}</span>
            <select
              className="input"
              value={schedule}
              onChange={(event) => setSchedule(event.target.value as 'all' | Schedule)}
            >
              <option value="all">{t('common.all')}</option>
              {SCHEDULES.map((value) => (
                <option key={value} value={value}>
                  {t(`schedule.${value}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">{t('applications.dateFrom')}</span>
            <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>

          <label className="field">
            <span className="field__label">{t('applications.dateTo')}</span>
            <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>

          <label className="field">
            <span className="field__label">{t('form.interviewDate')}</span>
            <select
              className="input"
              value={interviewFilter}
              onChange={(event) => setInterviewFilter(event.target.value as InterviewFilter)}
            >
              <option value="all">{t('common.all')}</option>
              <option value="with">{t('applications.withInterview')}</option>
              <option value="without">{t('applications.withoutInterview')}</option>
            </select>
          </label>

          <div className="filter-panel__actions">
            <button type="button" className="button button--ghost" onClick={resetFilters} disabled={activeFilters === 0}>
              {t('applications.clearFilters')}
            </button>
          </div>
        </div>
      ) : null}

      {applications.length > 0 ? (
        <p className="result-summary">{tn('applications.count', filtered.length)}</p>
      ) : null}

      {filtered.length === 0 ? (
        applications.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={22} />}
            title={loading ? t('common.loading') : t('applications.emptyAll')}
            body={t('applications.emptyAllBody')}
            action={
              <button type="button" className="button button--primary" onClick={onAdd}>
                <Plus size={17} aria-hidden="true" />
                {t('applications.add')}
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={<Search size={22} />}
            title={t('applications.empty')}
            body={t('applications.emptyBody')}
            action={
              <button type="button" className="button button--ghost" onClick={resetFilters}>
                {t('applications.clearFilters')}
              </button>
            }
          />
        )
      ) : (
        <div className="apps-grid">
          {filtered.map((application) => (
            <ApplicationCard key={application.id} application={application} followUpDays={followUpDays} />
          ))}
        </div>
      )}
    </>
  );
}
