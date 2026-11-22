// Schema for the CareerTrack D1 (SQLite) database.
// Applied idempotently by the Worker on first API use, so no external
// migration tooling or database credentials are required.

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    position TEXT NOT NULL,
    company TEXT NOT NULL,
    applied_on TEXT NOT NULL,
    work_schedule TEXT,
    job_description TEXT,
    status TEXT NOT NULL DEFAULT 'applied'
      CHECK (status IN ('applied','under_review','interview_scheduled','interview_completed',
                        'waiting','accepted','rejected','withdrawn')),
    job_url TEXT,
    company_website TEXT,
    expected_salary TEXT,
    contact_name TEXT,
    contact_email TEXT,
    notes TEXT,
    follow_up_done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS applications_user_applied
     ON applications (user_id, applied_on DESC)`,
  `CREATE TABLE IF NOT EXISTS interviews (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    round TEXT,
    location TEXT,
    feedback TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS interviews_user_scheduled
     ON interviews (user_id, scheduled_at)`,
  `CREATE INDEX IF NOT EXISTS interviews_application
     ON interviews (application_id)`,
  // Database-level ownership guards (defence in depth): the API already scopes
  // every statement by user_id, and these triggers make a cross-tenant row
  // impossible even if a future query forgot the WHERE clause.
  `CREATE TRIGGER IF NOT EXISTS applications_user_id_immutable
   BEFORE UPDATE OF user_id ON applications
   FOR EACH ROW
   WHEN NEW.user_id <> OLD.user_id
   BEGIN
     SELECT RAISE(ABORT, 'applications.user_id is immutable');
   END`,
  `CREATE TRIGGER IF NOT EXISTS interviews_owner_insert
   BEFORE INSERT ON interviews
   FOR EACH ROW
   WHEN NOT EXISTS (
     SELECT 1 FROM applications WHERE id = NEW.application_id AND user_id = NEW.user_id
   )
   BEGIN
     SELECT RAISE(ABORT, 'interview must belong to an application owned by the same user');
   END`,
  `CREATE TRIGGER IF NOT EXISTS interviews_owner_update
   BEFORE UPDATE OF application_id, user_id ON interviews
   FOR EACH ROW
   WHEN NOT EXISTS (
     SELECT 1 FROM applications WHERE id = NEW.application_id AND user_id = NEW.user_id
   )
   BEGIN
     SELECT RAISE(ABORT, 'interview must belong to an application owned by the same user');
   END`,
  `CREATE TRIGGER IF NOT EXISTS interviews_user_id_immutable
   BEFORE UPDATE OF user_id ON interviews
   FOR EACH ROW
   WHEN NEW.user_id <> OLD.user_id
   BEGIN
     SELECT RAISE(ABORT, 'interviews.user_id is immutable');
   END`,
];

export async function applySchema(db) {
  // Statement-by-statement through prepare().run(): the most predictable path
  // across D1 and Miniflare (exec() behaves differently between the two).
  for (const statement of SCHEMA_STATEMENTS) {
    await db.prepare(statement).run();
  }
}

let schemaPromise = null;

/** Runs the (idempotent) schema once per isolate and reuses the promise. */
export function ensureSchema(db) {
  if (!schemaPromise) {
    schemaPromise = applySchema(db).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}
