import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStore} from '../server/store.mjs';
import {createIdentity} from '../server/identity.mjs';
import {createService} from '../server/service.mjs';
import {dayAt,addDays} from '../server/common.mjs';
import {createApp} from '../server/http.mjs';
import {createExtractor} from '../server/extractor.mjs';
function setup(t){const store=createStore(':memory:');t.after(()=>store.close());const identity=createIdentity(store),svc=createService(store);const register=()=>identity.register({businessName:'Uji catatan nyata',email:randomUUID()+'@example.test',password:'Zero-test-password'});const owner=register(),p=svc.saveIngredient(owner,null,{name:'Beras',unit:'kg',min:0,storageNote:'',catalogRevision:1});return {store,identity,svc,owner,p,register,body:{productId:p.id,date:addDays(dayAt(),-1),confirmed:true,catalogRevision:2}};}
test('explicit zero is attributable, reversible and changes neither stock, sales, finance nor unknown neighboring dates',t=>{
 const {store,svc,owner,p,body}=setup(t),before=svc.bootstrap(owner),saved=svc.saveZeroDay(owner,body),after=svc.bootstrap(owner);
 assert.equal(after.recommendations[0].historyQuality.explicitZeroDates,1);assert.equal(after.recommendations[0].historyQuality.recordedDates,1);assert.equal(after.recommendations[0].predicted,null);
 for(const key of ['stock','transactions','finance','stockReceipts','movements'])assert.deepEqual(after[key],before[key]);
 assert.equal(after.audit[0].actor.id,owner.account_id);assert.equal(after.usageZeroDays[0].id,saved.id);
 assert.equal(store.get('SELECT COUNT(*) n FROM daily_usage').n,1);assert.equal(svc.saveZeroDay(owner,body).duplicate,true);
 svc.retractZeroDay(owner,{...body,id:saved.id});assert.equal(store.get('SELECT COUNT(*) n FROM daily_usage').n,0);assert.equal(svc.bootstrap(owner).usageZeroDays.length,0);
 const again=svc.saveZeroDay(owner,body);assert.throws(()=>svc.retractZeroDay(owner,{...body,id:saved.id}),e=>e.status===409);assert.notEqual(saved.id,again.id);
});
test('zero confirmation rejects incomplete day, invalid dates, unchecked consent, stale catalog, foreign material and positive usage',t=>{
 const {store,svc,owner,p,body,register}=setup(t),other=register();
 for(const patch of [{date:dayAt()},{date:addDays(dayAt(),1)},{date:'2026-02-30'},{date:addDays(dayAt(),-366)},{confirmed:false},{catalogRevision:1},{productId:'foreign'}])assert.throws(()=>svc.saveZeroDay(owner,{...body,...patch}));
 assert.throws(()=>svc.saveZeroDay(other,body));assert.equal(store.get('SELECT COUNT(*) n FROM daily_usage').n,0);
 store.run('INSERT INTO daily_usage VALUES(?,?,?,?,?)',owner.workspace_id,owner.business_id,p.id,body.date,5000);assert.throws(()=>svc.saveZeroDay(owner,body),e=>e.status===409);assert.equal(store.get('SELECT quantity FROM daily_usage').quantity,5000);
});
test('retraction preserves preexisting transaction zero and refuses changed usage; write failures roll back atomically',t=>{
 const {store,svc,owner,p,body}=setup(t);
 store.run('INSERT INTO daily_usage VALUES(?,?,?,?,0)',owner.workspace_id,owner.business_id,p.id,body.date);const saved=svc.saveZeroDay(owner,body);
 svc.retractZeroDay(owner,{...body,id:saved.id});assert.equal(store.get('SELECT quantity FROM daily_usage').quantity,0);
 const next=svc.saveZeroDay(owner,body);store.run('UPDATE daily_usage SET quantity=100');assert.throws(()=>svc.retractZeroDay(owner,{...body,id:next.id}),e=>e.status===409);assert.equal(store.get('SELECT COUNT(*) n FROM usage_zero_confirmations').n,1);
 const log=store.log;store.log=()=>{throw Error('simulated disk failure');};try{assert.throws(()=>svc.saveZeroDay(owner,{...body,date:addDays(body.date,-1)}));}finally{store.log=log;}
 assert.equal(store.get('SELECT COUNT(*) n FROM daily_usage').n,1);
});
test('business joining a collective preserves zero provenance and ability to retract',t=>{
 const {store,svc,identity,owner,body,register}=setup(t),host=register();identity.createCommunity(host,{communityName:'Kelompok tujuan'});const saved=svc.saveZeroDay(owner,body);
 identity.joinCommunity(owner,{inviteCode:svc.bootstrap(host).community.inviteCode,confirmed:true,expectedWorkspace:owner.workspace_id});const current=identity.resolve(owner.id);
 assert.equal(svc.bootstrap(current).usageZeroDays[0].id,saved.id);assert.deepEqual(store.all('PRAGMA foreign_key_check'),[]);svc.retractZeroDay(current,{...body,id:saved.id,catalogRevision:svc.bootstrap(current).catalogRevision});assert.equal(store.get('SELECT COUNT(*) n FROM daily_usage').n,0);
});
test('HTTP zero recording requires login, CSRF and owner role; bootstrap never exposes another business confirmations',async t=>{
 const app=createApp({filename:':memory:',extractor:createExtractor({provider:'rules'}),transcriber:{status:async()=>({available:false})}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
 const post=(path,body,cookie)=>fetch(base+'/api'+path,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}: {})},body:JSON.stringify(body)});
 assert.equal((await post('/usage-zero-days',{})).status,401);
 const reg=await post('/auth/register',{businessName:'HTTP zero',email:randomUUID()+'@example.test',password:'Http-zero-password'}),cookie=reg.headers.get('set-cookie').split(';')[0],owner=await reg.json();
 assert.equal((await post('/usage-zero-days',{},cookie)).status,403);const p=await post('/ingredients',{name:'Beras',unit:'kg',min:0,storageNote:'',catalogRevision:1,csrf:owner.csrf},cookie).then(r=>r.json());
 assert.equal((await post('/usage-zero-days',{productId:p.id,date:addDays(dayAt(),-1),confirmed:true,catalogRevision:2,csrf:owner.csrf},cookie)).status,200);
 const email=randomUUID()+'@example.test';await post('/staff',{name:'Kasir',role:'cashier',email,password:'Cashier-password',confirmed:true,idempotencyKey:randomUUID(),csrf:owner.csrf},cookie);
 const login=await post('/auth/login',{email,password:'Cashier-password'}),staff=await login.json(),sc=login.headers.get('set-cookie').split(';')[0];
 for(const path of ['/usage-zero-days','/usage-zero-days/retract'])assert.equal((await post(path,{csrf:staff.csrf},sc)).status,403);
 const other=await post('/auth/register',{businessName:'Other HTTP zero',email:randomUUID()+'@example.test',password:'Http-zero-password'}).then(r=>r.json());assert.deepEqual(other.usageZeroDays,[]);
});
