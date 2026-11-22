export const STATUSES = [
  'applied',
  'under_review',
  'interview_scheduled',
  'interview_completed',
  'waiting',
  'accepted',
  'rejected',
  'withdrawn',
] as const;

export type Status = (typeof STATUSES)[number];

export const SCHEDULES = ['full_time', 'part_time'] as const;
export type Schedule = (typeof SCHEDULES)[number];

export interface Interview {
  id: string;
  applicationId: string;
  scheduledAt: string;
  round: string | null;
  location: string | null;
  feedback: string | null;
}

export interface Application {
  id: string;
  position: string;
  company: string;
  appliedOn: string;
  workSchedule: Schedule | null;
  jobDescription: string | null;
  status: Status;
  jobUrl: string | null;
  companyWebsite: string | null;
  expectedSalary: string | null;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  followUpDone: boolean;
  createdAt: string;
  updatedAt: string;
  interviews: Interview[];
}

export type ApplicationInput = Omit<Application, 'id' | 'createdAt' | 'updatedAt' | 'interviews'>;

export interface InterviewInput {
  id?: string;
  scheduledAt: string;
  round?: string | null;
  location?: string | null;
  feedback?: string | null;
}

export interface BackupFile {
  app: 'careertrack';
  version: number;
  exportedAt: string;
  applications: unknown[];
}

export const DEFAULT_FOLLOW_UP_DAYS = 7;

export function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

export function isSchedule(value: unknown): value is Schedule {
  return typeof value === 'string' && (SCHEDULES as readonly string[]).includes(value);
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
