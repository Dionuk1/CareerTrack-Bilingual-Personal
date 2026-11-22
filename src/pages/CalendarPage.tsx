import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n, localeOf } from '../i18n';
import { useStore } from '../lib/store';
import type { Application, Interview } from '../types';
import {
  addMonths,
  dayIndex,
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatTime,
  monthShort,
  isSameDay,
  isSameMonth,
  isToday,
  monthGrid,
  startOfMonth,
  weekdayLabels,
} from '../lib/dates';
import { navigate } from '../lib/router';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/Layout';

interface CalendarEvent {
  application: Application;
  interview: Interview;
}

export function CalendarPage() {
  const { t, language } = useI18n();
  const { applications } = useStore();
  const locale = localeOf[language];

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(() => new Date());

  const events = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = [];
    for (const application of applications) {
      for (const interview of application.interviews) {
        list.push({ application, interview });
      }
    }
    return list.sort((a, b) => new Date(a.interview.scheduledAt).getTime() - new Date(b.interview.scheduledAt).getTime());
  }, [applications]);

  const byDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const event of events) {
      const key = dayIndex(new Date(event.interview.scheduledAt));
      const bucket = map.get(key) ?? [];
      bucket.push(event);
      map.set(key, bucket);
    }
    return map;
  }, [events]);

  const selectedEvents = byDay.get(dayIndex(selected)) ?? [];
  const grid = monthGrid(month);
  const weekdays = weekdayLabels(locale);

  const now = Date.now();
  const upcoming = events.filter((event) => new Date(event.interview.scheduledAt).getTime() >= now).slice(0, 4);
  const past = events
    .filter((event) => new Date(event.interview.scheduledAt).getTime() < now)
    .slice(-4)
    .reverse();

  return (
    <>
      <PageHeader title={t('calendar.title')} subtitle={t('calendar.subtitle')} />

      <div className="calendar-layout">
        <section className="panel">
          <div className="calendar__head">
            <button type="button" className="icon-button" onClick={() => setMonth((current) => addMonths(current, -1))} aria-label={t('calendar.prev')}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <div className="calendar__label">
              <h2>{formatMonthYear(month, locale)}</h2>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  const today = new Date();
                  setMonth(startOfMonth(today));
                  setSelected(today);
                }}
              >
                {t('common.today')}
              </button>
            </div>
            <button type="button" className="icon-button" onClick={() => setMonth((current) => addMonths(current, 1))} aria-label={t('calendar.next')}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="calendar__grid" role="grid">
            {weekdays.map((label, index) => (
              <span key={`${label}-${index}`} className="calendar__weekday">
                {label}
              </span>
            ))}
            {grid.map((day) => {
              const dayEvents = byDay.get(dayIndex(day)) ?? [];
              const classes = [
                'calendar__day',
                isSameMonth(day, month) ? '' : 'calendar__day--outside',
                isToday(day) ? 'calendar__day--today' : '',
                isSameDay(day, selected) ? 'calendar__day--selected' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={classes}
                  onClick={() => setSelected(day)}
                  aria-label={formatDateTime(day.toISOString(), locale)}
                  aria-pressed={isSameDay(day, selected)}
                >
                  <span>{day.getDate()}</span>
                  {dayEvents.length > 0 ? (
                    <span className="calendar__dots" aria-hidden="true">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span key={event.interview.id} className="calendar__dot" />
                      ))}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2 className="panel__title">{formatDate(selected, locale)}</h2>
          </div>
          {events.length === 0 ? (
            <p className="muted small">{t('calendar.noEvents')}</p>
          ) : selectedEvents.length === 0 ? (
            <p className="muted small">{t('calendar.noEvents')}</p>
          ) : (
            <div className="event-list">
              {selectedEvents.map(({ application, interview }) => (
                <button
                  key={interview.id}
                  type="button"
                  className="event"
                  onClick={() => navigate(`/applications/${application.id}`)}
                >
                  <span className="event__date">
                    <strong>{new Date(interview.scheduledAt).getDate()}</strong>
                    {monthShort(interview.scheduledAt, locale)}
                  </span>
                  <span className="event__body">
                    <span className="event__title">{application.company}</span>
                    <span className="event__meta">
                      {application.position} · {formatTime(interview.scheduledAt, locale)}
                      {interview.round ? ` · ${interview.round}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {events.length === 0 ? (
        <div className="panel panel--spaced">
          <EmptyState
            icon={<CalendarDays size={22} />}
            title={t('dashboard.noUpcoming')}
            body={t('calendar.selectDay')}
            action={
              <button type="button" className="button button--ghost" onClick={() => navigate('/applications')}>
                {t('nav.applications')}
              </button>
            }
          />
        </div>
      ) : (
        <div className="calendar-lists">
          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">{t('calendar.upcoming')}</h2>
            </div>
            {upcoming.length === 0 ? (
              <p className="muted small">{t('dashboard.noUpcoming')}</p>
            ) : (
              <ul className="mini-list">
                {upcoming.map(({ application, interview }) => (
                  <li key={interview.id}>
                    <button type="button" className="link-button" onClick={() => navigate(`/applications/${application.id}`)}>
                      {application.company}
                    </button>
                    <span className="muted small">
                      {formatDateTime(interview.scheduledAt, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">{t('calendar.past')}</h2>
            </div>
            {past.length === 0 ? (
              <p className="muted small">{t('common.none')}</p>
            ) : (
              <ul className="mini-list">
                {past.map(({ application, interview }) => (
                  <li key={interview.id}>
                    <button type="button" className="link-button" onClick={() => navigate(`/applications/${application.id}`)}>
                      {application.company}
                    </button>
                    <span className="muted small">{formatDateTime(interview.scheduledAt, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
