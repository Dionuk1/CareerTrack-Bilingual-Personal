import { isSchedule, isStatus, newId, type Application, type ApplicationInput, type Interview } from '../types';

export interface ImportedInterview {
  scheduledAt: string;
  round: string | null;
  location: string | null;
  feedback: string | null;
}

export interface ImportedApplication {
  application: ApplicationInput;
  interviews: ImportedInterview[];
}

export class BackupError extends Error {}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)) {
      return `${year}-${month}-${day}`;
    }
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normaliseInterview(raw: unknown): ImportedInterview | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const scheduledAt =
    timestamp(record.scheduledAt) ??
    timestamp(record.scheduled_at) ??
    (dateOnly(record.date) ? timestamp(`${dateOnly(record.date)}T09:00:00`) : null);
  if (!scheduledAt) return null;
  return {
    scheduledAt,
    round: text(record.round),
    location: text(record.location),
    feedback: text(record.feedback),
  };
}

/** Accepts a CareerTrack backup object or a bare array of applications. */
export function parseBackup(raw: string): ImportedApplication[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupError('invalid-json');
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { applications?: unknown }).applications)
      ? ((parsed as { applications: unknown[] }).applications as unknown[])
      : null;

  if (!list) throw new BackupError('invalid-shape');

  const result: ImportedApplication[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;

    const position = text(record.position);
    const company = text(record.company);
    const appliedOn = dateOnly(record.appliedOn) ?? dateOnly(record.applied_on);
    if (!position || !company || !appliedOn) continue;

    const statusRaw = record.status;
    const status = isStatus(statusRaw) ? statusRaw : 'applied';
    const scheduleRaw = record.workSchedule ?? record.work_schedule;
    const workSchedule = isSchedule(scheduleRaw) ? scheduleRaw : null;

    const legacyInterview = timestamp(record.interviewDate) ?? timestamp(record.interview_date);
    const interviews: ImportedInterview[] = [];
    if (Array.isArray(record.interviews)) {
      for (const item of record.interviews) {
        const interview = normaliseInterview(item);
        if (interview) interviews.push(interview);
      }
    }
    if (legacyInterview && interviews.length === 0) {
      interviews.push({ scheduledAt: legacyInterview, round: null, location: null, feedback: null });
    }

    result.push({
      application: {
        position,
        company,
        appliedOn,
        workSchedule,
        jobDescription: text(record.jobDescription) ?? text(record.job_description),
        status,
        jobUrl: text(record.jobUrl) ?? text(record.job_url),
        companyWebsite: text(record.companyWebsite) ?? text(record.company_website),
        expectedSalary: text(record.expectedSalary) ?? text(record.expected_salary),
        contactName: text(record.contactName) ?? text(record.contact_name),
        contactEmail: text(record.contactEmail) ?? text(record.contact_email),
        notes: text(record.notes),
        followUpDone: Boolean(record.followUpDone ?? record.follow_up_done),
      },
      interviews,
    });
  }

  if (result.length === 0) throw new BackupError('no-applications');
  return result;
}

export function buildBackupJson(applications: Application[]): string {
  return JSON.stringify(
    {
      app: 'careertrack',
      version: 1,
      exportedAt: new Date().toISOString(),
      applications,
    },
    null,
    2
  );
}

export function buildCsv(applications: Application[], headers: string[]): string {
  const escape = (value: unknown) => {
    const raw = value === null || value === undefined ? '' : String(value);
    return `"${raw.replace(/"/g, '""')}"`;
  };
  const rows = applications.map((application) => {
    const interviews = [...application.interviews]
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .map((interview) => new Date(interview.scheduledAt).toISOString())
      .join(' | ');
    return [
      application.company,
      application.position,
      application.status,
      application.workSchedule ?? '',
      application.appliedOn,
      interviews,
      application.expectedSalary ?? '',
      application.jobUrl ?? '',
      application.companyWebsite ?? '',
      application.contactName ?? '',
      application.contactEmail ?? '',
      (application.notes ?? '').replace(/\r?\n/g, ' '),
      application.followUpDone ? 'yes' : 'no',
    ]
      .map(escape)
      .join(',');
  });
  return [headers.map(escape).join(','), ...rows].join('\r\n');
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function emptyApplication(overrides: Partial<ApplicationInput> = {}): ApplicationInput {
  return {
    position: '',
    company: '',
    appliedOn: new Date().toISOString().slice(0, 10),
    workSchedule: null,
    jobDescription: null,
    status: 'applied',
    jobUrl: null,
    companyWebsite: null,
    expectedSalary: null,
    contactName: null,
    contactEmail: null,
    notes: null,
    followUpDone: false,
    ...overrides,
  };
}

export function draftInterviews(application: Application): Interview[] {
  return application.interviews;
}

export function makeId(): string {
  return newId();
}
