import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import type { Interview } from '../types';
import { isOfflineError, useStore } from '../lib/store';
import { isoToLocalInput, localInputToIso } from '../lib/datetime';
import { Modal } from './Modal';
import { useToast } from './Toast';

interface InterviewFormProps {
  open: boolean;
  applicationId: string;
  interview?: Interview | null;
  onClose: () => void;
}

export function InterviewForm({ open, applicationId, interview, onClose }: InterviewFormProps) {
  const { t } = useI18n();
  const store = useStore();
  const toast = useToast();
  const [scheduledAt, setScheduledAt] = useState('');
  const [round, setRound] = useState('');
  const [location, setLocation] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScheduledAt(isoToLocalInput(interview?.scheduledAt ?? null));
    setRound(interview?.round ?? '');
    setLocation(interview?.location ?? '');
    setFeedback(interview?.feedback ?? '');
    setBusy(false);
  }, [open, interview]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const iso = localInputToIso(scheduledAt);
    if (!iso) {
      toast.show(t('toast.invalidDate'), 'error');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        scheduledAt: iso,
        round: round.trim() || null,
        location: location.trim() || null,
        feedback: feedback.trim() || null,
      };
      if (interview) {
        await store.updateInterview(applicationId, interview.id, payload);
      } else {
        await store.addInterview(applicationId, payload);
      }
      toast.show(t('toast.interviewSaved'));
      onClose();
    } catch (error) {
      if (isOfflineError(error)) toast.show(t('toast.offlineCloud'), 'error');
      else toast.show(error instanceof Error ? error.message : t('toast.error'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={interview ? t('detail.editInterview') : t('detail.addInterview')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="interview-form" className="button button--primary" disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="interview-form" onSubmit={submit} className="form">
        <div className="form-grid">
          <label className="field field--full">
            <span className="field__label">
              {t('form.interviewDate')} <span className="field__req">*</span>
            </span>
            <input
              type="datetime-local"
              className="input"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              required
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field__label">{t('detail.round')}</span>
            <input
              className="input"
              value={round}
              onChange={(event) => setRound(event.target.value)}
              placeholder={t('detail.roundPlaceholder')}
            />
          </label>

          <label className="field">
            <span className="field__label">{t('detail.location')}</span>
            <input className="input" value={location} onChange={(event) => setLocation(event.target.value)} />
          </label>

          <label className="field field--full">
            <span className="field__label">{t('detail.feedback')}</span>
            <textarea
              className="input textarea"
              rows={4}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
            />
          </label>
        </div>

      </form>
    </Modal>
  );
}
