import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/http.mjs';
import {createExtractor} from '../server/extractor.mjs';
import {createStore} from '../server/store.mjs';
import {createIdentity} from '../server/identity.mjs';
import {createService} from '../server/service.mjs';
import {dayAt,addDays,units} from '../server/common.mjs';
import {forecast} from '../server/forecast.mjs';
import {screenUsage} from '../server/ml/usage-anomalies.mjs';
import {screenDrift} from '../server/ml/usage-drift.mjs';

const registration=extra=>({businessName:'Isolated review',communityName:'Isolated review group',email:randomUUID()+'@example.test',password:'Review-contract-only-456',...extra});
function fixture(t){
  const store=createStore(':memory:');t.after(()=>store.close());
  const service=createService(store),identity=createIdentity(store),owner=identity.register(registration());
  const ingredient=service.saveIngredient(owner,null,{name:'Isolated review ingredient',unit:'kg',min:0,storageNote:'',catalogRevision:1});
  const insert=(date,qty)=>store.run('INSERT INTO daily_usage VALUES(?,?,?,?,?)',owner.workspace_id,owner.business_id,ingredient.id,date,units(qty));
  const snapshot=()=>store.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map(({name})=>[name,store.all('SELECT * FROM "'+name+'"')]);
  return {store,service,identity,owner,ingredient,insert,snapshot};
}

test('bootstrap exposes the actual screening contract without changing existing forecast values',t=>{
  const f=fixture(t),asOf=dayAt();
  const history=Array.from({length:84},(_,i)=>({date:addDays(asOf,i-84),qty:i===83?60:10}));
  history.push({date:asOf,qty:999},{date:addDays(asOf,1),qty:999});
  for(const row of history)f.insert(row.date,row.qty);
  const before=f.snapshot(),recommendation=f.service.bootstrap(f.owner).recommendations[0];
  assert.deepEqual(recommendation.usageScreening,screenUsage(history,{asOf,unit:'kg'}));
  assert.equal(recommendation.usageScreening.summary.reviewCandidates,1);
  assert.deepEqual(recommendation.driftScreening,screenDrift(history,{asOf,unit:'kg'}));
  const {productId,usageScreening,driftScreening,...existing}=recommendation;
  assert.equal(existing.trainedModel.globalCandidate.status,'not_qualified');
  assert.ok(existing.trainedModel.globalCandidate.localMetrics.model.mae>=existing.trainedModel.globalCandidate.localMetrics.ma7.mae);
  delete existing.trainedModel.globalCandidate;
  assert.equal(productId,f.ingredient.id);assert.deepEqual(existing,forecast(history,0,asOf,2,'kg'));
  assert.deepEqual(f.snapshot(),before);
});

test('empty ledger stays unknown, with no generated observations or review acknowledgements',t=>{
  const f=fixture(t),before=f.snapshot();
  for(let i=0;i<3;i++){
    const report=f.service.bootstrap(f.owner).recommendations[0].usageScreening;
    assert.equal(report.status,'no_history');assert.equal(report.summary.screened,0);
    assert.equal(report.results.every(r=>r.quantity===null&&r.review===null),true);
  }
  assert.deepEqual(f.snapshot(),before);
});

test('corrected ledger recomputes screening and gaps remain unknown instead of becoming zeros',t=>{
  const f=fixture(t),asOf=dayAt();
  for(let i=0;i<84;i++)f.insert(addDays(asOf,i-84),i===83?60:10);
  const read=()=>f.service.bootstrap(f.owner).recommendations[0].usageScreening;
  assert.equal(read().summary.reviewCandidates,1);
  f.store.run('UPDATE daily_usage SET quantity=? WHERE workspace_id=? AND business_id=? AND product_id=? AND date=?',units(10),f.owner.workspace_id,f.owner.business_id,f.ingredient.id,addDays(asOf,-1));
  assert.equal(read().summary.reviewCandidates,0);
  f.store.run('DELETE FROM daily_usage WHERE workspace_id=? AND business_id=? AND product_id=? AND date=?',f.owner.workspace_id,f.owner.business_id,f.ingredient.id,addDays(asOf,-2));
  const after=read();assert.equal(after.results.at(-1).status,'reference_has_gaps');assert.equal(after.results.at(-1).review,null);
  assert.equal(after.results.at(-2).quantity,null);assert.equal(after.results.at(-2).review,null);
});

test('HTTP bootstrap requires login and never exposes another business screening through query filters',async t=>{
  const app=createApp({filename:':memory:',extractor:createExtractor({provider:'rules'}),transcriber:{status:async()=>({available:false,model:'whisper-tiny'})}});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
  const base='http://127.0.0.1:'+app.server.address().port;
  assert.equal((await fetch(base+'/api/bootstrap')).status,401);
  async function register(extra){const r=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(registration(extra))});assert.equal(r.status,201);return {state:await r.json(),cookie:r.headers.get('set-cookie').split(';')[0]};}
  const owner=await register(),member=await register({inviteCode:owner.state.community.inviteCode}),outside=await register();
  const ingredient=app.service.saveIngredient({workspace_id:owner.state.workspaceId,business_id:owner.state.business.id},null,{name:'Private review ingredient',unit:'kg',min:0,storageNote:'',catalogRevision:1});
  for(let i=0;i<84;i++)app.store.run('INSERT INTO daily_usage VALUES(?,?,?,?,?)',owner.state.workspaceId,owner.state.business.id,ingredient.id,addDays(dayAt(),i-84),units(i===83?60:10));
  for(const client of [member,outside]){
    const r=await fetch(base+'/api/bootstrap?business='+owner.state.business.id+'&product='+ingredient.id,{headers:{cookie:client.cookie}});
    assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
    const data=await r.json();assert.deepEqual(data.recommendations,[]);assert.deepEqual(data.catalog,[]);
    assert.equal(JSON.stringify(data).includes('Private review ingredient'),false);
  }
  const r=await fetch(base+'/api/bootstrap',{headers:{cookie:owner.cookie}}),data=await r.json();
  assert.equal(data.recommendations[0].usageScreening.summary.reviewCandidates,1);
  assert.equal(data.recommendations[0].usageScreening.asOf,dayAt());
});
