import { useI18n } from '../i18n';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  busy?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = false,
  busy = false,
}: ConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={busy}>
            {t('confirm.no')}
          </button>
          <button
            type="button"
            className={danger ? 'button button--danger' : 'button button--primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel ?? t('confirm.yes')}
          </button>
        </>
      }
    >
      <p className="muted">{body}</p>
    </Modal>
  );
}
