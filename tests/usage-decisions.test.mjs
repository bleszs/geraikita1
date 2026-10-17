import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../server/store.mjs';
import { createService } from '../server/service.mjs';
import { createIdentity } from '../server/identity.mjs';
import { createApp } from '../server/http.mjs';
import { createExtractor } from '../server/extractor.mjs';
import { addDays, dayAt, units } from '../server/common.mjs';

const registration = extra => ({ businessName: 'Contract review', communityName: 'Contract group', email: randomUUID() + '@example.test', password: 'Contract-review-password-456', ...extra });
function fixture(t, { history = true } = {}) {
  const store = createStore(':memory:'); t.after(() => store.close());
  const service = createService(store), identity = createIdentity(store), owner = identity.register(registration());
  const ingredient = service.saveIngredient(owner, null, { name: 'Contract ingredient', unit: 'kg', min: 0, storageNote: '', catalogRevision: 1 });
  if (history) for (let i = 0; i < 84; i++) store.run('INSERT INTO daily_usage VALUES(?,?,?,?,?)', owner.workspace_id, owner.business_id, ingredient.id, addDays(dayAt(), i - 84), units(i === 83 ? 60 : 10));
  const date = addDays(dayAt(), -1);
  const row = () => service.bootstrap(owner).usageReviews[0].dates.find(row => row.date === date);
  const body = () => ({ productId: ingredient.id, date, snapshotHash: row().snapshotHash, expectedReviewId: row().saved?.id ?? null,
    idempotencyKey: randomUUID(), decision: 'checked', note: 'Contract note only', confirmed: true });
  return { store, service, identity, owner, ingredient, date, row, body };
}
const snapshot = store => store.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map(({ name }) => [name, store.all('SELECT * FROM "' + name + '"')]);

test('empty account exposes no editable dates and never creates implicit review decisions', t => {
  const f = fixture(t, { history: false }), before = snapshot(f.store);
  assert.deepEqual(f.service.bootstrap(f.owner).usageReviews, [{ productId: f.ingredient.id, dates: [] }]);
  assert.deepEqual(snapshot(f.store), before);
});

test('owner review is append-only, persists notes and leaves forecast, stock and ledger unchanged', t => {
  const f = fixture(t), before = f.service.bootstrap(f.owner), beforeTables = snapshot(f.store);
  const first = f.service.saveUsageReview(f.owner, f.body()); assert.equal(first.saved, true);
  assert.equal(f.row().saved.decision, 'checked'); assert.equal(f.row().saved.needsRecheck, false);
  const second = f.service.saveUsageReview(f.owner, { ...f.body(), decision: 'follow_up', note: 'Need original receipt' });
  assert.notEqual(second.id, first.id); assert.equal(f.row().saved.note, 'Need original receipt');
  const events = f.store.all('SELECT * FROM usage_review_decisions ORDER BY rowid');
  assert.equal(events.length, 2); assert.equal(events[1].previous_id, events[0].id); assert.equal(events[0].note, 'Contract note only');
  const after = f.service.bootstrap(f.owner); assert.deepEqual(after.recommendations, before.recommendations);
  assert.deepEqual(after.stock, before.stock); assert.deepEqual(after.transactions, before.transactions);
  assert.deepEqual(snapshot(f.store).filter(([name]) => !['audit', 'usage_review_decisions'].includes(name)), beforeTables.filter(([name]) => !['audit', 'usage_review_decisions'].includes(name)));
});

test('changed target or any reference invalidates the saved review and stale forms cannot overwrite it', t => {
  const f = fixture(t), original = f.body(); f.service.saveUsageReview(f.owner, original);
  const oldForm = f.body();
  // This is a non-weekday reference; the completeness/input snapshot still changes.
  f.store.run('UPDATE daily_usage SET quantity=? WHERE workspace_id=? AND business_id=? AND product_id=? AND date=?', units(12), f.owner.workspace_id, f.owner.business_id, f.ingredient.id, addDays(f.date, -1));
  assert.equal(f.row().saved.needsRecheck, true);
  assert.throws(() => f.service.saveUsageReview(f.owner, oldForm), error => error.status === 409 && /pemakaian atau pembanding berubah/.test(error.message));
  f.service.saveUsageReview(f.owner, f.body()); assert.equal(f.row().saved.needsRecheck, false);
  f.store.run('UPDATE daily_usage SET quantity=? WHERE workspace_id=? AND business_id=? AND product_id=? AND date=?', units(5), f.owner.workspace_id, f.owner.business_id, f.ingredient.id, f.date);
  assert.equal(f.row().saved.needsRecheck, true);
});

test('reference gaps keep a stale decision visible but prevent a new completeness claim', t => {
  const f = fixture(t); f.service.saveUsageReview(f.owner, f.body());
  f.store.run('DELETE FROM daily_usage WHERE workspace_id=? AND business_id=? AND product_id=? AND date=?', f.owner.workspace_id, f.owner.business_id, f.ingredient.id, addDays(f.date, -2));
  assert.equal(f.row().screened, false); assert.equal(f.row().saved.needsRecheck, true);
  assert.throws(() => f.service.saveUsageReview(f.owner, f.body()), error => error.status === 409 && /Pembanding belum lengkap/.test(error.message));
  assert.equal(f.store.get('SELECT COUNT(*) AS n FROM usage_review_decisions').n, 1);
});

test('duplicate requests reconcile once even after ledger changes; new payloads and concurrent revisions conflict', t => {
  const f = fixture(t), payload = f.body(), stale = f.body(), first = f.service.saveUsageReview(f.owner, payload);
  assert.throws(() => f.service.saveUsageReview(f.owner, stale), error => error.status === 409 && /sesi lain/.test(error.message));
  assert.throws(() => f.service.saveUsageReview(f.owner, { ...payload, note: 'Different request' }), error => error.status === 409);
  f.store.run('UPDATE daily_usage SET quantity=? WHERE workspace_id=? AND business_id=? AND product_id=? AND date=?', units(3), f.owner.workspace_id, f.owner.business_id, f.ingredient.id, f.date);
  const repeated = f.service.saveUsageReview(f.owner, payload); assert.equal(repeated.id, first.id); assert.equal(repeated.repeated, true);
  assert.equal(f.store.get('SELECT COUNT(*) AS n FROM usage_review_decisions').n, 1);
});

test('confirmation, date, scope, note limits, decision and snapshot are validated', t => {
  const f = fixture(t);
  for (const extra of [{ confirmed: false }, { date: dayAt() }, { date: addDays(dayAt(), -29) }, { note: 'x'.repeat(501) },
    { decision: 'normal' }, { expectedReviewId: undefined }, { idempotencyKey: 'short' }, { snapshotHash: '' }]) {
    assert.throws(() => f.service.saveUsageReview(f.owner, { ...f.body(), ...extra }));
  }
  const member = f.identity.register(registration({ inviteCode: f.service.bootstrap(f.owner).community.inviteCode }));
  assert.throws(() => f.service.saveUsageReview(member, f.body()), error => error.status === 404);
  assert.equal(f.store.get('SELECT COUNT(*) AS n FROM usage_review_decisions').n, 0);
});

test('HTTP review requires login, origin and CSRF; client-supplied tenant IDs cannot override session scope', async t => {
  const app = createApp({ filename: ':memory:', extractor: createExtractor({ provider: 'rules' }), transcriber: { status: async () => ({ available: false }) } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); t.after(() => app.close());
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const post = (body, cookie, origin = base) => fetch(base + '/api/usage-reviews', { method: 'POST', headers: { 'content-type': 'application/json', origin, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  assert.equal((await post({})).status, 401);
  async function register(extra) { const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(registration(extra)) }); return { state: await response.json(), cookie: response.headers.get('set-cookie').split(';')[0] }; }
  const owner = await register(), member = await register({ inviteCode: owner.state.community.inviteCode });
  const session = { workspace_id: owner.state.workspaceId, business_id: owner.state.business.id }, ingredient = app.service.saveIngredient(session, null, { name: 'Private review', unit: 'kg', min: 0, storageNote: '', catalogRevision: 1 });
  for (let i = 0; i < 84; i++) app.store.run('INSERT INTO daily_usage VALUES(?,?,?,?,?)', session.workspace_id, session.business_id, ingredient.id, addDays(dayAt(), i - 84), units(i === 83 ? 60 : 10));
  const row = app.service.bootstrap(session).usageReviews[0].dates.at(-1), body = { productId: ingredient.id, date: row.date, snapshotHash: row.snapshotHash, expectedReviewId: null,
    decision: 'checked', note: '', confirmed: true, idempotencyKey: randomUUID(), csrf: owner.state.csrf };
  assert.equal((await post({ ...body, csrf: '' }, owner.cookie)).status, 403);
  assert.equal((await post(body, owner.cookie, 'https://other.test')).status, 403);
  assert.equal((await post({ ...body, csrf: member.state.csrf, workspaceId: session.workspace_id, businessId: session.business_id }, member.cookie)).status, 404);
  assert.equal((await post(body, owner.cookie)).status, 201);
  const response = await fetch(base + '/api/bootstrap', { headers: { cookie: member.cookie } });
  assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual((await response.json()).usageReviews, []);
});

test('additive migration preserves the previous tables and decisions survive reopen', t => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'gerai-decision-migration-')), filename = path.join(directory, 'database.sqlite');
  let store = createStore(filename);
  t.after(() => { store?.close(); const resolved = realpathSync(directory); assert.equal(path.dirname(resolved), realpathSync(os.tmpdir())); assert.ok(path.basename(resolved).startsWith('gerai-decision-migration-')); rmSync(resolved, { recursive: true, force: true }); });
  const owner = createIdentity(store).register(registration());
  store.db.exec('DROP TABLE usage_review_decisions'); const before = snapshot(store); assert.equal(before.length, 32); store.close();
  store = createStore(filename); assert.deepEqual(snapshot(store).filter(([name]) => name !== 'usage_review_decisions'), before);
  const service = createService(store), ingredient = service.saveIngredient(owner, null, { name: 'Reopen ingredient', unit: 'kg', min: 0, storageNote: '', catalogRevision: 1 });
  for (let i = 0; i < 84; i++) store.run('INSERT INTO daily_usage VALUES(?,?,?,?,?)', owner.workspace_id, owner.business_id, ingredient.id, addDays(dayAt(), i - 84), units(10));
  const row = service.bootstrap(owner).usageReviews[0].dates.at(-1);
  service.saveUsageReview(owner, { productId: ingredient.id, date: row.date, snapshotHash: row.snapshotHash, expectedReviewId: null, idempotencyKey: randomUUID(), decision: 'checked', note: 'Persisted contract', confirmed: true });
  store.close(); store = createStore(filename);
  assert.equal(createService(store).bootstrap(owner).usageReviews[0].dates.at(-1).saved.note, 'Persisted contract');
});
