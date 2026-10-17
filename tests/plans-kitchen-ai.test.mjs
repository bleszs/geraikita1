import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server/http.mjs';
import {createStore} from '../server/store.mjs';
import {createIdentity} from '../server/identity.mjs';
import {createPlans} from '../server/plans.mjs';
import {parseOrder} from '../server/extractor.mjs';
import {createExtractor} from '../server/extractor.mjs';
const registration=()=>({email:randomUUID()+'@example.test',password:'KitchenAI2026!',businessName:'Usaha pengujian AI',communityName:'Kelompok pengujian'});

test('additive plan migration preserves previous rows and usage plus saved needs survive reopening',t=>{
  const directory=mkdtempSync(path.join(tmpdir(),'gerai-plan-test-')),filename=path.join(directory,'test.sqlite');let store=createStore(filename);
  t.after(()=>{store.close();assert.equal(path.dirname(path.resolve(directory)),path.resolve(tmpdir()));assert(path.basename(directory).startsWith('gerai-plan-test-'));rmSync(directory,{recursive:true,force:true});});
  const s=createIdentity(store).register(registration());store.db.exec('DROP TABLE ai_usage_events; DROP TABLE plan_interests');
  const tables=store.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map(r=>r.name),snapshot=()=>tables.map(name=>[name,store.all(`SELECT * FROM "${name}"`)]),before=snapshot();
  store.close();store=createStore(filename);assert.deepEqual(snapshot(),before);let plans=createPlans(store);
  const owner=createIdentity(store).resolve(s.id),token=plans.reserve(owner,'text');plans.finish(token,true);plans.interest(owner,{need:'ai',note:'Kebutuhan tercatat',confirmed:true});
  store.close();store=createStore(filename);plans=createPlans(store);assert.equal(plans.snapshot(owner).usage.text.used,1);assert.equal(plans.snapshot(owner).interest.need,'ai');assert.deepEqual(snapshot(),before);
});

test('quota is shared by a business, reserved atomically, refunds failures, expires abandoned reservations and resets by Jakarta month',t=>{
  const store=createStore(':memory:');t.after(()=>store.close());const identity=createIdentity(store),a=identity.register(registration()),b=identity.register(registration());
  let clock=Date.parse('2026-10-31T16:59:00Z');const plans=createPlans(store,{textLimit:1,speechLimit:1,now:()=>clock});
  const token=plans.reserve(a,'text');assert.throws(()=>plans.reserve({...a,account_id:'another-staff'},'text'),e=>e.code==='ai_quota_exhausted');
  assert.equal(plans.snapshot(b).usage.text.used,0);plans.finish(token,false);assert.equal(plans.snapshot(a).usage.text.used,0);
  const next=plans.reserve(a,'text');plans.finish(next,true);assert.equal(plans.snapshot(a).usage.text.remaining,0);
  clock=Date.parse('2026-10-31T17:00:00Z');assert.equal(plans.snapshot(a).period,'2026-11');assert.equal(plans.snapshot(a).usage.text.used,0);
  plans.reserve(a,'speech');clock+=300001;assert.equal(plans.snapshot(a).usage.speech.used,0);
  assert.equal(plans.snapshot(a).menuLimit,null);assert.equal(plans.snapshot(a).paidAvailable,false);
});

async function fixture(t,{limit=2,extract}={}){
  let calls=0;const app=createApp({filename:':memory:',planOptions:{textLimit:limit,speechLimit:1},extractor:{status:async()=>({provider:'ollama',available:true}),extract:async(text,menu)=>{calls++;assert(menu.every(m=>Object.keys(m).sort().join(',')==='aliases,id,name'));return extract?extract(text,menu,app):{items:parseOrder(text,menu),mode:'ollama',reason:'Model test double; not inference evidence.'};}},transcriber:{status:async()=>({available:true}),transcribe:async body=>{if(body.fail)throw Error('test failure');return {text:'dua roti uji'};}}});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
  async function auth(path,body){const r=await fetch(base+'/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
  const owner=await auth('register',registration());
  const post=(who,path,body={})=>fetch(base+'/api'+path,{method:'POST',headers:{cookie:who.cookie,'Content-Type':'application/json'},body:JSON.stringify({...body,csrf:who.data.csrf})});
  const s=app.store.get('SELECT * FROM sessions WHERE csrf=?',owner.data.csrf),p=app.service.saveIngredient(s,null,{name:'Tepung pengujian',unit:'gram',min:0,storageNote:'',catalogRevision:1});
  app.service.receive(s,{productId:p.id,qty:1000,unitPrice:1,supplier:'',idempotencyKey:randomUUID()});
  const menu=app.service.saveMenu(s,null,{name:'Roti uji',aliases:[],price:5000,recipe:{[p.id]:10},catalogRevision:2,preparation:{minutes:2,passiveMinutes:0,station:'uji'}});
  async function staff(role){const body={email:randomUUID()+'@example.test',password:'KitchenStaff2026!',name:'Staf '+role,role,confirmed:true,idempotencyKey:randomUUID()};assert.equal((await post(owner,'/staff',body)).status,201);return auth('login',body);}
  return {app,base,owner,post,staff,auth,menu,product:p.id,calls:()=>calls};
}

test('cashier AI review uses only its catalog, changes no stock, and creates an idempotent kitchen order only after confirmation',async t=>{
  const f=await fixture(t),cashier=await f.staff('cashier'),kitchen=await f.staff('kitchen'),other=await f.auth('register',registration());
  const body={text:'dua roti uji tanpa sambal',catalogRevision:3};
  assert.equal((await f.post(kitchen,'/kitchen/extractions',body)).status,403);
  assert.equal((await f.post(other,'/kitchen/extractions',body)).status,409);
  const response=await f.post(cashier,'/kitchen/extractions',body),result=await response.json();assert.equal(response.status,200);assert.equal(result.items[0].qty,2);assert.match(result.items[0].note,/tanpa sambal/);
  assert.equal(f.app.store.get('SELECT COUNT(*) AS n FROM kitchen_orders').n,0);assert.equal(f.app.store.get('SELECT COUNT(*) AS n FROM sales').n,0);
  const payload={label:'Meja pengujian',channel:'takeaway',items:[{...result.items[0],qty:3}],catalogRevision:result.catalogRevision,idempotencyKey:cashier.data.account.id+':'+cashier.data.account.roleRevision+':'+randomUUID()};
  for(let i=0;i<2;i++)assert.equal((await f.post(cashier,'/kitchen/orders',payload)).status,201);
  assert.equal(f.app.store.get('SELECT COUNT(*) AS n FROM kitchen_orders').n,1);assert.equal(f.app.store.get('SELECT COUNT(*) AS n FROM sales').n,0);
  const state=await(await fetch(f.base+'/api/bootstrap',{headers:{cookie:f.owner.cookie}})).json();assert.equal(state.stock[f.product],1000);assert.equal(state.availableStock[f.product],970);
});

test('both extraction endpoints share quota; exhausted quota uses explicit parser and leaves manual order entry available',async t=>{
  const f=await fixture(t,{limit:1}),body={text:'dua roti uji',catalogRevision:3};
  assert.equal((await(await f.post(f.owner,'/extractions',body)).json()).mode,'ollama');
  const next=await(await f.post(f.owner,'/kitchen/extractions',body)).json();assert.equal(next.mode,'rules');assert.match(next.reason,/Kuota AI/);assert.equal(f.calls(),1);
  assert.equal((await f.post(f.owner,'/kitchen/orders',{label:'Manual setelah kuota',channel:'dine_in',items:[{id:f.menu.id,qty:1}],catalogRevision:3,idempotencyKey:randomUUID()})).status,201);
  assert.equal((await f.post(f.owner,'/transcriptions',{})).status,200);assert.equal((await f.post(f.owner,'/transcriptions',{})).status,429);
});

test('fallback is refunded and stale catalogs or revoked sessions cannot return a usable AI draft',async t=>{
  const fallback=await fixture(t,{extract:async(text,menu)=>({items:parseOrder(text,menu),mode:'fallback',reason:'Explicit fallback'})});
  await fallback.post(fallback.owner,'/kitchen/extractions',{text:'dua roti uji',catalogRevision:3});
  assert.equal(fallback.app.store.get('SELECT COUNT(*) AS n FROM ai_usage_events').n,0);
  const stale=await fixture(t,{extract:async(text,menu,app)=>{app.store.run('UPDATE business_state SET catalog_revision=catalog_revision+1');return {items:parseOrder(text,menu),mode:'ollama'};}});
  assert.equal((await stale.post(stale.owner,'/kitchen/extractions',{text:'dua roti uji',catalogRevision:3})).status,409);
  assert.equal(stale.app.store.get('SELECT COUNT(*) AS n FROM ai_usage_events').n,0);
  const revoked=await fixture(t,{extract:async(text,menu,app)=>{app.store.run('DELETE FROM sessions');return {items:parseOrder(text,menu),mode:'ollama'};}});
  assert.equal((await revoked.post(revoked.owner,'/kitchen/extractions',{text:'dua roti uji',catalogRevision:3})).status,401);
  assert.equal(revoked.app.store.get('SELECT COUNT(*) AS n FROM ai_usage_events').n,0);
});

test('package interest is owner-only, requires consent, survives repeated submission and is scoped to its business',async t=>{
  const f=await fixture(t),cashier=await f.staff('cashier'),body={need:'ai',note:'Lebih banyak pesanan suara',confirmed:true};
  assert.equal((await f.post(cashier,'/account/plan-interest',body)).status,403);
  assert.equal((await f.post(f.owner,'/account/plan-interest',{...body,confirmed:false})).status,400);
  for(let i=0;i<2;i++)assert.equal((await f.post(f.owner,'/account/plan-interest',body)).status,200);
  assert.equal(f.app.store.get('SELECT COUNT(*) AS n FROM plan_interests').n,1);
  const other=await f.auth('register',registration());assert.equal(other.data.plan.interest,null);
});

test('recovery rate limit normalizes whitespace and case before counting failed attempts',async t=>{
  const f=await fixture(t),email=randomUUID()+'@example.test';
  for(let i=0;i<9;i++){
    const r=await fetch(f.base+'/api/auth/recover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:' '.repeat(i)+email.toUpperCase(),code:'INVALID',newPassword:'RecoveryTest2026!'})});
    assert.equal(r.status,i<8?401:429);
  }
});

test('invalid numeric evidence is rejected for owner and cashier without AI calls, quota or business writes',async t=>{
  let modelCalls=0;
  const extractor=createExtractor({fetcher:async()=>{modelCalls++;throw Error('Invalid input must not reach model');}});
  // Exercise the production evidence gate, not the fixture's item-only model double.
  const production=await fixture(t,{extract:(text,menu)=>extractor.extract(text,menu)}),staff=await production.staff('cashier');
  const bootstrap=async who=>(await(await fetch(production.base+'/api/bootstrap',{headers:{cookie:who.cookie}})).json());
  const before=await bootstrap(production.owner);
  for(const who of [production.owner,staff])for(const route of ['/kitchen/extractions',...(who===production.owner?['/extractions']:[])]){
    for(const text of ['roti uji 2 pedas 1 burger','roti uji dua belas','-2 roti uji','roti uji 2 pedas 3']){
      const response=await production.post(who,route,{text,catalogRevision:3});assert.equal(response.status,400);
    }
  }
  assert.equal(modelCalls,0);assert.equal(production.app.store.get('SELECT COUNT(*) AS n FROM ai_usage_events').n,0);
  const after=await bootstrap(production.owner);
  for(const key of ['stock','availableStock','transactions','kitchen','stockReceipts'])assert.deepEqual(after[key],before[key]);
  // A rejected draft does not prevent explicit manual order entry with a checked note.
  assert.equal((await production.post(production.owner,'/kitchen/orders',{label:'Pemeriksaan manual',channel:'dine_in',items:[{id:production.menu.id,qty:2,note:'Pedas tingkat 3; sudah diperiksa'}],catalogRevision:3,idempotencyKey:randomUUID()})).status,201);
});
