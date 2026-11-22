import { useEffect, useRef, useState } from 'react';
import {
  AlarmClock,
  ArrowLeft,
  CalendarPlus,
  Check,
  CircleCheck,
  ExternalLink,
  Mail,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useI18n, localeOf } from '../i18n';
import { usePreferences } from '../lib/prefs';
import { isOfflineError, useStore } from '../lib/store';
import type { Application, Interview, Status } from '../types';
import { STATUSES } from '../types';
import { formatDate, formatDateTime } from '../lib/dates';
import {
  daysSinceApplied,
  formatTimeLine,
  interviewDelta,
  needsFollowUp,
  sortedInterviews,
  upcomingInterviews,
} from '../lib/format';
import { navigate } from '../lib/router';
import { useToast } from '../components/Toast';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { InterviewForm } from '../components/InterviewForm';
import { PageHeader } from '../components/Layout';

interface ApplicationDetailProps {
  id: string;
  onEdit: (application: Application) => void;
}

export function ApplicationDetail({ id, onEdit }: ApplicationDetailProps) {
  const { t, tn, language } = useI18n();
  const { followUpDays } = usePreferences();
  const store = useStore();
  const toast = useToast();
  const locale = localeOf[language];

  const application = store.applications.find((item) => item.id === id) ?? null;

  const [notes, setNotes] = useState(application?.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [interviewFormOpen, setInterviewFormOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [deleteInterviewTarget, setDeleteInterviewTarget] = useState<Interview | null>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    setNotes(application?.notes ?? '');
  }, [application?.id]);

  const trimmed = notes.trim();
  const normalised = trimmed ? notes : null;
  const dirty = application ? normalised !== (application.notes ?? null) : false;

  useEffect(() => {
    if (!application || !dirty) return;
    const timer = window.setTimeout(() => {
      void persistNotes(application.id, notesRef.current);
    }, 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, dirty, application?.id]);

  const persistNotes = async (applicationId: string, value: string) => {
    setSavingNotes(true);
    try {
      await store.patchApplication(applicationId, { notes: value.trim() ? value : null });
    } catch (error) {
      if (isOfflineError(error)) toast.show(t('toast.offlineCloud'), 'error');
      else toast.show(error instanceof Error ? error.message : t('toast.error'), 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  if (!application) {
    return (
      <>
        <button type="button" className="text-button text-button--back" onClick={() => navigate('/applications')}>
          <ArrowLeft size={15} aria-hidden="true" />
          {t('detail.back')}
        </button>
        <EmptyState
          icon={<CircleCheck size={22} />}
          title={store.loading ? t('common.loading') : t('detail.notFound')}
          action={
            <button type="button" className="button button--ghost" onClick={() => navigate('/applications')}>
              {t('detail.back')}
            </button>
          }
        />
      </>
    );
  }

  const appliedDays = daysSinceApplied(application);
  const interviews = sortedInterviews(application);
  const nextInterview = upcomingInterviews(application)[0] ?? null;
  const followUp = needsFollowUp(application, followUpDays);

  const changeStatus = async (status: Status) => {
    try {
      await store.patchApplication(application.id, { status });
      toast.show(t('toast.statusUpdated'));
    } catch (error) {
      if (isOfflineError(error)) toast.show(t('toast.offlineCloud'), 'error');
      else toast.show(error instanceof Error ? error.message : t('toast.error'), 'error');
    }
  };

  const removeApplication = async () => {
    setBusy(true);
    try {
      await store.deleteApplication(application.id);
      toast.show(t('toast.deleted'));
      setConfirmDelete(false);
      navigate('/applications');
    } catch (error) {
      if (isOfflineError(error)) toast.show(t('toast.offlineCloud'), 'error');
      else toast.show(error instanceof Error ? error.message : t('toast.error'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleFollowUp = async (done: boolean) => {
    try {
      await store.patchApplication(application.id, { followUpDone: done });
      toast.show(done ? t('toast.followUpMarked') : t('toast.followUpReset'));
    } catch (error) {
      if (isOfflineError(error)) toast.show(t('toast.offlineCloud'), 'error');
      else toast.show(error instanceof Error ? error.message : t('toast.error'), 'error');
    }
  };

  const removeInterview = async () => {
    if (!deleteInterviewTarget) return;
    try {
      await store.deleteInterview(application.id, deleteInterviewTarget.id);
      toast.show(t('toast.interviewDeleted'));
      setDeleteInterviewTarget(null);
    } catch (error) {
      if (isOfflineError(error)) toast.show(t('toast.offlineCloud'), 'error');
      else toast.show(error instanceof Error ? error.message : t('toast.error'), 'error');
    }
  };

  const link = (value: string | null) => {
    if (!value) return null;
    const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return (
      <a className="link" href={href} target="_blank" rel="noreferrer noopener">
        {value.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
        <ExternalLink size={12} aria-hidden="true" />
      </a>
    );
  };

  return (
    <>
      <button type="button" className="text-button text-button--back" onClick={() => navigate('/applications')}>
        <ArrowLeft size={15} aria-hidden="true" />
        {t('detail.back')}
      </button>

      <PageHeader title={application.company} subtitle={application.position}>
        <button type="button" className="button button--ghost" onClick={() => onEdit(application)}>
          <Pencil size={16} aria-hidden="true" />
          {t('common.edit')}
        </button>
        <button type="button" className="button button--ghost button--danger-text" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={16} aria-hidden="true" />
          {t('common.delete')}
        </button>
      </PageHeader>

      <div className="detail-status-row">
        <StatusBadge status={application.status} />
        <label className="inline-select">
          <span className="visually-hidden">{t('form.status')}</span>
          <select
            className="input input--compact"
            value={application.status}
            onChange={(event) => void changeStatus(event.target.value as Status)}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </select>
        </label>
        {nextInterview ? (
          <span className="chip chip--accent">
            {formatTimeLine('interview', interviewDelta(nextInterview), t, tn)}
          </span>
        ) : null}
      </div>

      <div className="detail-grid">
        <div className="detail-column">
          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">{t('detail.appliedOn')}</h2>
            </div>
            <div className="info-grid">
              <div className="info">
                <span className="info__label">{t('detail.appliedOn')}</span>
                <span className="info__value">{formatDate(application.appliedOn, locale)}</span>
              </div>
              <div className="info">
                <span className="info__label">{t('detail.daysSince')}</span>
                <span className="info__value">{appliedDays}</span>
              </div>
              <div className="info">
                <span className="info__label">{t('form.schedule')}</span>
                <span className="info__value">
                  {application.workSchedule ? t(`schedule.${application.workSchedule}`) : t('common.none')}
                </span>
              </div>
              <div className="info">
                <span className="info__label">{t('detail.salary')}</span>
                <span className="info__value">{application.expectedSalary ?? t('common.none')}</span>
              </div>
              <div className="info">
                <span className="info__label">{t('detail.contact')}</span>
                <span className="info__value">
                  {application.contactName ?? t('common.none')}
                  {application.contactEmail ? (
                    <a className="link" href={`mailto:${application.contactEmail}`}>
                      <Mail size={12} aria-hidden="true" />
                      {application.contactEmail}
                    </a>
                  ) : null}
                </span>
              </div>
              <div className="info">
                <span className="info__label">{t('detail.links')}</span>
                <span className="info__value">
                  {link(application.jobUrl) ?? <span>{t('common.none')}</span>}
                  {link(application.companyWebsite)}
                </span>
              </div>
            </div>
            <p className="muted small detail-updated">
              {t('detail.updatedAt', { date: formatDateTime(application.updatedAt, locale) })}
            </p>
          </section>

          {application.jobDescription ? (
            <section className="panel">
              <div className="panel__header">
                <h2 className="panel__title">{t('detail.description')}</h2>
              </div>
              <p className="prose">{application.jobDescription}</p>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">{t('detail.interviews')}</h2>
              <button
                type="button"
                className="button button--soft button--small"
                onClick={() => {
                  setEditingInterview(null);
                  setInterviewFormOpen(true);
                }}
              >
                <CalendarPlus size={15} aria-hidden="true" />
                {t('detail.addInterview')}
              </button>
            </div>

            {interviews.length === 0 ? (
              <p className="muted small">{t('detail.noInterviews')}</p>
            ) : (
              <ul className="interview-list">
                {interviews.map((interview) => {
                  const delta = interviewDelta(interview);
                  return (
                    <li key={interview.id} className="interview">
                      <div className="interview__head">
                        <div>
                          <p className="interview__title">{formatDateTime(interview.scheduledAt, locale)}</p>
                          <p className="interview__meta">
                            {interview.round ?? t('form.interviewDate')}
                            {interview.location ? ` · ${interview.location}` : ''}
                          </p>
                        </div>
                        <div className="interview__actions">
                          <button
                            type="button"
                            className="icon-button icon-button--small"
                            onClick={() => {
                              setEditingInterview(interview);
                              setInterviewFormOpen(true);
                            }}
                            aria-label={t('detail.editInterview')}
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-button icon-button--small"
                            onClick={() => setDeleteInterviewTarget(interview)}
                            aria-label={t('detail.deleteInterview')}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <p className={delta >= 0 ? 'interview__when' : 'interview__when interview__when--past'}>
                        {formatTimeLine('interview', delta, t, tn)}
                      </p>
                      {interview.feedback ? <p className="prose prose--small">{interview.feedback}</p> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">{t('detail.notes')}</h2>
              <span className="muted small">{savingNotes ? t('common.saving') : dirty ? '' : t('toast.notesSaved')}</span>
            </div>
            <p className="muted small">{t('detail.notesHint')}</p>
            <textarea
              className="input textarea textarea--tall"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t('form.notesPlaceholder')}
            />
            <div className="notes-actions">
              <button
                type="button"
                className="button button--soft button--small"
                disabled={!dirty || savingNotes}
                onClick={() => void persistNotes(application.id, notes)}
              >
                <Check size={15} aria-hidden="true" />
                {savingNotes ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </section>
        </div>

        <aside className="detail-column">
          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">
                <AlarmClock size={16} aria-hidden="true" />
                {t('detail.followUp')}
              </h2>
            </div>
            {followUp ? (
              <>
                <p className="muted small">{tn('detail.followUpBody', appliedDays)}</p>
                <button type="button" className="button button--soft button--block" onClick={() => void toggleFollowUp(true)}>
                  <Check size={16} aria-hidden="true" />
                  {t('detail.markFollowUp')}
                </button>
              </>
            ) : application.followUpDone ? (
              <>
                <p className="chip chip--ok">
                  <Check size={13} aria-hidden="true" />
                  {t('detail.followUpDone')}
                </p>
                <button type="button" className="button button--ghost button--block" onClick={() => void toggleFollowUp(false)}>
                  {t('detail.undoFollowUp')}
                </button>
              </>
            ) : (
              <p className="muted small">{t('dashboard.followUpHint', { n: followUpDays })}</p>
            )}
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">{t('detail.interviews')}</h2>
            </div>
            {interviews.length === 0 ? (
              <p className="muted small">{t('detail.noInterviews')}</p>
            ) : (
              <ul className="mini-list">
                {interviews.map((interview) => (
                  <li key={interview.id}>
                    <span>{formatDate(interview.scheduledAt.slice(0, 10), locale)}</span>
                    <span className="muted small">{interview.round ?? t('form.interviewDate')}</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="button button--ghost button--block"
              onClick={() => {
                setEditingInterview(null);
                setInterviewFormOpen(true);
              }}
            >
              <Plus size={15} aria-hidden="true" />
              {t('detail.addInterview')}
            </button>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('applications.deleteTitle')}
        body={t('applications.deleteBody')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void removeApplication()}
        danger
        busy={busy}
      />

      <ConfirmDialog
        open={Boolean(deleteInterviewTarget)}
        title={t('detail.deleteInterview')}
        body={t('applications.deleteBody')}
        onCancel={() => setDeleteInterviewTarget(null)}
        onConfirm={() => void removeInterview()}
        danger
      />

      <InterviewForm
        open={interviewFormOpen}
        applicationId={application.id}
        interview={editingInterview}
        onClose={() => {
          setInterviewFormOpen(false);
          setEditingInterview(null);
        }}
      />
    </>
  );
}
