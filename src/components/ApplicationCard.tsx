import { BriefcaseBusiness, CalendarClock, Clock3, AlarmClock } from 'lucide-react';
import { useI18n, localeOf } from '../i18n';
import type { Application } from '../types';
import { formatDate, formatDateTime } from '../lib/dates';
import {
  daysSinceApplied,
  featuredInterview,
  formatTimeLine,
  interviewDelta,
  needsFollowUp,
} from '../lib/format';
import { navigate } from '../lib/router';
import { StatusBadge } from './StatusBadge';

interface ApplicationCardProps {
  application: Application;
  followUpDays: number;
}

export function ApplicationCard({ application, followUpDays }: ApplicationCardProps) {
  const { t, tn, language } = useI18n();
  const locale = localeOf[language];

  const appliedDays = daysSinceApplied(application);
  const interview = featuredInterview(application);
  const delta = interview ? interviewDelta(interview) : null;
  const followUp = needsFollowUp(application, followUpDays);

  return (
    <article
      className="app-card"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/applications/${application.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(`/applications/${application.id}`);
        }
      }}
      aria-label={`${application.company} — ${application.position}`}
    >
      <div className="app-card__top">
        <span className="avatar" aria-hidden="true">
          {application.company.trim().charAt(0).toLocaleUpperCase(locale)}
        </span>
        <div className="app-card__heading">
          <h3>{application.company}</h3>
          <p>{application.position}</p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <div className="app-card__meta">
        <span>
          <BriefcaseBusiness size={14} aria-hidden="true" />
          {application.workSchedule ? t(`schedule.${application.workSchedule}`) : t('common.none')}
        </span>
        <span>
          <CalendarClock size={14} aria-hidden="true" />
          {formatDate(application.appliedOn, locale)}
        </span>
        {interview ? (
          <span>
            <Clock3 size={14} aria-hidden="true" />
            {formatDateTime(interview.scheduledAt, locale)}
          </span>
        ) : null}
      </div>

      <div className="app-card__foot">
        <span className="app-card__time">{formatTimeLine('applied', appliedDays, t, tn)}</span>
        {interview && delta !== null ? (
          <span className={delta === 0 ? 'app-card__time app-card__time--today' : 'app-card__time'}>
            {formatTimeLine('interview', delta, t, tn)}
          </span>
        ) : (
          <span className="app-card__time app-card__time--muted">{t('time.noInterview')}</span>
        )}
      </div>

      {followUp ? (
        <span className="app-card__flag">
          <AlarmClock size={13} aria-hidden="true" />
          {t('dashboard.followUp')}
        </span>
      ) : null}
    </article>
  );
}
