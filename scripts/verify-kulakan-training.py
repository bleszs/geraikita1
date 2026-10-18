"""Rebuild heldout predictions from checked publisher records, without refitting or user DB access."""
import importlib.util
import json
import subprocess
from pathlib import Path
import duckdb
import joblib
import numpy as np
from threadpoolctl import threadpool_limits

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('training',ROOT/'scripts/train-kulakan.py')
training=importlib.util.module_from_spec(spec)
spec.loader.exec_module(training)

def main():
    pointer=training.read(ROOT/'models/benchmarks/kulakan/latest.json')
    run=(ROOT/pointer['directory']).resolve()
    if not run.is_relative_to((ROOT/'models/benchmarks/kulakan').resolve()):
        raise ValueError('Invalid run path.')
    report=training.read(run/'report.json')
    artifact_path=ROOT/report['artifact']
    artifact=training.read(artifact_path)
    if training.sha(artifact_path)!=report['artifactSha256']:
        raise ValueError('Published model checksum mismatch.')
    if training.sha(ROOT/'benchmarks/kulakan/protocol.json')!=artifact['protocolSha256'] or training.sha(run/'selection.json')!=artifact['selectionSha256']:
        raise ValueError('Frozen protocol/selection changed.')
    raw=ROOT/'datasets/public/freshretailnet/raw'
    for name,metadata in artifact['source']['files'].items():
        if training.sha(raw/name)!=metadata['sha256']:
            raise ValueError('Raw source hash changed.')
    selection=training.read(run/'selection.json')
    protocol=training.read(run/'protocol.json')
    db=duckdb.connect()
    db.execute('SET threads=2')
    cols='city_id,store_id,product_id,dt,sale_amount,stock_hour6_22_cnt'
    db.read_parquet(str(raw/'train.parquet')).project(cols).create_view('training')
    db.read_parquet(str(raw/'eval.parquet')).project(cols).create_view('evaluation')
    data=training.source.read_series(db,[tuple(k) for k in selection['holdoutKeys']],include_eval=True)
    rows=training.make_rows(data,artifact['variant'],protocol['testOrigins'])
    model=joblib.load(run/'model.joblib')
    predicted=training.predictions(model,rows,artifact['weight'])
    metrics={'model':training.score([r['actual'] for r in rows],predicted)}
    for name in ['naive','ma7','ma14','weekly']:
        metrics[name]=training.score([r['actual'] for r in rows],[r[name] for r in rows])
    if metrics!=artifact['evaluation']['metrics']:
        raise ValueError('Recomputed metrics differ.')
    # Persist every scored row for audit, including errors where the model loses.
    training.write(run/'predictions.json',[{**{k:v for k,v in row.items() if k!='x'},'model':float(p)} for row,p in zip(rows,predicted)])
    fixtures=training.read(run/'parity.json')
    if not np.allclose(predicted,[r['expected'] for r in fixtures],rtol=0,atol=1e-14):
        raise ValueError('Parity labels differ from reloaded estimator.')
    subprocess.run(['node','scripts/verify-kulakan.mjs',str(artifact_path),str(run/'parity.json')],cwd=ROOT,check=True)
    # Real, attributed public histories for unit tests; isolated from all business records.
    histories=[]
    for key in list(data)[:12]:
        histories.append({'seriesId':key,'asOf':data[key][90]['date'],'history':[{'date':r['date'],'qty':r['quantity']} for r in data[key][48:90]]})
    training.write(ROOT/'tests/fixtures/kulakan-public-history.json',{'source':artifact['source'],'unit':'normalized_sales','usage':'test_only_no_business_seeding','series':histories})
    result={'runId':pointer['runId'],'metricsRecomputedFromRaw':True,'rows':len(rows),'nodePythonParity':True,'noRefit':True,'noUserDatabaseAccess':True}
    training.write(ROOT/'docs/evaluation/kulakan-model-verification.json',result)
    print(json.dumps(result))

if __name__=='__main__':
    with threadpool_limits(limits=2):
        main()
