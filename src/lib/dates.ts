// Calendar-day arithmetic. Everything is normalised to a UTC day index so
// daylight-saving shifts can never produce an off-by-one day count.
const MS_PER_DAY = 86_400_000;

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toDateInputValue(new Date());
}

export function dayIndex(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole calendar days from `from` to `to`. Positive means `to` is later. */
export function daysBetween(from: Date | string, to: Date | string = new Date()): number {
  const a = typeof from === 'string' ? parseDateOnly(from) : from;
  const b = typeof to === 'string' ? parseDateOnly(to) : to;
  return dayIndex(b) - dayIndex(a);
}

/** True when the timestamp falls on today's calendar date. */
export function isToday(date: Date): boolean {
  return dayIndex(date) === dayIndex(new Date());
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayIndex(a) === dayIndex(b);
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

/** 6-week grid starting on Monday. */
export function monthGrid(date: Date): Date[] {
  const first = startOfMonth(date);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
  });
}

// Albanian month and weekday names are declared explicitly: some browser
// builds ship without sq locale data and silently fall back to English.
const SQ_MONTHS_SHORT = ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'kor', 'gsh', 'sht', 'tet', 'nën', 'dhj'];
const SQ_MONTHS_LONG = [
  'Janar',
  'Shkurt',
  'Mars',
  'Prill',
  'Maj',
  'Qershor',
  'Korrik',
  'Gusht',
  'Shtator',
  'Tetor',
  'Nëntor',
  'Dhjetor',
];
const SQ_WEEKDAYS = ['Hë', 'Ma', 'Më', 'En', 'Pr', 'Sh', 'Di'];

function isAlbanian(locale: string): boolean {
  return locale.toLowerCase().startsWith('sq');
}

export function formatDate(value: string | Date, locale: string, withYear = true): string {
  const date = typeof value === 'string' ? parseDateOnly(value) : value;
  if (isAlbanian(locale)) {
    const month = SQ_MONTHS_SHORT[date.getMonth()];
    return withYear ? `${date.getDate()} ${month} ${date.getFullYear()}` : `${date.getDate()} ${month}`;
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' as const } : {}),
  }).format(date);
}

export function formatTime(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(isAlbanian(locale) ? 'en-GB' : locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDateTime(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${formatDate(date, locale)} · ${formatTime(date, locale)}`;
}

export function formatMonthYear(date: Date, locale: string): string {
  if (isAlbanian(locale)) return `${SQ_MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
  const formatted = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
  return formatted.charAt(0).toLocaleUpperCase(locale) + formatted.slice(1);
}

export function monthShort(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isAlbanian(locale)) return SQ_MONTHS_SHORT[date.getMonth()];
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(date).replace('.', '');
}

/** Monday-first weekday initials for the calendar header. */
export function weekdayLabels(locale: string): string[] {
  if (isAlbanian(locale)) return SQ_WEEKDAYS;
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const reference = new Date(2024, 0, 1); // a Monday
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() + index);
    return formatter.format(day).replace('.', '').slice(0, 2);
  });
}

export interface TimeBadge {
  kind: 'applied' | 'interview';
  tone: 'neutral' | 'soon' | 'today' | 'past';
  key: string;
  count?: number;
}

/** Days from the application date, as used by cards and the detail view. */
export function appliedDays(appliedOn: string): number {
  return daysBetween(appliedOn);
}

export function interviewDayDelta(scheduledAt: string): number {
  return daysBetween(new Date(), new Date(scheduledAt));
}
