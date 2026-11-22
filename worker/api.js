// HTTP API for CareerTrack.
// Authorization is decided here, on the server: every request must carry a
// verified Freebuff session, mutations must be same-origin, and every query is
// scoped by the session user's id (user.sub).
import { isSameOriginRequest } from '@freebuff/auth';
import * as store from './db.js';
import { ensureSchema } from './schema.js';

const STATUSES = [
  'applied',
  'under_review',
  'interview_scheduled',
  'interview_completed',
  'waiting',
  'accepted',
  'rejected',
  'withdrawn',
];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });

const error = (status, message) => json({ error: message }, status);

function text(value, max = 300) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const date = new Date(`${value.trim()}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : value.trim();
}

function timestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const APP_FIELDS = {
  position: (value) => text(value, 200),
  company: (value) => text(value, 200),
  appliedOn: (value) => dateOnly(value),
  workSchedule: (value) => (value === 'full_time' || value === 'part_time' ? value : null),
  jobDescription: (value) => text(value, 50000),
  status: (value) => (STATUSES.includes(value) ? value : null),
  jobUrl: (value) => text(value, 2000),
  companyWebsite: (value) => text(value, 2000),
  expectedSalary: (value) => text(value, 200),
  contactName: (value) => text(value, 200),
  contactEmail: (value) => text(value, 320),
  notes: (value) => text(value, 50000),
  followUpDone: (value) => Boolean(value),
};

const INTERVIEW_FIELDS = {
  scheduledAt: (value) => timestamp(value),
  round: (value) => text(value, 200),
  location: (value) => text(value, 500),
  feedback: (value) => text(value, 20000),
};

function pick(body, fields, { requireAll = false } = {}) {
  const patch = {};
  for (const [key, coerce] of Object.entries(fields)) {
    if (!(key in body)) {
      if (requireAll) return { error: `missing:${key}` };
      continue;
    }
    const value = coerce(body[key]);
    if (value === null && (key === 'position' || key === 'company' || key === 'appliedOn' || key === 'status' || key === 'scheduledAt')) {
      return { error: `invalid:${key}` };
    }
    patch[key] = value;
  }
  return { patch };
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function handleApi(request, env, auth) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/health') {
    // Idempotent schema initialisation, so the first signed-in request never
    // meets an empty database. Reports only the readiness, never data.
    let schema = 'missing';
    let schemaError = null;
    let tables = [];
    if (env.DB) {
      try {
        await ensureSchema(env.DB);
        schema = 'ready';
        const result = await env.DB.prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('applications','interviews') ORDER BY name"
        ).all();
        tables = (result.results ?? []).map((row) => row.name);
      } catch (caught) {
        schema = 'error';
        schemaError = String(caught?.message ?? caught).slice(0, 300);
      }
    }
    return json({ cloud: true, db: Boolean(env.DB), schema, tables, schemaError });
  }

  if (MUTATING.has(method) && !isSameOriginRequest(request, env.APP_ORIGIN)) {
    return error(403, 'cross-origin request refused');
  }

  const user = await auth.getUser(request);
  if (!user) return error(401, 'sign in required');
  if (!env.DB) return error(503, 'database unavailable');

  await ensureSchema(env.DB);

  const userId = user.sub;

  if (path === '/api/me' && method === 'GET') {
    return json({ user: { sub: user.sub, name: user.name ?? null, email: user.email ?? null, picture: user.picture ?? null } });
  }

  if (path === '/api/data' && method === 'GET') {
    const [applications, interviews] = await Promise.all([
      store.listApplications(env.DB, userId),
      store.listInterviews(env.DB, userId),
    ]);
    const byApplication = new Map();
    for (const interview of interviews) {
      const bucket = byApplication.get(interview.applicationId) ?? [];
      bucket.push(interview);
      byApplication.set(interview.applicationId, bucket);
    }
    return json({
      applications: applications.map((application) => ({
        ...application,
        interviews: byApplication.get(application.id) ?? [],
      })),
    });
  }

  if (path === '/api/applications' && method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error(400, 'invalid json');
    }
    const { patch, error: invalid } = pick(body, APP_FIELDS, { requireAll: false });
    if (invalid) return error(400, invalid);
    if (!patch.position || !patch.company || !patch.appliedOn) return error(400, 'missing required fields');

    const application = await store.insertApplication(env.DB, userId, {
      position: patch.position,
      company: patch.company,
      appliedOn: patch.appliedOn,
      workSchedule: patch.workSchedule ?? null,
      jobDescription: patch.jobDescription ?? null,
      status: patch.status ?? 'applied',
      jobUrl: patch.jobUrl ?? null,
      companyWebsite: patch.companyWebsite ?? null,
      expectedSalary: patch.expectedSalary ?? null,
      contactName: patch.contactName ?? null,
      contactEmail: patch.contactEmail ?? null,
      notes: patch.notes ?? null,
      followUpDone: Boolean(patch.followUpDone),
    });
    return json({ application }, 201);
  }

  const appMatch = /^\/api\/applications\/([\w-]{8,64})$/.exec(path);
  if (appMatch) {
    const id = appMatch[1];

    if (method === 'PATCH') {
      let body;
      try {
        body = await request.json();
      } catch {
        return error(400, 'invalid json');
      }
      const { patch, error: invalid } = pick(body, APP_FIELDS);
      if (invalid) return error(400, invalid);
      if (Object.keys(patch).length === 0) return error(400, 'nothing to update');
      const application = await store.updateApplication(env.DB, id, userId, patch);
      if (!application) return error(404, 'not found');
      return json({ application });
    }

    if (method === 'DELETE') {
      await store.deleteApplication(env.DB, id, userId);
      return json({ ok: true });
    }

    if (method === 'GET') {
      const application = await store.getApplication(env.DB, id, userId);
      if (!application) return error(404, 'not found');
      return json({ application });
    }
  }

  const interviewCreateMatch = /^\/api\/applications\/([\w-]{8,64})\/interviews$/.exec(path);
  if (interviewCreateMatch && method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error(400, 'invalid json');
    }
    const { patch, error: invalid } = pick(body, INTERVIEW_FIELDS);
    if (invalid) return error(400, invalid);
    if (!patch.scheduledAt) return error(400, 'invalid:scheduledAt');
    const interview = await store.insertInterview(env.DB, userId, interviewCreateMatch[1], patch);
    if (!interview) return error(404, 'application not found');
    return json({ interview }, 201);
  }

  const interviewMatch = /^\/api\/interviews\/([\w-]{8,64})$/.exec(path);
  if (interviewMatch) {
    const id = interviewMatch[1];
    if (method === 'PATCH') {
      let body;
      try {
        body = await request.json();
      } catch {
        return error(400, 'invalid json');
      }
      const { patch, error: invalid } = pick(body, INTERVIEW_FIELDS);
      if (invalid) return error(400, invalid);
      if (Object.keys(patch).length === 0) return error(400, 'nothing to update');
      const interview = await store.updateInterview(env.DB, id, userId, patch);
      if (!interview) return error(404, 'not found');
      return json({ interview });
    }
    if (method === 'DELETE') {
      await store.deleteInterview(env.DB, id, userId);
      return json({ ok: true });
    }
  }

  if (path === '/api/data/replace' && method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error(400, 'invalid json');
    }
    if (!Array.isArray(body?.applications)) return error(400, 'applications array required');
    if (body.applications.length > 2000) return error(400, 'too many applications');

    const items = [];
    for (const entry of body.applications) {
      if (!entry || typeof entry !== 'object') continue;
      const { patch } = pick(entry, APP_FIELDS);
      if (!patch.position || !patch.company || !patch.appliedOn) continue;
      const interviews = [];
      if (Array.isArray(entry.interviews)) {
        for (const raw of entry.interviews) {
          if (!raw || typeof raw !== 'object') continue;
          const { patch: interviewPatch } = pick(raw, INTERVIEW_FIELDS);
          if (interviewPatch.scheduledAt) interviews.push(interviewPatch);
        }
      }
      items.push({
        application: {
          position: patch.position,
          company: patch.company,
          appliedOn: patch.appliedOn,
          workSchedule: patch.workSchedule ?? null,
          jobDescription: patch.jobDescription ?? null,
          status: patch.status ?? 'applied',
          jobUrl: patch.jobUrl ?? null,
          companyWebsite: patch.companyWebsite ?? null,
          expectedSalary: patch.expectedSalary ?? null,
          contactName: patch.contactName ?? null,
          contactEmail: patch.contactEmail ?? null,
          notes: patch.notes ?? null,
          followUpDone: Boolean(patch.followUpDone),
        },
        interviews,
      });
    }

    if (items.length === 0) return error(400, 'no valid applications');

    await store.replaceAll(env.DB, userId, items);
    const [applications, interviews] = await Promise.all([
      store.listApplications(env.DB, userId),
      store.listInterviews(env.DB, userId),
    ]);
    const byApplication = new Map();
    for (const interview of interviews) {
      const bucket = byApplication.get(interview.applicationId) ?? [];
      bucket.push(interview);
      byApplication.set(interview.applicationId, bucket);
    }
    return json({
      applications: applications.map((application) => ({
        ...application,
        interviews: byApplication.get(application.id) ?? [],
      })),
    });
  }

  return error(404, 'not found');
}
