// Data access for CareerTrack.
// Every statement that reads or writes user data is scoped by `user_id`,
// which always comes from the verified session (never from the request body).

export function mapApplication(row) {
  return {
    id: row.id,
    position: row.position,
    company: row.company,
    appliedOn: row.applied_on,
    workSchedule: row.work_schedule ?? null,
    jobDescription: row.job_description ?? null,
    status: row.status,
    jobUrl: row.job_url ?? null,
    companyWebsite: row.company_website ?? null,
    expectedSalary: row.expected_salary ?? null,
    contactName: row.contact_name ?? null,
    contactEmail: row.contact_email ?? null,
    notes: row.notes ?? null,
    followUpDone: Boolean(row.follow_up_done),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapInterview(row) {
  return {
    id: row.id,
    applicationId: row.application_id,
    scheduledAt: row.scheduled_at,
    round: row.round ?? null,
    location: row.location ?? null,
    feedback: row.feedback ?? null,
  };
}

const APP_COLUMNS = {
  position: 'position',
  company: 'company',
  appliedOn: 'applied_on',
  workSchedule: 'work_schedule',
  jobDescription: 'job_description',
  status: 'status',
  jobUrl: 'job_url',
  companyWebsite: 'company_website',
  expectedSalary: 'expected_salary',
  contactName: 'contact_name',
  contactEmail: 'contact_email',
  notes: 'notes',
  followUpDone: 'follow_up_done',
};

const INTERVIEW_COLUMNS = {
  scheduledAt: 'scheduled_at',
  round: 'round',
  location: 'location',
  feedback: 'feedback',
};

function toSqlValue(key, value) {
  if (key === 'followUpDone') return value ? 1 : 0;
  return value ?? null;
}

export async function listApplications(db, userId) {
  const { results } = await db
    .prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY applied_on DESC, created_at DESC')
    .bind(userId)
    .all();
  return (results ?? []).map(mapApplication);
}

export async function listInterviews(db, userId) {
  const { results } = await db
    .prepare('SELECT * FROM interviews WHERE user_id = ? ORDER BY scheduled_at ASC')
    .bind(userId)
    .all();
  return (results ?? []).map(mapInterview);
}

export async function getApplication(db, id, userId) {
  const row = await db
    .prepare('SELECT * FROM applications WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first();
  return row ? mapApplication(row) : null;
}

export async function insertApplication(db, userId, input) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO applications
        (id, user_id, position, company, applied_on, work_schedule, job_description, status,
         job_url, company_website, expected_salary, contact_name, contact_email, notes,
         follow_up_done, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      input.position,
      input.company,
      input.appliedOn,
      input.workSchedule ?? null,
      input.jobDescription ?? null,
      input.status ?? 'applied',
      input.jobUrl ?? null,
      input.companyWebsite ?? null,
      input.expectedSalary ?? null,
      input.contactName ?? null,
      input.contactEmail ?? null,
      input.notes ?? null,
      input.followUpDone ? 1 : 0,
      now,
      now
    )
    .run();
  return getApplication(db, id, userId);
}

export async function updateApplication(db, id, userId, patch) {
  const assignments = [];
  const values = [];
  for (const [key, column] of Object.entries(APP_COLUMNS)) {
    if (!(key in patch)) continue;
    assignments.push(`${column} = ?`);
    values.push(toSqlValue(key, patch[key]));
  }
  if (assignments.length === 0) return getApplication(db, id, userId);

  assignments.push('updated_at = ?');
  values.push(new Date().toISOString());

  await db
    .prepare(`UPDATE applications SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`)
    .bind(...values, id, userId)
    .run();

  return getApplication(db, id, userId);
}

export async function deleteApplication(db, id, userId) {
  await db.batch([
    db.prepare('DELETE FROM interviews WHERE application_id = ? AND user_id = ?').bind(id, userId),
    db.prepare('DELETE FROM applications WHERE id = ? AND user_id = ?').bind(id, userId),
  ]);
  return true;
}

export async function insertInterview(db, userId, applicationId, input) {
  const owned = await db
    .prepare('SELECT id FROM applications WHERE id = ? AND user_id = ?')
    .bind(applicationId, userId)
    .first();
  if (!owned) return null;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO interviews (id, application_id, user_id, scheduled_at, round, location, feedback, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      applicationId,
      userId,
      input.scheduledAt,
      input.round ?? null,
      input.location ?? null,
      input.feedback ?? null,
      now
    )
    .run();

  const row = await db.prepare('SELECT * FROM interviews WHERE id = ? AND user_id = ?').bind(id, userId).first();
  return row ? mapInterview(row) : null;
}

export async function updateInterview(db, id, userId, patch) {
  const assignments = [];
  const values = [];
  for (const [key, column] of Object.entries(INTERVIEW_COLUMNS)) {
    if (!(key in patch)) continue;
    assignments.push(`${column} = ?`);
    values.push(patch[key] ?? null);
  }
  if (assignments.length === 0) return null;

  await db
    .prepare(`UPDATE interviews SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`)
    .bind(...values, id, userId)
    .run();

  const row = await db.prepare('SELECT * FROM interviews WHERE id = ? AND user_id = ?').bind(id, userId).first();
  return row ? mapInterview(row) : null;
}

export async function deleteInterview(db, id, userId) {
  await db.prepare('DELETE FROM interviews WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return true;
}

/** Replaces every record of this user only. Other users' rows are untouched. */
export async function replaceAll(db, userId, items) {
  const statements = [
    db.prepare('DELETE FROM interviews WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM applications WHERE user_id = ?').bind(userId),
  ];

  const now = new Date().toISOString();
  const created = [];

  for (const item of items) {
    const app = item.application;
    const appId = crypto.randomUUID();
    created.push({ appId, application: app, interviews: item.interviews ?? [] });
    statements.push(
      db
        .prepare(
          `INSERT INTO applications
            (id, user_id, position, company, applied_on, work_schedule, job_description, status,
             job_url, company_website, expected_salary, contact_name, contact_email, notes,
             follow_up_done, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          appId,
          userId,
          app.position,
          app.company,
          app.appliedOn,
          app.workSchedule ?? null,
          app.jobDescription ?? null,
          app.status ?? 'applied',
          app.jobUrl ?? null,
          app.companyWebsite ?? null,
          app.expectedSalary ?? null,
          app.contactName ?? null,
          app.contactEmail ?? null,
          app.notes ?? null,
          app.followUpDone ? 1 : 0,
          now,
          now
        )
    );
  }

  for (const entry of created) {
    for (const interview of entry.interviews) {
      statements.push(
        db
          .prepare(
            `INSERT INTO interviews (id, application_id, user_id, scheduled_at, round, location, feedback, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            entry.appId,
            userId,
            interview.scheduledAt,
            interview.round ?? null,
            interview.location ?? null,
            interview.feedback ?? null,
            now
          )
      );
    }
  }

  await db.batch(statements);
  return true;
}
