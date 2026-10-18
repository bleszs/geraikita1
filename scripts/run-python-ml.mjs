import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = fileURLToPath(new URL(process.platform === 'win32' ? '../.venv-ml/Scripts/python.exe' : '../.venv-ml/bin/python', import.meta.url));
const commands = {
  kulakan: ['scripts/train-kulakan.py'],
  'verify-kulakan': ['scripts/verify-kulakan-training.py'],
  benchmark: ['scripts/benchmark-pooled.py'],
  verify: ['scripts/verify-pooled.py'],
  test: ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_pooled_forecast.py'],
  'prepare-uci': ['scripts/fetch-uci-retail.py'],
  'test-uci': ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_uci_retail.py'],
  transfer: ['scripts/benchmark-transfer.py'],
  'verify-transfer': ['scripts/verify-transfer.py'],
  'test-transfer': ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_boosting_transfer.py'],
  'analyze-transfer': ['scripts/summarize-transfer.py'],
};
const args = commands[process.argv[2]];
if (!args || !existsSync(python)) {
  console.error('Siapkan .venv-ml dan instal requirements-ml.txt; baca docs/AI_TRAINING.md.');
  process.exit(1);
}
const result = spawnSync(python, args, { cwd: root, stdio: 'inherit', env: { ...process.env, OMP_NUM_THREADS: '2', OPENBLAS_NUM_THREADS: '2', MKL_NUM_THREADS: '2' } });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
