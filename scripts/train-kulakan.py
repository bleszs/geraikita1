"""Train sales-only kulakan model, freeze weights before new-store holdout, export Node trees."""
import os
os.environ['OMP_NUM_THREADS'] = '2'
os.environ['OPENBLAS_NUM_THREADS'] = '2'
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import uuid
import duckdb
import joblib
import numpy as np
import sklearn
from sklearn.ensemble import HistGradientBoostingRegressor
from threadpoolctl import threadpool_limits
from sales_features import make_rows as raw_rows, feature_names
from pooled_forecast import predictions, score

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('source_reader', ROOT / 'scripts/benchmark-pooled.py')
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)
sha = source.sha

def make_rows(*args):
    rows=raw_rows(*args)
    # Canonical decimal features avoid libm/aggregation last-bit differences at tree thresholds.
    for row in rows:
        row['x']=np.round(row['x'],12)
    return rows

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':')) + '\n', encoding='utf-8')

def fit(rows, leaves, protocol):
    model = HistGradientBoostingRegressor(max_leaf_nodes=leaves, **protocol['fitting'])
    model.fit(np.asarray([r['x'] for r in rows]), np.asarray([r['residual'] for r in rows]), sample_weight=np.asarray([r['scale'] for r in rows]))
    return model

def export_trees(model):
    # Internal sklearn 1.7.2 layout is pinned and verified against Python on every test row.
    trees = []
    for iteration in model._predictors:
        if len(iteration) != 1:
            raise ValueError('Expected single-output regressor.')
        nodes = []
        for n in iteration[0].nodes:
            if n['is_categorical']:
                raise ValueError('Categorical trees are not supported by portable runtime.')
            nodes.append([int(n['feature_idx']), float(n['num_threshold']), int(n['left']), int(n['right']), float(n['value']), bool(n['is_leaf'])])
        trees.append(nodes)
    return {'bias': float(model._baseline_prediction[0, 0]), 'trees': trees}

def main():
    protocol_path = ROOT / 'benchmarks/kulakan/protocol.json'
    protocol = read(protocol_path)
    manifest = read(ROOT / protocol['sourceManifest'])
    original = manifest['protocol']
    raw = ROOT / 'datasets/public/freshretailnet/raw'
    for name, metadata in original['files'].items():
        if sha(raw / name) != metadata['sha256']:
            raise ValueError('Publisher checksum mismatch: ' + name)
    dev_keys = [tuple(item['key']) for item in manifest['series']]
    old = read(ROOT / protocol['excludedHoldout'])
    old_selection = read(ROOT / old['directory'] / 'selection.json')
    excluded = {k[:2] for k in dev_keys} | {tuple(k[:2]) for k in old_selection['holdoutKeys']}
    db = duckdb.connect()
    db.execute('SET threads=2')
    cols = 'city_id,store_id,product_id,dt,sale_amount,stock_hour6_22_cnt'
    db.read_parquet(str(raw / 'train.parquet')).project(cols).create_view('training')
    db.read_parquet(str(raw / 'eval.parquet')).project(cols).create_view('evaluation')
    keys = db.execute('SELECT DISTINCT city_id,store_id,product_id FROM training').fetchall()
    groups = {}
    for key in keys:
        if key[:2] not in excluded:
            groups.setdefault(key[:2], []).append(key)
    rank = lambda k: hashlib.sha256((protocol['selectionSalt'] + ':' + ':'.join(map(str, k))).encode()).hexdigest()
    chosen_stores = sorted(groups, key=rank)[:protocol['holdoutStores']]
    if len(chosen_stores) != protocol['holdoutStores']:
        raise ValueError('Insufficient new holdout stores.')
    holdout_keys = [min(groups[k], key=rank) for k in chosen_stores]
    run_id = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ') + '-' + uuid.uuid4().hex[:8]
    run = ROOT / 'models/benchmarks/kulakan' / run_id
    run.mkdir(parents=True)
    write(run / 'protocol.json', protocol)
    write(run / 'selection.json', {'developmentKeys': dev_keys, 'holdoutKeys': holdout_keys, 'previousHoldoutExcluded': old['runId']})
    write(run / 'state.json', {'stage': 'selection_frozen_before_training'})
    development = source.read_series(db, dev_keys)
    for entry in manifest['series']:
        if development[':'.join(map(str, entry['key']))] != entry['trainStockouts']:
            raise ValueError('Derived data differs from raw publisher observations.')
    candidates = []
    for variant in protocol['variants']:
        train = make_rows(development, variant, range(*protocol['trainOrigins']))
        val = make_rows(development, variant, range(*protocol['validationOrigins']))
        for leaves in protocol['leaves']:
            model = fit(train, leaves, protocol)
            for weight in protocol['residualWeights']:
                candidates.append({'variant': variant, 'leaves': leaves, 'weight': weight, **score([r['actual'] for r in val], predictions(model, val, weight))})
            print(f'Validation finished: {variant}, leaves={leaves}', flush=True)
    selected = min(candidates, key=lambda r: (r['mae'], r['weight'], r['leaves'], r['variant']))
    write(run / 'validation.json', {'candidates': candidates, 'selected': selected})
    all_rows = make_rows(development, selected['variant'], range(14, 90, 2))
    model = fit(all_rows, selected['leaves'], protocol)
    joblib.dump(model, run / 'model.joblib', compress=3)
    artifact = {'schemaVersion': 1, 'kind': protocol['kind'], 'runId': run_id,
                'trainedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
                'features': feature_names(selected['variant']), 'variant': selected['variant'], 'weight': selected['weight'],
                'horizonDays': 2, 'contextDays': 14, 'trainingSeries': len(dev_keys), 'trainingTargets': len(all_rows),
                'trainingThrough': '2024-06-25', 'trainingUnit': 'normalized_sales',
                'source': {'url': original['sourceUrl'], 'license': original['license'], 'revision': original['revision'], 'files': original['files']},
                'protocolSha256': sha(protocol_path), 'selectionSha256': sha(run / 'selection.json'),
                'limitations': protocol['limitations'], 'estimator': export_trees(model)}
    write(run / 'portable.json', artifact)
    write(run / 'state.json', {'stage': 'weights_frozen_before_holdout_labels', 'artifactSha256': sha(run / 'portable.json'), 'selected': selected})
    print('Weights frozen. Reading new-store test labels.', flush=True)
    holdout = source.read_series(db, holdout_keys, include_eval=True)
    test = make_rows(holdout, selected['variant'], protocol['testOrigins'])
    estimate = predictions(model, test, selected['weight'])
    fixtures = [{'history': holdout[r['key']][i-14:i], 'asOf': r['date'], 'expected': float(p)} for r, p in zip(test, estimate) for i in [next(j for j, v in enumerate(holdout[r['key']]) if v['date'] == r['date'])]]
    write(run / 'parity.json', fixtures)
    parity = subprocess.run(['node', 'scripts/verify-kulakan.mjs', str(run / 'portable.json'), str(run / 'parity.json')], cwd=ROOT, capture_output=True, text=True)
    if parity.returncode:
        raise RuntimeError(parity.stderr)
    print(parity.stdout, flush=True)
    metrics = {'model': score([r['actual'] for r in test], estimate)}
    for name in ['naive', 'ma7', 'ma14', 'weekly']:
        metrics[name] = score([r['actual'] for r in test], [r[name] for r in test])
    qualified = all(metrics['model']['mae'] < metrics[n]['mae'] for n in ['naive', 'ma7'])
    artifact['evaluation'] = {'scope': 'new_stores_same_public_dataset', 'stores': len(holdout_keys), 'targets': len(test), 'metrics': metrics, 'qualified': qualified, 'parityRows': len(fixtures)}
    # Demonstration is a fixed hash-selected holdout example, never picked for favourable error.
    key = ':'.join(map(str, holdout_keys[0]))
    cases = []
    for i in protocol['testOrigins']:
        row = next(r for r in test if r['key'] == key and r['date'] == holdout[key][i]['date'])
        cases.append({'asOf': row['date'], 'history': holdout[key][i-14:i], 'actual': row['actual'], 'baseline': row['ma7']})
    artifact['demonstration'] = {'seriesId': key, 'unit': 'normalized_sales', 'cases': cases}
    destination = ROOT / 'server/ml/artifacts/kulakan-sales-v1.json'
    write(destination, artifact)
    write(ROOT/'server/ml/kulakan-source.json',{'schemaVersion':1,'artifact':destination.name,'sha256':sha(destination),'runId':run_id})
    report = {'runId': run_id, 'artifactSha256': sha(destination), 'artifact': str(destination.relative_to(ROOT)).replace('\\', '/'),
              'training': {'series': len(dev_keys), 'stores': len({k[:2] for k in dev_keys}), 'targets': len(all_rows)},
              'selected': selected, 'validationCandidates': candidates, 'test': artifact['evaluation'],
              'checks': {'storeOverlap': len({k[:2] for k in holdout_keys} & excluded), 'noUserDatabaseAccess': True, 'nodePythonParityRows': len(fixtures), 'testLabelsReadAfterWeightsFrozen': True},
              'environment': {'sklearn': sklearn.__version__, 'numpy': np.__version__}, 'limitations': protocol['limitations']}
    write(run / 'report.json', report)
    write(ROOT / 'docs/evaluation/kulakan-model-results.json', report)
    write(run.parent / 'latest.json', {'directory': str(run.relative_to(ROOT)).replace('\\', '/'), 'runId': run_id})
    print(json.dumps(report), flush=True)

if __name__ == '__main__':
    with threadpool_limits(limits=2):
        main()
