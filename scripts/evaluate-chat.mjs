import { parseArgs } from 'node:util';
import { readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { evaluateChats, validateChatDataset } from './chat-evaluation.mjs';

try {
  const { values } = parseArgs({ options: { dataset: { type: 'string' }, provider: { type: 'string', default: 'rules' }, split: { type: 'string', default: 'test' }, out: { type: 'string' }, model: { type: 'string', default: process.env.OLLAMA_MODEL || 'qwen2.5:1.5b' }, url: { type: 'string', default: process.env.OLLAMA_URL || 'http://127.0.0.1:11434' }, timeout: { type: 'string', default: '45000' }, help: { type: 'boolean' } } });
  if (values.help) {
    console.log('npm run evaluate:chat -- --dataset datasets/private/chat-dataset.json [--provider rules|ollama] [--split test|validation] [--out DIRECTORY]\nTemplate kosong: datasets/templates/chat-dataset.json. Panduan: docs/CHAT_EVALUATION.md. Tanpa dataset berizin, tidak ada metrik. Tidak mengubah SQLite atau melatih Qwen.');
  } else {
    if (!values.dataset) throw new Error('Isi --dataset dengan chat nyata berizin dan berlabel; tidak ada dataset bawaan.');
    if (statSync(values.dataset).size > 10_000_000) throw new Error('Dataset chat maksimal 10 MB.');
    const raw = readFileSync(values.dataset, 'utf8');
    const dataset = validateChatDataset(JSON.parse(raw));
    const directory = values.out || path.join('data/evaluation/chat', new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8));
    mkdirSync(directory, { recursive: true });
    const writeNew = (name, value) => writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2)+'\n', { flag: 'wx', mode: 0o600 });
    const sourceSha256 = Object.fromEntries(['../server/extractor.mjs', './chat-evaluation.mjs', './evaluate-chat.mjs'].map(file => [file, createHash('sha256').update(readFileSync(new URL(file, import.meta.url))).digest('hex')]));
    const frozen = { datasetSha256: createHash('sha256').update(raw).digest('hex'), sourceSha256, provider: values.provider, model: values.model, split: values.split, timeoutMs: Number(values.timeout),
      datasetSchemaVersion:dataset.schemaVersion,reportSchemaVersion:2,
      metricsPolicy:'Menu/quantity exact match is separate from literal required-note retention; absent annotations have no inferred note score.',
      frozenAt: new Date().toISOString(), testPolicy: 'Configuration frozen before predictions; test not used to tune. Never publish chat text or call application transaction APIs.' };
    writeNew('protocol.json', frozen);
    const report = await evaluateChats(dataset, { provider: values.provider, model: values.model, split: values.split, url: values.url, timeout: Number(values.timeout), onProgress: (done, count) => console.error(`Evaluasi chat ${done}/${count}`) });
    writeNew('report.json', { ...report, datasetSha256: frozen.datasetSha256 });
    console.log(JSON.stringify({ directory, evaluatedRecords: report.evaluatedRecords, metrics: report.metrics, databaseChanged: false, modelTrained: false }, null, 2));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
