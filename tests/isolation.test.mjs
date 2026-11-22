// Two-user data-isolation test.
// Runs the exact query functions the Worker uses (worker/db.js) against a real
// SQLite database with the production schema, and proves that one user can
// never read, update or delete another user's rows.
import assert from 'node:assert/strict';
import { SCHEMA_STATEMENTS } from '../worker/schema.js';
import * as store from '../worker/db.js';
import { TestDatabase } from './sqlite-adapter.mjs';

const db = new TestDatabase();
for (const statement of SCHEMA_STATEMENTS) await db.exec(statement);

const ALICE = 'user-alice';
const BOB = 'user-bob';

const results = [];
const check = (name, fn) => {
  fn();
  results.push(name);
};

// --- Alice and Bob each create an application with an interview ------------
const aliceApp = await store.insertApplication(db, ALICE, {
  position: 'Frontend Developer',
  company: 'Alice Corp',
  appliedOn: '2026-11-01',
  status: 'applied',
  notes: 'alice private note',
});

const bobApp = await store.insertApplication(db, BOB, {
  position: 'Data Analyst',
  company: 'Bob Ltd',
  appliedOn: '2026-11-05',
  status: 'under_review',
  notes: 'bob private note',
});

const aliceInterview = await store.insertInterview(db, ALICE, aliceApp.id, {
  scheduledAt: '2026-11-20T10:00:00.000Z',
  round: 'Technical',
});
const bobInterview = await store.insertInterview(db, BOB, bobApp.id, {
  scheduledAt: '2026-11-21T11:00:00.000Z',
  round: 'HR',
});

check('both users were provisioned', () => {
  assert.ok(aliceApp?.id && bobApp?.id);
  assert.notEqual(aliceApp.id, bobApp.id);
  assert.ok(aliceInterview?.id && bobInterview?.id);
});

// --- Reads are scoped -------------------------------------------------------
const aliceList = await store.listApplications(db, ALICE);
const bobList = await store.listApplications(db, BOB);
check('list returns only the caller’s applications', () => {
  assert.deepEqual(aliceList.map((a) => a.company), ['Alice Corp']);
  assert.deepEqual(bobList.map((a) => a.company), ['Bob Ltd']);
});

const aliceInterviews = await store.listInterviews(db, ALICE);
check('listInterviews returns only the caller’s interviews', () => {
  assert.deepEqual(aliceInterviews.map((i) => i.round), ['Technical']);
});

const crossRead = await store.getApplication(db, bobApp.id, ALICE);
check('cross-user read is denied', () => {
  assert.equal(crossRead, null);
});

// --- Cross-user writes are no-ops ------------------------------------------
await store.updateApplication(db, bobApp.id, ALICE, { company: 'HACKED', notes: 'hacked' });
const bobAfterAttack = await store.getApplication(db, bobApp.id, BOB);
check('cross-user update is denied', () => {
  assert.equal(bobAfterAttack.company, 'Bob Ltd');
  assert.equal(bobAfterAttack.notes, 'bob private note');
});

await store.deleteApplication(db, bobApp.id, ALICE);
const bobStillThere = await store.getApplication(db, bobApp.id, BOB);
check('Bob’s application survived Alice’s delete attempt', () => {
  assert.ok(bobStillThere);
});

const hijack = await store.insertInterview(db, ALICE, bobApp.id, {
  scheduledAt: '2026-12-01T09:00:00.000Z',
  round: 'Injected',
});
check('cannot attach an interview to another user’s application', () => {
  assert.equal(hijack, null);
});

const crossUpdate = await store.updateInterview(db, bobInterview.id, ALICE, { round: 'Hacked' });
check('cross-user interview update is denied', () => {
  assert.equal(crossUpdate, null);
});
const bobInterviewAfter = (await store.listInterviews(db, BOB)).find((i) => i.id === bobInterview.id);
check('Bob’s interview was not modified', () => {
  assert.equal(bobInterviewAfter.round, 'HR');
});

await store.deleteInterview(db, bobInterview.id, ALICE);
const bobInterviewStill = (await store.listInterviews(db, BOB)).find((i) => i.id === bobInterview.id);
check('cross-user interview delete is denied', () => {
  assert.ok(bobInterviewStill);
});

// --- replaceAll is scoped ---------------------------------------------------
await store.replaceAll(db, ALICE, [
  {
    application: {
      position: 'Designer',
      company: 'Alice New Co',
      appliedOn: '2026-11-10',
      status: 'accepted',
      notes: null,
    },
    interviews: [{ scheduledAt: '2026-11-25T08:00:00.000Z', round: 'Final' }],
  },
]);
const aliceAfterReplace = await store.listApplications(db, ALICE);
const bobAfterReplace = await store.listApplications(db, BOB);
check('replaceAll only replaces the caller’s data', () => {
  assert.deepEqual(aliceAfterReplace.map((a) => a.company), ['Alice New Co']);
  assert.deepEqual(bobAfterReplace.map((a) => a.company), ['Bob Ltd']);
});
const bobInterviewsAfterReplace = await store.listInterviews(db, BOB);
check('replaceAll did not touch the other user’s interviews', () => {
  assert.equal(bobInterviewsAfterReplace.length, 1);
  assert.equal(bobInterviewsAfterReplace[0].round, 'HR');
});

// --- Own deletes cascade to that user’s interviews --------------------------
await store.deleteApplication(db, aliceAfterReplace[0].id, ALICE);
const aliceInterviewsAfterDelete = await store.listInterviews(db, ALICE);
const bobInterviewsAfterDelete = await store.listInterviews(db, BOB);
check('deleting an application removes its own interviews only', () => {
  assert.equal(aliceInterviewsAfterDelete.length, 0);
  assert.equal(bobInterviewsAfterDelete.length, 1);
});

// --- Schema-level constraints ----------------------------------------------
check('status CHECK constraint rejects unknown values', () => {
  assert.throws(() => {
    db.db
      .prepare(
        `INSERT INTO applications (id, user_id, position, company, applied_on, status, created_at, updated_at)
         VALUES ('x', 'user-x', 'p', 'c', '2026-01-01', 'bogus', 'now', 'now')`
      )
      .run();
  });
});

// --- Database-level ownership guards ---------------------------------------
// Even a raw SQL write that bypasses the API cannot attach or move rows across
// accounts: the triggers added to the production schema abort it.
check('raw SQL cannot attach an interview to another user’s application', () => {
  assert.throws(() => {
    db.db
      .prepare(
        `INSERT INTO interviews (id, application_id, user_id, scheduled_at, created_at)
         VALUES ('attack-1', ?, 'user-mallory', '2026-12-01T09:00:00.000Z', 'now')`
      )
      .run(bobApp.id);
  });
});

check('raw SQL cannot re-assign an application to another user', () => {
  assert.throws(() => {
    db.db.prepare('UPDATE applications SET user_id = ? WHERE id = ?').run('user-mallory', bobApp.id);
  });
});

check('raw SQL cannot re-assign an interview to another user', () => {
  assert.throws(() => {
    db.db.prepare('UPDATE interviews SET user_id = ? WHERE id = ?').run('user-mallory', bobInterview.id);
  });
});

const bobUntouched = await store.getApplication(db, bobApp.id, BOB);
const bobInterviewUntouched = (await store.listInterviews(db, BOB)).find((i) => i.id === bobInterview.id);
check('the guarded rows still belong to their owner', () => {
  assert.equal(bobUntouched.company, 'Bob Ltd');
  assert.equal(bobInterviewUntouched.round, 'HR');
});

console.log(`\n${results.length}/${results.length} isolation checks passed:`);
for (const name of results) console.log(`  ✓ ${name}`);
