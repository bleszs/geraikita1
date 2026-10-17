import { createHash } from 'node:crypto';
import { ApiError } from '../server/common.mjs';
import { parseOrder, createExtractor, requestModelItems, EXTRACTION_PROMPT_VERSION } from '../server/extractor.mjs';

const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const textValue = value => typeof value === 'string' && value.trim().length > 0;
const digest = value => createHash('sha256').update(value).digest('hex');
const canonical = items => items.map(i => JSON.stringify([i.id, i.qty])).sort().join('|');
const normalizeNote = value => value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');

export function validateChatDataset(value) {
  ensure([1,2].includes(value?.schemaVersion), 'Schema dataset chat harus versi 1 atau 2.');
  const p = value.provenance;
  ensure(p?.source === 'consented_business_chats' && p.permissionConfirmed === true && p.redacted === true && p.humanAnnotated === true && textValue(p.reference) && p.reference.trim().length >= 5,
    'Isi sumber chat nyata, referensi izin, permissionConfirmed, redacted dan humanAnnotated dengan benar.');
  ensure(Array.isArray(value.menu) && value.menu.length >= 1 && value.menu.length <= 100, 'Isi katalog aktual 1–100 menu.');
  const ids = new Set(), aliases = new Set();
  for (const item of value.menu) {
    ensure(textValue(item.id) && item.id.length <= 100 && !ids.has(item.id), 'ID menu tidak valid atau duplikat.');
    ids.add(item.id);
    ensure(textValue(item.name) && item.name.length <= 120 && Array.isArray(item.aliases) && item.aliases.length > 0 && item.aliases.length <= 20, 'Nama/alias menu belum lengkap.');
    for (const alias of item.aliases) {
      ensure(textValue(alias) && alias === alias.trim().toLowerCase() && alias.length <= 120 && !aliases.has(alias), 'Alias harus huruf kecil, unik dan sesuai katalog aktual.');
      aliases.add(alias);
    }
  }
  ensure(Array.isArray(value.records) && value.records.length >= 1 && value.records.length <= 5000, 'Belum ada chat berlabel; dataset kosong tidak dievaluasi.');
  const recordIds = new Set(), conversations = new Map(), texts = new Map();
  for (const row of value.records) {
    ensure(textValue(row.id) && row.id.length <= 100 && !recordIds.has(row.id), 'ID chat tidak valid atau duplikat.');
    recordIds.add(row.id);
    ensure(textValue(row.conversationId) && row.conversationId.length <= 200, 'conversationId pseudonim diperlukan.');
    ensure(['train', 'validation', 'test'].includes(row.split), 'Split harus train, validation atau test.');
    ensure(textValue(row.text) && row.text.length <= 2000, 'Chat kosong atau lebih dari 2.000 karakter.');
    const normalized = row.text.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
    for (const [map, key] of [[conversations, row.conversationId], [texts, normalized]]) {
      ensure(!map.has(key) || map.get(key) === row.split, 'Percakapan atau chat identik bocor ke split berbeda.');
      map.set(key, row.split);
    }
    const expected = row.expected;
    ensure(expected && ['extract', 'manual'].includes(expected.action) && Array.isArray(expected.items), 'Label action/items diperlukan.');
    const itemIds = new Set();
    for (const i of expected.items) {
      ensure(i && ids.has(i.id) && !itemIds.has(i.id) && Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 99, 'Label menu/jumlah tidak valid.');
      itemIds.add(i.id);
      const fragments=i.requiredNoteFragments;
      ensure(value.schemaVersion!==2||Array.isArray(fragments),'Schema 2 memerlukan requiredNoteFragments pada setiap item; array kosong berarti sudah diperiksa tanpa catatan wajib.');
      if(fragments!==undefined){
        ensure(Array.isArray(fragments)&&fragments.length<=20,'requiredNoteFragments harus array maksimal 20 fragmen.');
        const seen=new Set();
        for(const fragment of fragments){
          ensure(textValue(fragment)&&fragment.length<=500,'Fragmen catatan wajib harus teks 1–500 karakter.');
          const normalizedFragment=normalizeNote(fragment);
          ensure(normalized.includes(normalizedFragment)&&!seen.has(normalizedFragment),'Fragmen catatan wajib harus berasal dari chat dan tidak duplikat.');
          seen.add(normalizedFragment);
        }
      }
    }
    ensure(expected.action === 'manual' ? expected.items.length === 0 : expected.items.length > 0 && expected.items.length <= 20, 'Label manual harus kosong; label extract berisi 1–20 menu.');
  }
  return value;
}

export function summarizeChat(rows, name) {
  const measured = rows.filter(r => r[name]);
  const expectedExtract = measured.filter(r => r.expected.action === 'extract');
  const expectedManual = measured.filter(r => r.expected.action === 'manual');
  const correct = r => r.expected.action === 'manual' ? r[name].status === 'manual' : r[name].status === 'accepted' && canonical(r[name].items) === canonical(r.expected.items);
  const exact = measured.filter(correct).length;
  const accepted = measured.filter(r => r[name].status === 'accepted');
  const unsafe = accepted.filter(r => !correct(r)).length;
  const falseAcceptManual = expectedManual.filter(r => r[name].status === 'accepted').length;
  const latency = measured.map(r => r[name].latencyMs).sort((a, b) => a-b);
  const quantile = q => latency.length ? latency[Math.max(0, Math.ceil(latency.length*q)-1)] : null;
  const annotated=expectedExtract.filter(r=>r[name].noteReview?.status==='annotated');
  const required=annotated.reduce((sum,r)=>sum+r[name].noteReview.requiredFragments,0);
  const retained=annotated.reduce((sum,r)=>sum+r[name].noteReview.retainedFragments,0);
  const fullAnnotated=annotated.filter(r=>r[name].noteReview.fullyAnnotated);
  const combinedMatches=fullAnnotated.filter(r=>correct(r)&&r[name].noteReview.allRequiredRetained).length;
  return { status: measured.length ? 'evaluated' : 'not_run', observations: measured.length,
    exactMatches: exact, exactMatchRate: measured.length ? exact/measured.length : null,
    expectedExtract: expectedExtract.length, expectedManual: expectedManual.length,
    accepted: accepted.length, unsafeAccepted: unsafe, unsafeAcceptanceRate: measured.length ? unsafe/measured.length : null,
    falseAcceptedManual: falseAcceptManual, falseAcceptanceOnManualRate: expectedManual.length ? falseAcceptManual/expectedManual.length : null,
    rejectedClearOrders: expectedExtract.filter(r => r[name].status === 'manual').length,
    errors: measured.filter(r => r[name].status === 'error').length,
    modeCounts: Object.fromEntries([...new Set(measured.map(r => r[name].mode))].map(mode => [mode, measured.filter(r => r[name].mode === mode).length])),
    latencyMs: { p50: quantile(.5), p95: quantile(.95) },
    requiredNotes:{status:annotated.length?'evaluated':'not_annotated',annotatedOrders:annotated.length,fullyAnnotatedOrders:fullAnnotated.length,
      annotationCoverageRate:expectedExtract.length?fullAnnotated.length/expectedExtract.length:null,
      requiredFragments:required,retainedFragments:retained,retentionRate:required?retained/required:null,
      acceptedOrdersWithMissingNotes:annotated.filter(r=>r[name].status==='accepted'&&!r[name].noteReview.allRequiredRetained).length,
      menuQuantityAndRequiredNotesMatches:combinedMatches,menuQuantityAndRequiredNotesMatchRate:fullAnnotated.length?combinedMatches/fullAnnotated.length:null} };
}

function noteReview(expected,result){
  if(expected.action!=='extract')return {status:'not_applicable'};
  const annotated=expected.items.filter(i=>Array.isArray(i.requiredNoteFragments));
  if(!annotated.length)return {status:'not_annotated'};
  let required=0,retained=0;
  for(const item of annotated){
    const note=result.status==='accepted'?result.items.find(i=>i.id===item.id)?.note:undefined;
    for(const fragment of item.requiredNoteFragments){required++;if(typeof note==='string'&&normalizeNote(note).includes(normalizeNote(fragment)))retained++;}
  }
  return {status:'annotated',annotatedItems:annotated.length,fullyAnnotated:annotated.length===expected.items.length,
    requiredFragments:required,retainedFragments:retained,allRequiredRetained:required===retained};
}
// Assess literal retention in memory; never write raw notes/fragments to reports.
function privateResult(expected,result){
  if(!result)return null;
  return {...result,noteReview:noteReview(expected,result),items:result.items.map(i=>({id:i.id,qty:i.qty,
    ...(typeof i.note==='string'?{noteLength:i.note.length,noteSha256:digest(i.note)}:{})}))};
}

async function measure(operation) {
  const start = performance.now();
  try {
    const result = await operation();
    return { status: 'accepted', items: result.items, mode: result.mode, latencyMs: Math.round(performance.now()-start) };
  } catch (error) {
    const manual = error instanceof ApiError && error.status === 400;
    return { status: manual ? 'manual' : 'error', items: [], mode: manual ? 'manual' : error.message === 'evidence mismatch' ? 'invalid_output' : 'unavailable', latencyMs: Math.round(performance.now()-start) };
  }
}

export async function evaluateChats(dataset, { provider = 'rules', split = 'test', model = 'qwen2.5:1.5b', url = 'http://127.0.0.1:11434', timeout = 45000, fetcher = fetch, onProgress = () => {} } = {}) {
  validateChatDataset(dataset);
  ensure(['test', 'validation'].includes(split), 'Evaluasi hanya untuk split test atau validation.');
  ensure(['rules', 'ollama'].includes(provider), 'Provider harus rules atau ollama.');
  ensure(Number.isInteger(timeout) && timeout >= 100 && timeout <= 120000, 'Timeout harus 100–120.000 ms.');
  const endpoint = new URL(url);
  ensure(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname) && ['http:', 'https:'].includes(endpoint.protocol) && !endpoint.username && !endpoint.password && endpoint.pathname === '/' && !endpoint.search && !endpoint.hash, 'Evaluasi hanya mengirim chat ke Ollama lokal pada root URL.');
  const selected = dataset.records.filter(r => r.split === split);
  ensure(selected.length > 0, 'Split yang dipilih belum memiliki chat; tidak membuat metrik.');
  const pipeline = createExtractor({ provider, model, url: endpoint.origin, timeout, fetcher });
  const rows = [];
  for (const row of selected) {
    const parser = await measure(() => ({ items: parseOrder(row.text, dataset.menu), mode: 'rules' }));
    const rawModel = provider === 'ollama' ? await measure(async () => ({ ...await requestModelItems(row.text, dataset.menu, { model, url: endpoint.origin, timeout, fetcher }), mode: 'ollama' })) : null;
    const combined = await measure(() => pipeline.extract(row.text, dataset.menu));
    // No raw chat, customer identity, menu names or original model response in report.
    rows.push({ recordHash: digest(row.id), conversationHash: digest(row.conversationId),
      expected:{action:row.expected.action,items:row.expected.items.map(i=>({id:i.id,qty:i.qty}))},
      parser:privateResult(row.expected,parser),rawModel:privateResult(row.expected,rawModel),pipeline:privateResult(row.expected,combined) });
    onProgress(rows.length, selected.length);
  }
  return { schemaVersion: 2, datasetSchemaVersion:dataset.schemaVersion,evaluatedAt: new Date().toISOString(), split, provider, model: provider === 'ollama' ? model : null,
    promptVersion: EXTRACTION_PROMPT_VERSION, datasetRecords: dataset.records.length, evaluatedRecords: rows.length,
    splitCounts: Object.fromEntries(['train','validation','test'].map(s => [s, dataset.records.filter(r => r.split === s).length])),
    metrics: Object.fromEntries(['parser','rawModel','pipeline'].map(name => [name, summarizeChat(rows, name)])), rows,
    limitations: ['Izin dan label adalah pernyataan penyedia dataset, bukan verifikasi independen atau bukti mutu lapangan.',
      'Pipeline menolak sebelum model jika parser menolak, dan memakai parser ketika hasil model berbeda. Model belum memperluas cakupan parser.',
      'Raw model memakai schema items tanpa action manual; schema membatasi format, bukan membuktikan kesesuaian chat.',
      'Model mentah dan pipeline dipanggil terpisah secara berurutan; latensi termasuk timeout/fallback. Latensi dingin tidak dipisahkan.',
      'Error model tetap berada dalam denominator exact match; error bukan penolakan manual yang benar.',
      'exactMatchRate menilai menu/jumlah dan keputusan manual; tidak mencakup catatan. requiredNotes hanya mengukur retensi literal fragmen yang diberi label, bukan ketepatan makna atau penempatan variasi.',
      'Catatan tanpa anotasi tidak dianggap benar. Hasil yang ditolak atau error tidak dihitung cocok pada skor gabungan. Schema model mentah belum menghasilkan catatan.',
      'Chat/catatan/fragmen anotasi tidak disalin ke laporan; ID katalog dan hash tetap bersifat privat dan bukan anonimisasi yang dijamin.',
      'Kesamaan percakapan dan teks antar-split diperiksa, bukan kemiripan semantik. Tidak ada fitting, fine-tuning atau tuning pada test.'] };
}
