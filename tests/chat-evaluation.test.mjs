import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { requestModelItems, createExtractor,parseOrder } from '../server/extractor.mjs';
import { validateChatDataset, evaluateChats, summarizeChat } from '../scripts/chat-evaluation.mjs';

// Mathematical/contract fixtures only; never loaded into the application database.
const menu = [{ id: 'isolated-material-menu', name: 'Produk uji terisolasi', aliases: ['produk uji'] }];
const fixture = () => ({ schemaVersion: 1, provenance: { source: 'consented_business_chats', reference: 'Isolated contract test only', permissionConfirmed: true, redacted: true, humanAnnotated: true }, menu: structuredClone(menu), records: [
  { id: 'private-record-a', conversationId: 'private-thread-a', split: 'test', text: 'produk uji 2', expected: { action: 'extract', items: [{ id: menu[0].id, qty: 2 }] } },
  { id: 'private-record-b', conversationId: 'private-thread-b', split: 'test', text: 'batal produk uji 2', expected: { action: 'manual', items: [] } },
] });
const response = body => ({ ok: true, json: async () => ({ message: { content: JSON.stringify(body) } }) });

test('chat validation requires permission, redaction, human labels and nonempty actual records', () => {
  assert.equal(validateChatDataset(fixture()).records.length, 2);
  for (const field of ['permissionConfirmed', 'redacted', 'humanAnnotated']) {
    const data = fixture(); data.provenance[field] = false;
    assert.throws(() => validateChatDataset(data), /sumber chat nyata/);
  }
  const empty = fixture(); empty.records = [];
  assert.throws(() => validateChatDataset(empty), /dataset kosong/);
  assert.throws(() => validateChatDataset(JSON.parse(readFileSync('datasets/templates/chat-dataset.json'))));
});

test('chat split rejects shared conversations and normalized identical text across splits', () => {
  const groupLeak = fixture(); groupLeak.records[1].split = 'validation'; groupLeak.records[1].conversationId = groupLeak.records[0].conversationId;
  assert.throws(() => validateChatDataset(groupLeak), /bocor/);
  const textLeak = fixture(); textLeak.records[1].split = 'train'; textLeak.records[1].text = ' PRODUK   UJI 2 ';
  assert.throws(() => validateChatDataset(textLeak), /bocor/);
  const distinct = fixture(); distinct.records[1].split = 'validation';
  assert.equal(validateChatDataset(distinct).records.length, 2);
});

test('chat labels and catalog reject unknown IDs, ambiguous aliases, duplicates and invalid quantities', () => {
  for (const edit of [d => { d.records[0].expected.items[0].qty = 0; }, d => { d.records[0].expected.items[0].id = 'unknown'; }, d => { d.menu[0].aliases.push('produk uji'); }, d => { d.records[1].expected.items = [{ id: menu[0].id, qty: 1 }]; }, d => { d.records[1].id = d.records[0].id; }]) {
    const data = fixture(); edit(data); assert.throws(() => validateChatDataset(data));
  }
});

test('raw model client maps short references without applying the parser evidence gate', async () => {
  let sent;
  const result = await requestModelItems('chat belum dipahami parser', menu, { fetcher: async (_url, options) => { sent = JSON.parse(options.body); return response({ items: [{ id: 'menu1', qty: 2 }] }); } });
  assert.deepEqual(result.items, [{ id: menu[0].id, qty: 2 }]);
  assert.equal(sent.messages[1].content, 'chat belum dipahami parser');
  assert.equal(sent.options.temperature, 0);
  assert.deepEqual(sent.format.properties.items.items.properties.id.enum, ['menu1']);
});

test('raw model client rejects malformed JSON, empty/duplicate/extra/unknown fields and invalid quantity', async () => {
  for (const body of [null, { items: [] }, { items: [{ id: 'menu1', qty: 2 }], extra: 1 }, { items: [{ id: 'menu1', qty: 2, extra: 1 }] }, { items: [{ id: 'menu1', qty: 2 }, { id: 'menu1', qty: 2 }] }, { items: [{ id: 'unknown', qty: 2 }] }, { items: [{ id: 'menu1', qty: 2.5 }] }]) {
    await assert.rejects(requestModelItems('produk uji 2', menu, { fetcher: async () => response(body) }), /evidence mismatch/);
  }
  await assert.rejects(requestModelItems('produk uji 2', menu, { fetcher: async () => ({ ok: true, json: async () => ({ message: { content: '{invalid' } }) }) }), /evidence mismatch/);
});

test('actual pipeline accepts agreement, falls back on disagreement and blocks negation before any model call', async () => {
  let calls = 0, qty = 2;
  const extractor = createExtractor({ fetcher: async () => { calls++; return response({ items: [{ id: 'menu1', qty }] }); } });
  assert.equal((await extractor.extract('produk uji 2', menu)).mode, 'ollama');
  qty = 3;
  const fallback = await extractor.extract('produk uji 2', menu);
  assert.equal(fallback.mode, 'fallback'); assert.equal(fallback.items[0].qty, 2);
  await assert.rejects(extractor.extract('batal produk uji 2', menu));
  assert.equal(calls, 2);
});

test('chat metrics count unsafe acceptance and infrastructure failure without fabricated empty rates', () => {
  const data = fixture();
  const rows = data.records.map(row => ({ expected: row.expected, engine: { status: 'accepted', mode: 'ollama', latencyMs: 10, items: [{ id: menu[0].id, qty: 3 }] } }));
  const metrics = summarizeChat(rows, 'engine');
  assert.equal(metrics.exactMatchRate, 0); assert.equal(metrics.unsafeAccepted, 2); assert.equal(metrics.falseAcceptanceOnManualRate, 1);
  rows[1].engine = { status: 'error', items: [], mode: 'unavailable', latencyMs: 100 };
  assert.equal(summarizeChat(rows, 'engine').errors, 1); assert.equal(summarizeChat(rows, 'engine').exactMatches, 0);
  assert.equal(summarizeChat(rows, 'not-run').exactMatchRate, null);
  assert.equal(summarizeChat(rows, 'not-run').latencyMs.p95, null);
});

test('rules evaluation reports raw model not run and omits source chat/identity; rejects remote endpoints and empty split', async () => {
  const data = fixture();
  const report = await evaluateChats(data, { provider: 'rules', fetcher: () => { throw new Error('Must never fetch'); } });
  assert.equal(report.metrics.parser.exactMatchRate, 1); assert.equal(report.metrics.pipeline.exactMatchRate, 1);
  assert.equal(report.metrics.rawModel.status, 'not_run');
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes('batal produk uji'), false); assert.equal(serialized.includes('private-record-a'), false); assert.equal(serialized.includes('private-thread-a'), false);
  await assert.rejects(evaluateChats(data, { url: 'https://example.test' }), /Ollama lokal/);
  await assert.rejects(evaluateChats(data, { split: 'validation' }), /belum memiliki chat/);
});

test('comparison runs independent raw AI and actual pipeline, retaining wrong outputs and fallback', async () => {
  let calls = 0;
  const report = await evaluateChats(fixture(), { provider: 'ollama', fetcher: async () => { calls++; return response({ items: [{ id: 'menu1', qty: 3 }] }); } });
  assert.equal(calls, 3);
  assert.equal(report.metrics.rawModel.unsafeAccepted, 2);
  assert.equal(report.metrics.pipeline.exactMatchRate, 1);
  assert.deepEqual(report.metrics.pipeline.modeCounts, { fallback: 1, manual: 1 });
  assert.equal(report.rows[0].rawModel.items[0].qty, 3);
});

test('chat CLI refuses missing data, writes only private evaluation artifacts and never overwrites an existing run', () => {
  const run = args => spawnSync(process.execPath, ['scripts/evaluate-chat.mjs', ...args], { encoding: 'utf8' });
  assert.equal(run([]).status, 1);
  const directory = mkdtempSync(path.join(tmpdir(), 'gerai-chat-contract-'));
  try {
    const source = path.join(directory, 'input.json'), destination = path.join(directory, 'run');
    writeFileSync(source, JSON.stringify(fixture()));
    const result = run(['--dataset', source, '--out', destination]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(readFileSync(path.join(destination, 'report.json')));
    assert.equal(report.evaluatedRecords, 2); assert.equal(report.metrics.rawModel.status, 'not_run');
    assert.equal(report.datasetSha256.length, 64);
    const before = readFileSync(path.join(destination, 'protocol.json'), 'utf8');
    assert.equal(run(['--dataset', source, '--out', destination]).status, 1);
    assert.equal(readFileSync(path.join(destination, 'protocol.json'), 'utf8'), before);
  } finally {
    const resolved = realpathSync(directory);
    assert.equal(path.dirname(resolved), realpathSync(tmpdir()));
    assert.ok(path.basename(resolved).startsWith('gerai-chat-contract-'));
    rmSync(resolved, { recursive: true, force: true });
  }
});

const annotatedFixture = (text='produk uji 2 tanpa gula',fragments=['tanpa gula']) => {
  const data=fixture();data.schemaVersion=2;data.records=data.records.slice(0,1);
  data.records[0].text=text;data.records[0].expected.items[0].requiredNoteFragments=fragments;return data;
};

test('schema 2 requires explicit per-item note annotations and rejects invented or duplicate evidence',()=>{
  assert.equal(validateChatDataset(annotatedFixture()).schemaVersion,2);
  for(const fragments of [undefined,null,'tanpa gula',[''],['lebih manis'],['tanpa gula',' TANPA   GULA ']]){
    const data=annotatedFixture();data.records[0].expected.items[0].requiredNoteFragments=fragments;
    assert.throws(()=>validateChatDataset(data),/requiredNoteFragments|Fragmen/);
  }
  assert.equal(validateChatDataset(annotatedFixture('produk uji 2',[])).records.length,1);
  const old=fixture();assert.equal(validateChatDataset(old).schemaVersion,1);
});

test('note retention is separate from item accuracy and reports missing modifiers instead of silently scoring success',async()=>{
  const report=await evaluateChats(annotatedFixture('produk uji 2 dingin',['dingin']),{provider:'ollama',fetcher:async()=>response({items:[{id:'menu1',qty:2}]})});
  const score=report.metrics.rawModel;
  assert.equal(score.exactMatchRate,1);assert.equal(score.requiredNotes.retentionRate,0);
  assert.equal(score.requiredNotes.acceptedOrdersWithMissingNotes,1);
  assert.equal(score.requiredNotes.menuQuantityAndRequiredNotesMatchRate,0);
  assert.equal(report.rows[0].rawModel.noteReview.retainedFragments,0);
  assert.equal(report.metrics.pipeline.requiredNotes.retentionRate,1);
});

test('unlisted modifiers survive both parser and real pipeline without assigning invented per-item instructions',async()=>{
  for(const modifier of ['dingin','gula sedikit','hangat','alergi kacang','es terpisah']){
    const text='produk uji 2 '+modifier,parser=parseOrder(text,menu);
    assert.equal(parser[0].note,text);
    const extractor=createExtractor({fetcher:async()=>response({items:[{id:'menu1',qty:2}]})});
    const result=await extractor.extract(text,menu);assert.equal(result.mode,'ollama');assert.equal(result.items[0].note,text);
  }
  assert.equal(parseOrder('produk uji 2',menu)[0].note,'');
  const long='produk uji 2 '+ 'catatan '.repeat(70);
  assert.throws(()=>parseOrder(long,menu),/500 karakter/); // No silent truncation of the final instruction.
  const multiple=[...menu,{id:'second-isolated-menu',name:'Minuman uji',aliases:['minuman uji']}];
  const source='produk uji 2 dingin, minuman uji 1 hangat';
  assert(parseOrder(source,multiple).every(i=>i.note===source)); // Full source for review; scope is not inferred.
});

test('reports assess notes in memory without copying chat text or annotations into any engine output',async()=>{
  const data=annotatedFixture('produk uji 2 tanpa gula identitas-yang-tidak-boleh-disalin',['tanpa gula']);
  data.records[0].expected.privateLabel='internal-label-must-not-leak';
  const report=await evaluateChats(data,{provider:'ollama',fetcher:async()=>response({items:[{id:'menu1',qty:2}]})});
  const serialized=JSON.stringify(report);
  for(const secret of [data.records[0].text,'tanpa gula','identitas-yang-tidak-boleh-disalin','internal-label-must-not-leak','private-record-a','private-thread-a'])assert.equal(serialized.includes(secret),false,secret);
  assert.equal(report.metrics.pipeline.requiredNotes.retentionRate,1);
  assert.equal(report.metrics.rawModel.requiredNotes.retentionRate,0); // Raw items schema has no note field.
  assert.equal(report.rows[0].parser.items[0].noteLength,data.records[0].text.length);
  assert.match(report.rows[0].parser.items[0].noteSha256,/^[a-f0-9]{64}$/);
});

test('unannotated and empty-required-note datasets never manufacture a note retention rate',async()=>{
  const legacy=await evaluateChats(fixture(),{provider:'rules'});
  assert.equal(legacy.metrics.pipeline.requiredNotes.status,'not_annotated');
  assert.equal(legacy.metrics.pipeline.requiredNotes.retentionRate,null);
  assert.equal(legacy.metrics.pipeline.requiredNotes.menuQuantityAndRequiredNotesMatchRate,null);
  const noNotes=await evaluateChats(annotatedFixture('produk uji 2',[]),{provider:'rules'});
  assert.equal(noNotes.metrics.pipeline.requiredNotes.retentionRate,null);
  assert.equal(noNotes.metrics.pipeline.requiredNotes.menuQuantityAndRequiredNotesMatchRate,1);
});

test('rejected and failed cases remain in note denominators; model failure cannot masquerade as correct review',async()=>{
  const data=annotatedFixture('jangan produk uji 2 tanpa gula',['tanpa gula']);
  const report=await evaluateChats(data,{provider:'ollama',fetcher:async()=>{throw Error('Unavailable technical double');}});
  for(const engine of ['parser','rawModel','pipeline']){
    assert.equal(report.metrics[engine].requiredNotes.retentionRate,0);
    assert.equal(report.metrics[engine].requiredNotes.menuQuantityAndRequiredNotesMatchRate,0);
  }
  assert.equal(report.metrics.rawModel.errors,1);assert.equal(report.metrics.pipeline.rejectedClearOrders,1);
});

test('partial annotations expose coverage and never qualify as a fully checked order',async()=>{
  const data=annotatedFixture();data.menu.push({id:'second-isolated-menu',name:'Minuman uji',aliases:['minuman uji']});
  data.schemaVersion=1;data.records[0].text='produk uji 2 tanpa gula, minuman uji 1';
  data.records[0].expected.items.push({id:'second-isolated-menu',qty:1});
  const report=await evaluateChats(data,{provider:'rules'}),score=report.metrics.pipeline.requiredNotes;
  assert.equal(score.annotatedOrders,1);assert.equal(score.fullyAnnotatedOrders,0);assert.equal(score.annotationCoverageRate,0);
  assert.equal(score.menuQuantityAndRequiredNotesMatchRate,null);
});

test('CLI writes a private note-aware report without leaking source notes and never needs application storage',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'gerai-chat-contract-'));
  try{
    const input=path.join(directory,'notes.json'),out=path.join(directory,'report');
    writeFileSync(input,JSON.stringify(annotatedFixture()));
    const result=spawnSync(process.execPath,['scripts/evaluate-chat.mjs','--dataset',input,'--out',out],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const raw=readFileSync(path.join(out,'report.json'),'utf8'),report=JSON.parse(raw);
    assert.equal(report.schemaVersion,2);assert.equal(report.datasetSchemaVersion,2);
    assert.equal(raw.includes('tanpa gula'),false);assert.equal(report.metrics.pipeline.requiredNotes.retentionRate,1);
  }finally{
    const resolved=realpathSync(directory);assert.equal(path.dirname(resolved),realpathSync(tmpdir()));assert(path.basename(resolved).startsWith('gerai-chat-contract-'));rmSync(resolved,{recursive:true,force:true});
  }
});

test('unmatched numbers cannot hide unknown items behind a numeric modifier or lose part of a spoken quantity',async()=>{
  const inputs=['produk uji 2 pedas 1 burger','produk uji 2 pedas 3/4','produk uji 2 pedas 3 4','produk uji 2 pedas 3',
    'produk uji dua belas','produk uji dua puluh','produk uji dua setengah','produk uji 2 pedas ３','-2 produk uji','−2 produk uji','+2 produk uji','– 2 produk uji','produk uji 2-3'];
  let calls=0;const extractor=createExtractor({fetcher:async()=>{calls++;return response({items:[{id:'menu1',qty:2}]});}});
  for(const text of inputs){assert.throws(()=>parseOrder(text,menu),undefined,text);await assert.rejects(extractor.extract(text,menu),undefined,text);}
  assert.equal(calls,0); // Invalid quantity evidence never reaches a model.
  for(const text of ['produk uji 2 pedas','dua produk uji hangat','produk uji 12','12 produk uji','produk uji 99'])assert.equal(parseOrder(text,menu).length,1);
  const numericMenu=[{id:'numeric-alias',name:'Produk 12',aliases:['produk 12']}];assert.equal(parseOrder('produk 12 2',numericMenu)[0].qty,2);
});
