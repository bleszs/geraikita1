import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, realpathSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createStore } from '../server/store.mjs';
import { createService } from '../server/service.mjs';
import { createIdentity } from '../server/identity.mjs';
import { addDays } from '../server/common.mjs';
import { exportUsageAnnotations } from '../scripts/usage-evaluation-data.mjs';
import { validateUsageDraft, targetDates, freezeUsageProtocol, evaluateUsage, summarizeUsage } from '../scripts/usage-evaluation.mjs';

// Contract fixtures live only in memory or isolated temporary files; no field scores.
const periods = { validationFrom: '2026-01-01', validationTo: '2026-01-02', testFrom: '2026-01-03', testTo: '2026-01-08' };
function draft() {
  const from = addDays(periods.validationFrom, -56), observations = [];
  for (let date = from; date <= periods.testTo; date = addDays(date, 1)) observations.push({ date, qty: 10 });
  return { schemaVersion: 1, kind: 'usage-review-labels-v1', datasetId: randomUUID(), unit: 'kg', periods: { ...periods },
    provenance: { source: 'consented_business_usage', permissionConfirmed: true, permissionReference: 'Contract permission only',
      humanAnnotated: false, blindReviewConfirmed: false, completenessReviewed: false, completenessReference: '' },
    observations, annotations: targetDates(periods).map(row => ({ ...row, label: null, recordingComplete: null, annotator: '', evidenceReference: '', context: null })) };
}
function annotate(data) {
  const result = structuredClone(data);
  Object.assign(result.provenance, { humanAnnotated: true, blindReviewConfirmed: true, completenessReviewed: true, completenessReference: 'Contract completeness only' });
  result.annotations.forEach(row => Object.assign(row, { label: 'expected', recordingComplete: true, annotator: 'reviewer-test', evidenceReference: 'Contract evidence only', context: 'unknown' }));
  return result;
}
function temporary(t, close = () => {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'gerai-usage-eval-'));
  t.after(() => {
    close(); const resolved = realpathSync(directory);
    assert.equal(path.dirname(resolved), realpathSync(os.tmpdir())); assert.ok(path.basename(resolved).startsWith('gerai-usage-eval-'));
    rmSync(resolved, { recursive: true, force: true });
  });
  return directory;
}
function database(t) {
  let store;
  const directory = temporary(t, () => store?.close()), filename = path.join(directory, 'input.sqlite');
  store = createStore(filename);
  const service = createService(store), identity = createIdentity(store);
  const owner = identity.register({ businessName: 'Contract usage', communityName: 'Contract group', email: randomUUID() + '@example.test', password: 'Contract-password-456' });
  const ingredient = service.saveIngredient(owner, null, { name: 'Contract ingredient', unit: 'kg', min: 0, storageNote: '', catalogRevision: 1 });
  const options = { filename, workspaceId: owner.workspace_id, businessId: owner.business_id, productId: ingredient.id, periods, reference: 'Contract permission only', confirmed: true };
  return { directory, filename, store, options, insert: (date, qty) => store.run('INSERT INTO daily_usage VALUES(?,?,?,?,?)', owner.workspace_id, owner.business_id, ingredient.id, date, Math.round(qty * 10000)) };
}
function snapshot(filename) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try { return db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(({ name }) => [name, db.prepare('SELECT * FROM "' + name + '"').all()]); }
  finally { db.close(); }
}
const cli = args => spawnSync(process.execPath, ['scripts/evaluate-usage.mjs', ...args], { encoding: 'utf8' });

test('empty template and unlabelled worksheets cannot manufacture metrics', () => {
  const template = JSON.parse(readFileSync('datasets/templates/usage-review-labels.json', 'utf8'));
  assert.deepEqual(template.observations, []); assert.deepEqual(template.annotations, []);
  assert.throws(() => validateUsageDraft(template), /Identitas/);
  const data = draft(), protocol = freezeUsageProtocol(data);
  assert.throws(() => evaluateUsage(data, protocol), /anotasi manusia/);
  data.observations = [];
  assert.throws(() => freezeUsageProtocol(data), /histori asli/);
});

test('export is read-only, scoped, blind and retains every target date without zero imputation', t => {
  const f = database(t);
  const missing = '2026-01-04';
  for (const row of draft().observations) if (row.date !== missing) f.insert(row.date, row.qty);
  f.insert(addDays(periods.testTo, 1), 99);
  const before = snapshot(f.filename), data = exportUsageAnnotations(f.options);
  assert.deepEqual(snapshot(f.filename), before); assert.equal(before.length, 36);
  assert.equal(data.observations.find(row => row.date === missing), undefined);
  assert.equal(data.observations.at(-1).date, periods.testTo);
  assert.equal(data.annotations.length, 8); assert.equal(data.annotations.find(row => row.date === missing).label, null);
  assert.ok(data.annotations.every(row => row.label === null && !('review' in row) && !('status' in row)));
  const serialized = JSON.stringify(data);
  assert.ok(!serialized.includes(f.options.businessId)); assert.ok(!serialized.includes('Contract ingredient'));
  assert.throws(() => exportUsageAnnotations({ ...f.options, businessId: 'other' }), /scope/);
  assert.throws(() => exportUsageAnnotations({ ...f.options, confirmed: false }), /confirm-permission/);
});

test('missing history and missing database fail without creating files or data', t => {
  const f = database(t), before = snapshot(f.filename);
  assert.throws(() => exportUsageAnnotations(f.options), /Belum ada histori/);
  assert.throws(() => exportUsageAnnotations({ ...f.options, filename: path.join(f.directory, 'missing.sqlite') }), /ENOENT/);
  const output = path.join(f.directory, 'no-labels.json');
  const result = cli(['export', '--database', f.filename, '--workspace', f.options.workspaceId, '--business', f.options.businessId,
    '--product', f.options.productId, '--validation-from', periods.validationFrom, '--validation-to', periods.validationTo,
    '--test-from', periods.testFrom, '--test-to', periods.testTo, '--confirm-permission', '--reference', 'Contract permission', '--out', output]);
  assert.equal(result.status, 1); assert.match(result.stderr, /Belum ada histori/); assert.equal(existsSync(output), false);
  assert.deepEqual(snapshot(f.filename), before);
});

test('date selection rejects overlap, future dates, excessive periods and cherry-picked annotations', () => {
  assert.throws(() => targetDates({ ...periods, testFrom: periods.validationTo }), /tanpa overlap/);
  assert.throws(() => targetDates({ ...periods, testTo: '2999-01-01' }), /sebelum hari/);
  assert.throws(() => targetDates({ validationFrom: '2023-01-01', validationTo: '2024-12-31', testFrom: '2025-01-01', testTo: '2025-01-02' }), /366 tanggal/);
  const data = draft(); data.annotations.splice(1, 1);
  assert.throws(() => validateUsageDraft(data), /semua tanggal/);
  data.annotations = draft().annotations; data.annotations[0].date = periods.testFrom;
  assert.throws(() => validateUsageDraft(data), /Tanggal\/split/);
});

test('observations reject duplicates, fabricated gaps, invalid quantities and leaked prediction columns', () => {
  const data = draft(); data.observations[1].date = data.observations[0].date;
  assert.throws(() => validateUsageDraft(data), /berurutan/);
  for (const qty of [NaN, Infinity, -1, 0.00001, '10']) {
    const copy = draft(); copy.observations[0].qty = qty;
    assert.throws(() => validateUsageDraft(copy), /Jumlah ledger/);
  }
  const copy = draft(); copy.annotations[0].review = true;
  assert.throws(() => freezeUsageProtocol(copy), /tanpa prediksi/);
});

test('protocol freezes before labels and detects changes to observations, periods, permission, source and rule', () => {
  const data = draft(), protocol = freezeUsageProtocol(data);
  assert.equal(protocol.targetCounts.test, 6); assert.ok(protocol.sourceSha256['server/ml/usage-anomalies.mjs']);
  assert.throws(() => freezeUsageProtocol(annotate(data)), /sebelum anotasi/);
  for (const change of [copy => copy.observations[0].qty++, copy => copy.provenance.permissionReference = 'Different permission', copy => copy.datasetId = randomUUID()]) {
    const copy = annotate(data); change(copy);
    assert.throws(() => evaluateUsage(copy, protocol), /berubah|tidak valid/);
  }
  const changedRule = structuredClone(protocol); changedRule.rule.modifiedZLimit = 99;
  assert.throws(() => evaluateUsage(annotate(data), changedRule), /Aturan atau sumber/);
  const changedSource = structuredClone(protocol); changedSource.sourceSha256['scripts/evaluate-usage.mjs'] = '0'.repeat(64);
  assert.throws(() => evaluateUsage(annotate(data), changedSource), /Aturan atau sumber/);
});

test('permission, blind labels, evidence and completeness attestations are mandatory for both splits', () => {
  const data = draft(), protocol = freezeUsageProtocol(data);
  for (const change of [copy => copy.provenance.permissionConfirmed = false, copy => copy.provenance.blindReviewConfirmed = false,
    copy => copy.provenance.completenessReference = '', copy => copy.annotations[0].label = null,
    copy => copy.annotations[0].annotator = '', copy => copy.annotations[0].evidenceReference = '', copy => copy.annotations[0].recordingComplete = null]) {
    const copy = annotate(data); change(copy); assert.throws(() => evaluateUsage(copy, protocol));
  }
});

test('frozen production rule produces hand-checked precision/recall and retains uncertain/incomplete burden', () => {
  const data = draft();
  for (const date of ['2026-01-03', '2026-01-04', '2026-01-07', '2026-01-08']) data.observations.find(row => row.date === date).qty = 40;
  const protocol = freezeUsageProtocol(data), annotated = annotate(data);
  const testRows = annotated.annotations.filter(row => row.split === 'test');
  testRows[0].label = 'review_needed'; testRows[2].label = 'review_needed';
  testRows[4].label = 'uncertain'; testRows[5].recordingComplete = false;
  const report = evaluateUsage(annotated, protocol), m = report.metrics;
  assert.deepEqual(m.confusionOnScreened, { truePositive: 1, falsePositive: 1, falseNegative: 1, trueNegative: 1 });
  assert.equal(m.precision, .5); assert.equal(m.recallOnScreened, .5); assert.equal(m.f1OnScreened, .5);
  assert.equal(m.coverage, 1); assert.equal(m.targetDays, 6); assert.equal(m.eligibleDays, 4);
  assert.equal(m.uncertainLabels, 1); assert.equal(m.incompleteRecording, 1);
  assert.equal(m.actualReviewCandidates, 4); assert.equal(m.reviewBurdenPer100TargetDays, 400 / 6);
  assert.equal(report.fieldValidated, false); assert.equal(report.newTraining, false);
  assert.ok(!JSON.stringify(report).includes('reviewer-test')); assert.ok(!JSON.stringify(report).includes('Contract evidence'));
});

test('reference gaps abstain, reduce end-to-end recall and are never silently treated as normal', () => {
  const data = draft(); data.observations = data.observations.filter(row => row.date !== '2026-01-02');
  const protocol = freezeUsageProtocol(data), annotated = annotate(data);
  annotated.annotations.find(row => row.date === '2026-01-03').label = 'review_needed';
  const m = evaluateUsage(annotated, protocol).metrics;
  assert.equal(m.abstainedDays, 6); assert.equal(m.screenedDays, 0); assert.equal(m.coverage, 0);
  assert.equal(m.precision, null); assert.equal(m.recallOnScreened, null); assert.equal(m.endToEndRecall, 0);
  assert.equal(m.reviewNeededDuringAbstention, 1); assert.equal(m.status, 'not_estimable');
  assert.equal(m.confusionOnScreened.trueNegative, 0);
});

test('zero denominators remain null and every label exclusion remains in the report', () => {
  const data = draft(), protocol = freezeUsageProtocol(data), annotated = annotate(data);
  const m = evaluateUsage(annotated, protocol).metrics;
  assert.equal(m.precision, null); assert.equal(m.recallOnScreened, null); assert.equal(m.f1OnScreened, null); assert.equal(m.endToEndRecall, null);
  annotated.annotations.forEach(row => row.label = 'uncertain');
  const excluded = evaluateUsage(annotated, protocol).metrics;
  assert.equal(excluded.eligibleDays, 0); assert.equal(excluded.uncertainLabels, 6); assert.equal(excluded.coverage, null); assert.equal(excluded.status, 'not_estimable');
  assert.equal(summarizeUsage([]).reviewBurdenPer100TargetDays, null);
});

test('CLI freeze and evaluate preserve original evidence and hash annotated dataset/protocol', t => {
  const directory = temporary(t), source = path.join(directory, 'labels.json'), frozen = path.join(directory, 'frozen'), output = path.join(directory, 'results');
  const data = draft(); writeFileSync(source, JSON.stringify(data));
  assert.equal(cli(['freeze', '--dataset', source, '--out', frozen]).status, 0);
  assert.equal(cli(['freeze', '--dataset', source, '--out', frozen]).status, 1);
  const protocolFile = path.join(frozen, 'protocol.json'), protocolBefore = readFileSync(protocolFile, 'utf8');
  const unlabelledOutput = path.join(directory, 'unlabelled');
  assert.equal(cli(['evaluate', '--dataset', source, '--protocol', protocolFile, '--out', unlabelledOutput]).status, 1);
  assert.equal(existsSync(unlabelledOutput), false);
  writeFileSync(source, JSON.stringify(annotate(data)));
  const result = cli(['evaluate', '--dataset', source, '--protocol', protocolFile, '--out', output]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(path.join(output, 'report.json'), 'utf8'));
  assert.equal(report.rows.length, 6); assert.match(report.datasetSha256, /^[a-f0-9]{64}$/); assert.match(report.protocolSha256, /^[a-f0-9]{64}$/);
  assert.equal(cli(['evaluate', '--dataset', source, '--protocol', protocolFile, '--out', output]).status, 1);
  assert.equal(readFileSync(protocolFile, 'utf8'), protocolBefore); assert.deepEqual(readdirSync(output), ['report.json']);
});

test('CLI export writes a private blank worksheet once and never overwrites annotations or changes SQLite', t => {
  const f = database(t); for (const row of draft().observations) f.insert(row.date, row.qty);
  const before = snapshot(f.filename), output = path.join(f.directory, 'worksheet.json');
  const args = ['export', '--database', f.filename, '--workspace', f.options.workspaceId, '--business', f.options.businessId,
    '--product', f.options.productId, '--validation-from', periods.validationFrom, '--validation-to', periods.validationTo,
    '--test-from', periods.testFrom, '--test-to', periods.testTo, '--confirm-permission', '--reference', 'Contract permission', '--out', output];
  const result = cli(args); assert.equal(result.status, 0, result.stderr);
  const raw = readFileSync(output, 'utf8'), data = JSON.parse(raw);
  assert.equal(data.annotations.length, 8); assert.ok(data.annotations.every(row => row.label === null));
  assert.equal(cli(args).status, 1); assert.equal(readFileSync(output, 'utf8'), raw);
  assert.deepEqual(snapshot(f.filename), before);
});

test('CLI help and invalid options never call business APIs or create evaluation results', () => {
  const help = cli(['--help']); assert.equal(help.status, 0); assert.match(help.stdout, /Tanpa histori\/label\/izin/);
  assert.equal(cli(['evaluate', '--unknown']).status, 1);
  for (const file of ['scripts/usage-evaluation.mjs', 'scripts/usage-evaluation-data.mjs', 'scripts/evaluate-usage.mjs']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /\bfetch\s*\(|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM/);
  }
});
