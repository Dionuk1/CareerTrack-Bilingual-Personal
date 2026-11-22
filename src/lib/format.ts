import type { Application, Interview, Status } from '../types';
import type { Translate, TranslateCount } from '../i18n';
import { daysBetween, parseDateOnly } from './dates';

export const NO_RESPONSE_STATUSES: Status[] = ['applied', 'under_review', 'waiting'];

export function formatTimeLine(
  kind: 'applied' | 'interview',
  delta: number,
  t: Translate,
  tn: TranslateCount
): string {
  if (kind === 'applied') {
    if (delta <= 0) return t('time.appliedToday');
    if (delta === 1) return t('time.appliedYesterday');
    return tn('time.appliedAgo', delta);
  }
  if (delta === 0) return t('time.interviewToday');
  if (delta === 1) return t('time.interviewTomorrow');
  if (delta > 1) return tn('time.interviewInDays', delta);
  return tn('time.interviewPast', Math.abs(delta));
}

export function sortedInterviews(application: Application): Interview[] {
  return [...application.interviews].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );
}

/** The interview to feature on cards: the next one, otherwise the most recent. */
export function featuredInterview(application: Application): Interview | null {
  const list = sortedInterviews(application);
  if (list.length === 0) return null;
  const now = Date.now();
  const upcoming = list.find((interview) => new Date(interview.scheduledAt).getTime() >= now);
  return upcoming ?? list[list.length - 1];
}

export function upcomingInterviews(application: Application): Interview[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sortedInterviews(application).filter(
    (interview) => new Date(interview.scheduledAt).getTime() >= today.getTime()
  );
}

export function daysSinceApplied(application: Application): number {
  return daysBetween(application.appliedOn);
}

export function interviewDelta(interview: Interview): number {
  return daysBetween(new Date(), new Date(interview.scheduledAt));
}

export function needsFollowUp(application: Application, followUpDays: number): boolean {
  if (application.followUpDone) return false;
  if (!NO_RESPONSE_STATUSES.includes(application.status)) return false;
  return daysSinceApplied(application) >= followUpDays;
}

export interface DashboardStats {
  total: number;
  interviews: number;
  waiting: number;
  accepted: number;
  rejected: number;
}

export function dashboardStats(applications: Application[]): DashboardStats {
  let interviews = 0;
  for (const application of applications) {
    interviews += upcomingInterviews(application).length;
  }
  return {
    total: applications.length,
    interviews,
    waiting: applications.filter((application) => NO_RESPONSE_STATUSES.includes(application.status)).length,
    accepted: applications.filter((application) => application.status === 'accepted').length,
    rejected: applications.filter((application) => application.status === 'rejected').length,
  };
}

export interface ActivityItem {
  id: string;
  applicationId: string;
  company: string;
  position: string;
  kind: 'created' | 'updated' | 'interview';
  at: string;
}

export function latestActivity(applications: Application[], limit = 6): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const application of applications) {
    items.push({
      id: `${application.id}-created`,
      applicationId: application.id,
      company: application.company,
      position: application.position,
      kind: 'created',
      at: application.createdAt,
    });
    if (new Date(application.updatedAt).getTime() - new Date(application.createdAt).getTime() > 1000) {
      items.push({
        id: `${application.id}-updated`,
        applicationId: application.id,
        company: application.company,
        position: application.position,
        kind: 'updated',
        at: application.updatedAt,
      });
    }
    for (const interview of application.interviews) {
      items.push({
        id: `${interview.id}-scheduled`,
        applicationId: application.id,
        company: application.company,
        position: application.position,
        kind: 'interview',
        // The activity happened when the interview was recorded, not when it is due.
        at: application.updatedAt,
      });
    }
  }
  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

export function isOverdueApplication(application: Application, followUpDays: number): boolean {
  return needsFollowUp(application, followUpDays);
}

export function sortByAppliedDateDesc(a: Application, b: Application): number {
  return parseDateOnly(b.appliedOn).getTime() - parseDateOnly(a.appliedOn).getTime();
}

/** Compact day count for the detail page. */
export function daysLabel(value: number): number {
  return Math.max(0, value);
}
