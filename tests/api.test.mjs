// End-to-end HTTP API test for the Worker's API handler.
// Two distinct identities (Alice and Bob) are injected through a stub auth
// object, because the real session cookie can only come from a Freebuff
// sign-in. Everything else is the production code path: handleApi() with its
// authorization gates, validation and the real D1 statements.
import assert from 'node:assert/strict';
import { handleApi } from '../worker/api.js';
import { applySchema } from '../worker/schema.js';
import { TestDatabase } from './sqlite-adapter.mjs';

const ORIGIN = 'https://app.test';
const db = new TestDatabase();
await applySchema(db);

const users = {
  alice: { sub: 'user-alice', name: 'Alice', email: 'alice@example.test' },
  bob: { sub: 'user-bob', name: 'Bob', email: 'bob@example.test' },
};

// Stub of the Freebuff auth instance: getUser() returns the identity named by
// the x-test-user header, and null otherwise.
const auth = {
  async getUser(request) {
    const actor = request.headers.get('x-test-user');
    return users[actor] ?? null;
  },
};

const env = { DB: db, APP_ORIGIN: ORIGIN };

function call(path, { method = 'GET', actor = null, body, origin = ORIGIN } = {}) {
  const headers = {};
  if (actor) headers['x-test-user'] = actor;
  if (origin) headers.origin = origin;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const request = new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handleApi(request, env, auth);
}

const results = [];
const check = (name, fn) => {
  fn();
  results.push(name);
};

// --- Authorization gates ----------------------------------------------------
const anonymous = await call('/api/data');
check('unauthenticated data request is 401', () => assert.equal(anonymous.status, 401));

const anonymousWrite = await call('/api/applications', {
  method: 'POST',
  body: { position: 'x', company: 'y', appliedOn: '2026-11-01' },
});
check('unauthenticated write is 401', () => assert.equal(anonymousWrite.status, 401));

const afterAnonymous = await (await call('/api/data', { actor: 'alice' })).json();
check('anonymous write stored nothing', () => {
  assert.deepEqual(afterAnonymous.applications, []);
});

const foreignOrigin = await call('/api/applications', {
  method: 'POST',
  actor: 'alice',
  origin: 'https://evil.test',
  body: { position: 'x', company: 'y', appliedOn: '2026-11-01' },
});
check('cross-origin mutation is 403', () => assert.equal(foreignOrigin.status, 403));

// --- Create and read --------------------------------------------------------
const created = await call('/api/applications', {
  method: 'POST',
  actor: 'alice',
  body: {
    position: 'Frontend Developer',
    company: 'Alice Corp',
    appliedOn: '2026-11-01',
    status: 'applied',
    workSchedule: 'full_time',
    notes: 'private note',
  },
});
const createdBody = await created.json();
check('alice can create an application', () => {
  assert.equal(created.status, 201);
  assert.ok(createdBody.application?.id);
  assert.equal(createdBody.application.company, 'Alice Corp');
});
const aliceAppId = createdBody.application.id;

const aliceData = await (await call('/api/data', { actor: 'alice' })).json();
const bobData = await (await call('/api/data', { actor: 'bob' })).json();
check('alice sees exactly her application', () => {
  assert.equal(aliceData.applications.length, 1);
  assert.equal(aliceData.applications[0].id, aliceAppId);
});
check('bob sees nothing of alice’s data', () => {
  assert.deepEqual(bobData.applications, []);
});

// --- Validation -------------------------------------------------------------
const missingCompany = await call('/api/applications', {
  method: 'POST',
  actor: 'alice',
  body: { position: 'No company', appliedOn: '2026-11-02' },
});
check('missing required fields is 400', () => assert.equal(missingCompany.status, 400));

const badDate = await call('/api/applications', {
  method: 'POST',
  actor: 'alice',
  body: { position: 'x', company: 'y', appliedOn: 'not-a-date' },
});
check('invalid date is 400', () => assert.equal(badDate.status, 400));

const badStatus = await call(`/api/applications/${aliceAppId}`, {
  method: 'PATCH',
  actor: 'alice',
  body: { status: 'bogus' },
});
check('unknown status is rejected', () => assert.equal(badStatus.status, 400));

// --- Isolation on single resources -----------------------------------------
const bobRead = await call(`/api/applications/${aliceAppId}`, { actor: 'bob' });
check('bob cannot read alice’s application by id', () => assert.equal(bobRead.status, 404));

const bobPatch = await call(`/api/applications/${aliceAppId}`, {
  method: 'PATCH',
  actor: 'bob',
  body: { company: 'HACKED' },
});
check('bob cannot update alice’s application', () => assert.equal(bobPatch.status, 404));

await call(`/api/applications/${aliceAppId}`, { method: 'DELETE', actor: 'bob' });
const aliceStill = await (await call('/api/data', { actor: 'alice' })).json();
check('bob cannot delete alice’s application', () => {
  assert.equal(aliceStill.applications.length, 1);
  assert.equal(aliceStill.applications[0].company, 'Alice Corp');
});

// --- Interviews -------------------------------------------------------------
const interview = await call(`/api/applications/${aliceAppId}/interviews`, {
  method: 'POST',
  actor: 'alice',
  body: { scheduledAt: '2026-11-20T10:00:00.000Z', round: 'Technical' },
});
const interviewBody = await interview.json();
check('alice can add an interview', () => {
  assert.equal(interview.status, 201);
  assert.ok(interviewBody.interview?.id);
});
const interviewId = interviewBody.interview.id;

const aliceWithInterview = await (await call('/api/data', { actor: 'alice' })).json();
check('interviews come back nested under the application', () => {
  assert.equal(aliceWithInterview.applications[0].interviews.length, 1);
  assert.equal(aliceWithInterview.applications[0].interviews[0].round, 'Technical');
});

const bobInterviewPatch = await call(`/api/interviews/${interviewId}`, {
  method: 'PATCH',
  actor: 'bob',
  body: { round: 'HACKED' },
});
check('bob cannot modify alice’s interview', () => assert.equal(bobInterviewPatch.status, 404));

const bobInterviewDelete = await call(`/api/interviews/${interviewId}`, { method: 'DELETE', actor: 'bob' });
check('bob cannot delete alice’s interview', () => assert.equal(bobInterviewDelete.status, 200));
const afterBobDelete = await (await call('/api/data', { actor: 'alice' })).json();
check('alice’s interview survived bob’s delete', () => {
  assert.equal(afterBobDelete.applications[0].interviews.length, 1);
});

const aliceInterviewUpdate = await call(`/api/interviews/${interviewId}`, {
  method: 'PATCH',
  actor: 'alice',
  body: { feedback: 'went well' },
});
const updatedInterview = await aliceInterviewUpdate.json();
check('alice can update her own interview', () => {
  assert.equal(aliceInterviewUpdate.status, 200);
  assert.equal(updatedInterview.interview.feedback, 'went well');
});

// --- Bob has his own separate workspace ------------------------------------
const bobCreated = await call('/api/applications', {
  method: 'POST',
  actor: 'bob',
  body: { position: 'Data Analyst', company: 'Bob Ltd', appliedOn: '2026-11-05' },
});
const bobCreatedBody = await bobCreated.json();
check('bob can create his own application', () => assert.equal(bobCreated.status, 201));

const aliceFinal = await (await call('/api/data', { actor: 'alice' })).json();
const bobFinal = await (await call('/api/data', { actor: 'bob' })).json();
check('the two accounts never see each other’s rows', () => {
  assert.deepEqual(aliceFinal.applications.map((a) => a.company), ['Alice Corp']);
  assert.deepEqual(bobFinal.applications.map((a) => a.company), ['Bob Ltd']);
  assert.notEqual(aliceFinal.applications[0].id, bobCreatedBody.application.id);
});

// --- Backup replace is scoped ----------------------------------------------
const replaced = await call('/api/data/replace', {
  method: 'POST',
  actor: 'alice',
  body: {
    applications: [
      {
        position: 'Designer',
        company: 'Alice New Co',
        appliedOn: '2026-11-10',
        notes: null,
        interviews: [{ scheduledAt: '2026-11-25T08:00:00.000Z', round: 'Final' }],
      },
    ],
  },
});
const replacedBody = await replaced.json();
check('alice can replace her own dataset', () => {
  assert.equal(replaced.status, 200);
  assert.deepEqual(replacedBody.applications.map((a) => a.company), ['Alice New Co']);
  assert.equal(replacedBody.applications[0].interviews.length, 1);
});

const bobAfterReplace = await (await call('/api/data', { actor: 'bob' })).json();
check('alice’s replace did not touch bob’s data', () => {
  assert.deepEqual(bobAfterReplace.applications.map((a) => a.company), ['Bob Ltd']);
});

const emptyReplace = await call('/api/data/replace', {
  method: 'POST',
  actor: 'alice',
  body: { applications: [] },
});
check('an empty backup is refused instead of wiping data', () => assert.equal(emptyReplace.status, 400));

console.log(`\n${results.length}/${results.length} API checks passed:`);
for (const name of results) console.log(`  ✓ ${name}`);
