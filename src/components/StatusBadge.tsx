import { useI18n } from '../i18n';
import type { Status } from '../types';

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useI18n();
  return <span className={`status status--${status}`}>{t(`status.${status}`)}</span>;
}
