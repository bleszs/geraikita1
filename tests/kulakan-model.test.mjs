import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadKulakanModel,predictKulakan,validateKulakanModel,evaluateLocalKulakan,kulakanModelSummary} from '../server/ml/kulakan-model.mjs';
import {forecast} from '../server/forecast.mjs';
import {addDays} from '../server/common.mjs';
import {createApp} from '../server/http.mjs';
import {createStore} from '../server/store.mjs';
import {createIdentity} from '../server/identity.mjs';
import {createService} from '../server/service.mjs';
import {dayAt,units} from '../server/common.mjs';
const artifact=loadKulakanModel();
const publicData=JSON.parse(readFileSync(new URL('./fixtures/kulakan-public-history.json',import.meta.url),'utf8'));
// Test-only date shift by 104 weeks preserves weekday features, after public training cutoff.
// These are never registered as production business records.
const shifted=index=>({asOf:addDays(publicData.series[index].asOf,728),history:publicData.series[index].history.map(r=>({...r,date:addDays(r.date,728)}))});

test('published learned trees match hashed evaluation and outperform both baseline references on the same heldout stores',()=>{
  assert.ok(artifact);assert.equal(artifact.estimator.trees.length,160);
  const report=JSON.parse(readFileSync(new URL('../docs/evaluation/kulakan-model-results.json',import.meta.url),'utf8'));
  const bytes=readFileSync(new URL('../server/ml/artifacts/kulakan-sales-v1.json',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),report.artifactSha256);
  assert.deepEqual(artifact.evaluation,report.test);
  assert.equal(report.checks.storeOverlap,0);assert.equal(report.test.targets,600);
  assert.ok(report.test.metrics.model.mae<report.test.metrics.ma7.mae);
  assert.ok(report.test.metrics.model.mae<report.test.metrics.naive.mae);
});

test('real public replay recomputes predictions from context, is scale-relative, and is not a fixed MA7 response',()=>{
  let differs=false;
  for(const c of artifact.demonstration.cases){
    const p=predictKulakan(artifact,c.history,c.asOf);
    assert.ok(Number.isFinite(p)&&p>=0);
    differs ||= Math.abs(p-c.baseline)>1e-5;
    const scaled=predictKulakan(artifact,c.history.map(r=>({...r,quantity:r.quantity*100})),c.asOf);
    assert.ok(Math.abs(scaled-p*100)<1e-7);
    const before=structuredClone(c.history);predictKulakan(artifact,c.history,c.asOf);assert.deepEqual(c.history,before);
  }
  assert.ok(differs);
});

test('inference refuses incomplete, stale, duplicate, negative, nonfinite and partial-day contexts',()=>{
  const c=artifact.demonstration.cases[0];
  for(const mutate of [h=>h.slice(1),h=>h.filter((_,i)=>i!==7),h=>h.map((r,i)=>i===3?{...r,date:h[2].date}:r),h=>h.map((r,i)=>i===2?{...r,quantity:-1}:r),h=>h.map((r,i)=>i===2?{...r,quantity:NaN}:r)])assert.throws(()=>predictKulakan(artifact,mutate(c.history),c.asOf));
  assert.throws(()=>predictKulakan(artifact,c.history,addDays(c.asOf,1)));
  assert.throws(()=>predictKulakan(artifact,[...c.history.slice(1),{date:c.asOf,quantity:1}],c.asOf));
});

test('local model wins must be measured; insufficient dates, gaps, pretraining targets and losing models retain baseline',()=>{
  const good=shifted(0),losing=shifted(2);
  assert.equal(evaluateLocalKulakan(good.history,good.asOf).status,'active');
  const rejected=evaluateLocalKulakan(losing.history,losing.asOf);assert.equal(rejected.status,'not_qualified');
  assert.ok(rejected.localMetrics.model.mae>rejected.localMetrics.ma7.mae);
  assert.equal(evaluateLocalKulakan(good.history.slice(-41),good.asOf).status,'insufficient_history');
  const gap=good.history.map((r,i)=>i===20?{...r,date:addDays(r.date,1)}:r);
  assert.equal(evaluateLocalKulakan(gap,good.asOf).status,'incomplete_history');
  assert.equal(evaluateLocalKulakan(publicData.series[0].history,publicData.series[0].asOf).status,'not_applicable');
  const baseline=forecast(losing.history,1,losing.asOf,2,'kg',null,artifact);
  assert.notEqual(baseline.method,'kulakan_sales_hgb');assert.equal(baseline.trainedModel.globalCandidate.status,'not_qualified');
});

test('qualified model computes actual purchase shortage and days from available stock, excluding current/future rows',()=>{
  const {history,asOf}=shifted(0),stock=.75;
  const result=forecast(history,stock,asOf,2,'kg',null,artifact);
  assert.equal(result.method,'kulakan_sales_hgb');assert.equal(result.trainedModel.source,'public_retail_with_local_backtest');
  const raw=predictKulakan(artifact,history.map(r=>({...r,quantity:r.qty})),asOf);
  assert.equal(result.amount,Math.ceil(Math.max(0,raw-stock)*100)/100);
  assert.equal(result.daysRemaining,Math.floor(stock/(raw/2)));
  assert.deepEqual(forecast([...history,{date:asOf,qty:999999},{date:addDays(asOf,1),qty:999999}],stock,asOf,2,'kg',null,artifact),result);
  const empty=forecast([],stock,asOf,2,'kg',null,artifact);assert.equal(empty.predicted,null);assert.equal(empty.amount,null);
});

test('invalid learned tree cycles and out-of-range feature references are rejected before inference',()=>{
  const cycle=structuredClone(artifact);cycle.estimator.trees[0][0][2]=0;assert.throws(()=>validateKulakanModel(cycle));
  const bad=structuredClone(artifact);bad.estimator.trees[0][0][0]=1000;assert.throws(()=>validateKulakanModel(bad));
});

test('explicit synthetic-demo provenance prevents using its records as local model qualification even after renaming',t=>{
  const store=createStore(':memory:');t.after(()=>store.close());
  const identity=createIdentity(store),service=createService(store),s=identity.register({businessName:'Isolated renamed demo',email:'synthetic-test@example.test',password:'Synthetic-test-password'});
  const p=service.saveIngredient(s,null,{name:'Isolated provenance test',unit:'kg',min:0,storageNote:'',catalogRevision:1});
  const rows=publicData.series[0].history,asOf=dayAt();
  for(let i=0;i<42;i++)store.run('INSERT INTO daily_usage VALUES(?,?,?,?,?)',s.workspace_id,s.business_id,p.id,addDays(asOf,i-42),units(rows[i].qty));
  store.run("UPDATE workspaces SET settings=json_set(settings,'$.forecastDataSource','synthetic_demo') WHERE id=?",s.workspace_id);
  const recommendation=service.bootstrap(s).recommendations[0];
  assert.notEqual(recommendation.method,'kulakan_sales_hgb');assert.equal(recommendation.trainedModel.globalCandidate,undefined);
});

test('real HTTP registration exposes model inference without adding business catalog, usage, stock or transactions',async t=>{
  const app=createApp({filename:':memory:',extractor:{status:async()=>({available:false})},transcriber:{status:async()=>({available:false})}});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>app.server.close(()=>{app.store.close();resolve();})));
  const response=await fetch(`http://127.0.0.1:${app.server.address().port}/api/auth/register`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({businessName:'Isolated model test',email:'kulakan@example.test',password:'Test-password-kulakan'})});
  assert.equal(response.status,201);const body=await response.json();
  assert.equal(body.kulakanModel.available,true);assert.equal(body.catalog.length,0);assert.equal(body.transactions.length,0);
  assert.equal(body.recommendations.length,0);assert.deepEqual(body.stock,{});
  assert.deepEqual(body.kulakanModel.demonstration,kulakanModelSummary().demonstration);
  const health=await fetch(`http://127.0.0.1:${app.server.address().port}/api/health`).then(r=>r.json());
  assert.equal(health.forecast.available,true);assert.equal(health.forecast.runId,artifact.runId);
});
