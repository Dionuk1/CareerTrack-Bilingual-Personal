import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import type { Application, ApplicationInput, Schedule, Status } from '../types';
import { STATUSES } from '../types';
import { useStore, isOfflineError } from '../lib/store';
import { useToast } from './Toast';
import { todayISO } from '../lib/dates';
import { isoToLocalInput, localInputToIso } from '../lib/datetime';
import { sortedInterviews } from '../lib/format';
import { Modal } from './Modal';

interface FormState {
  position: string;
  company: string;
  appliedOn: string;
  status: Status;
  workSchedule: '' | Schedule;
  jobUrl: string;
  companyWebsite: string;
  expectedSalary: string;
  contactName: string;
  contactEmail: string;
  jobDescription: string;
  notes: string;
  interviewAt: string;
}

function toForm(application?: Application | null): FormState {
  if (!application) {
    return {
      position: '',
      company: '',
      appliedOn: todayISO(),
      status: 'applied',
      workSchedule: '',
      jobUrl: '',
      companyWebsite: '',
      expectedSalary: '',
      contactName: '',
      contactEmail: '',
      jobDescription: '',
      notes: '',
      interviewAt: '',
    };
  }
  const first = sortedInterviews(application)[0] ?? null;
  return {
    position: application.position,
    company: application.company,
    appliedOn: application.appliedOn,
    status: application.status,
    workSchedule: application.workSchedule ?? '',
    jobUrl: application.jobUrl ?? '',
    companyWebsite: application.companyWebsite ?? '',
    expectedSalary: application.expectedSalary ?? '',
    contactName: application.contactName ?? '',
    contactEmail: application.contactEmail ?? '',
    jobDescription: application.jobDescription ?? '',
    notes: application.notes ?? '',
    interviewAt: isoToLocalInput(first?.scheduledAt ?? null),
  };
}

const clean = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

interface ApplicationFormProps {
  open: boolean;
  application?: Application | null;
  onClose: () => void;
}

export function ApplicationForm({ open, application, onClose }: ApplicationFormProps) {
  const { t } = useI18n();
  const store = useStore();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => toForm(application));
  const [busy, setBusy] = useState(false);
  const [primaryInterviewId, setPrimaryInterviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(application));
    const first = application ? sortedInterviews(application)[0] : undefined;
    setPrimaryInterviewId(first?.id ?? null);
    setBusy(false);
  }, [open, application]);

  const update = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!form.position.trim() || !form.company.trim()) {
      toast.show(t('toast.requiredFields'), 'error');
      return;
    }
    if (!form.appliedOn) {
      toast.show(t('toast.invalidDate'), 'error');
      return;
    }

    const input: ApplicationInput = {
      position: form.position.trim(),
      company: form.company.trim(),
      appliedOn: form.appliedOn,
      workSchedule: form.workSchedule || null,
      jobDescription: clean(form.jobDescription),
      status: form.status,
      jobUrl: clean(form.jobUrl),
      companyWebsite: clean(form.companyWebsite),
      expectedSalary: clean(form.expectedSalary),
      contactName: clean(form.contactName),
      contactEmail: clean(form.contactEmail),
      notes: clean(form.notes),
      followUpDone: application?.followUpDone ?? false,
    };

    const scheduledAt = localInputToIso(form.interviewAt);
    if (form.interviewAt && !scheduledAt) {
      toast.show(t('toast.invalidDate'), 'error');
      return;
    }

    setBusy(true);
    try {
      let applicationId = application?.id ?? '';
      if (application) {
        await store.patchApplication(application.id, input);
      } else {
        const created = await store.createApplication(input);
        applicationId = created.id;
      }

      if (scheduledAt && primaryInterviewId) {
        await store.updateInterview(applicationId, primaryInterviewId, { scheduledAt });
      } else if (scheduledAt) {
        const created = await store.addInterview(applicationId, { scheduledAt, round: null });
        setPrimaryInterviewId(created.id);
      } else if (primaryInterviewId) {
        await store.deleteInterview(applicationId, primaryInterviewId);
        setPrimaryInterviewId(null);
      }

      toast.show(t('toast.saved'));
      onClose();
    } catch (error) {
      if (isOfflineError(error)) {
        toast.show(t('toast.offlineCloud'), 'error');
      } else {
        toast.show(error instanceof Error ? error.message : t('toast.error'), 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={application ? t('form.editTitle') : t('form.addTitle')}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="application-form" className="button button--primary" disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="application-form" onSubmit={submit} className="form">
        <p className="form__hint">{t('form.requiredHint')}</p>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">
              {t('form.position')} <span className="field__req">*</span>
            </span>
            <input
              className="input"
              value={form.position}
              onChange={(event) => update('position', event.target.value)}
              placeholder={t('form.positionPlaceholder')}
              required
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field__label">
              {t('form.company')} <span className="field__req">*</span>
            </span>
            <input
              className="input"
              value={form.company}
              onChange={(event) => update('company', event.target.value)}
              placeholder={t('form.companyPlaceholder')}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">
              {t('form.appliedOn')} <span className="field__req">*</span>
            </span>
            <input
              type="date"
              className="input"
              value={form.appliedOn}
              max={todayISO()}
              onChange={(event) => update('appliedOn', event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">{t('form.status')}</span>
            <select
              className="input"
              value={form.status}
              onChange={(event) => update('status', event.target.value as Status)}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">{t('form.schedule')}</span>
            <select
              className="input"
              value={form.workSchedule}
              onChange={(event) => update('workSchedule', event.target.value as '' | Schedule)}
            >
              <option value="">{t('form.selectPlaceholder')}</option>
              <option value="full_time">{t('schedule.full_time')}</option>
              <option value="part_time">{t('schedule.part_time')}</option>
            </select>
          </label>

          <label className="field">
            <span className="field__label">{t('form.interviewDate')}</span>
            <input
              type="datetime-local"
              className="input"
              value={form.interviewAt}
              onChange={(event) => update('interviewAt', event.target.value)}
            />
            <span className="field__hint">{t('form.interviewHint')}</span>
          </label>

          <label className="field">
            <span className="field__label">{t('form.salary')}</span>
            <input
              className="input"
              value={form.expectedSalary}
              onChange={(event) => update('expectedSalary', event.target.value)}
              placeholder={t('form.salaryPlaceholder')}
            />
          </label>

          <label className="field">
            <span className="field__label">{t('form.jobUrl')}</span>
            <input
              type="url"
              className="input"
              value={form.jobUrl}
              onChange={(event) => update('jobUrl', event.target.value)}
              placeholder="https://"
            />
          </label>

          <label className="field">
            <span className="field__label">{t('form.companyWebsite')}</span>
            <input
              type="url"
              className="input"
              value={form.companyWebsite}
              onChange={(event) => update('companyWebsite', event.target.value)}
              placeholder="https://"
            />
          </label>

          <label className="field">
            <span className="field__label">{t('form.contactName')}</span>
            <input
              className="input"
              value={form.contactName}
              onChange={(event) => update('contactName', event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">{t('form.contactEmail')}</span>
            <input
              type="email"
              className="input"
              value={form.contactEmail}
              onChange={(event) => update('contactEmail', event.target.value)}
              placeholder="name@company.com"
            />
          </label>

          <label className="field field--full">
            <span className="field__label">{t('form.description')}</span>
            <textarea
              className="input textarea"
              rows={4}
              value={form.jobDescription}
              onChange={(event) => update('jobDescription', event.target.value)}
              placeholder={t('form.descriptionPlaceholder')}
            />
          </label>

          <label className="field field--full">
            <span className="field__label">{t('form.notes')}</span>
            <textarea
              className="input textarea"
              rows={4}
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              placeholder={t('form.notesPlaceholder')}
            />
          </label>
        </div>

      </form>
    </Modal>
  );
}
