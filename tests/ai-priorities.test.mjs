import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStore} from '../server/store.mjs';
import {createIdentity} from '../server/identity.mjs';
import {createService} from '../server/service.mjs';
import {productionPlan} from '../server/production-plan.mjs';
import {createExtractor} from '../server/extractor.mjs';
import {speechVocabulary} from '../server/speech-vocabulary.mjs';
import {createTranscriber} from '../server/transcriber.mjs';
import {createApp} from '../server/http.mjs';

test('production targets use actual scoped recipes and available stock without writing business records',t=>{
 const store=createStore(':memory:');t.after(()=>store.close());const s=createIdentity(store).register({businessName:'Production test',email:randomUUID()+'@example.test',password:'Test-production-password'}),svc=createService(store);
 const rice=svc.saveIngredient(s,null,{name:'Beras',unit:'kg',min:0,storageNote:'',catalogRevision:1}),egg=svc.saveIngredient(s,null,{name:'Telur',unit:'butir',min:0,storageNote:'',catalogRevision:2});
 const m=svc.saveMenu(s,null,{name:'Nasi telur',price:10000,aliases:[],recipe:{[rice.id]:.1,[egg.id]:2},catalogRevision:3});
 const snap=()=>JSON.stringify(store.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map(({name})=>[name,store.all('SELECT * FROM "'+name+'"')]));
 const before=snap(),body={catalogRevision:4,items:[{id:m.id,qty:15}]};const r=productionPlan(store,s,body,(_,id)=>id===rice.id?12000:90000);
 assert.equal(r.kind,'production_target_calculation');assert.equal(r.ingredients.find(i=>i.productId===rice.id).buy,.3);assert.equal(r.ingredients.find(i=>i.productId===egg.id).buy,21);assert.equal(snap(),before);
 for(const items of [[],[{id:'other-business',qty:1}],[{id:m.id,qty:1.2}],[{id:m.id,qty:-1}],[{id:m.id,qty:1001}],[{id:m.id,qty:1},{id:m.id,qty:2}]])assert.throws(()=>productionPlan(store,s,{catalogRevision:4,items},()=>0));
 assert.throws(()=>productionPlan(store,s,{...body,catalogRevision:3},()=>0),e=>e.status===409);
});

test('Qwen outage falls back once, skips repeated waits, rejects unsafe text and probes again after cooldown',async()=>{
 let clock=100000,calls=0,online=false;const menu=[{id:'rice',name:'Nasi',aliases:['nasi']}];
 const extractor=createExtractor({now:()=>clock,cooldownMs:30000,fetcher:async()=>{calls++;if(!online)throw Error('unavailable');return {ok:true,json:async()=>({message:{content:JSON.stringify({items:[{id:'menu1',qty:2}]})}})};}});
 assert.equal((await extractor.extract('nasi 2',menu)).mode,'fallback');assert.equal(calls,1);
 assert.equal((await extractor.extract('nasi 2',menu)).mode,'fallback');assert.equal(calls,1);assert.equal((await extractor.status()).available,false);assert.equal(calls,1);
 await assert.rejects(extractor.extract('jangan nasi 2',menu));assert.equal(calls,1);
 clock+=30001;online=true;assert.equal((await extractor.extract('nasi 2',menu)).mode,'ollama');assert.equal(calls,2);
});

test('vocabulary is bounded, deduplicated and passed through runner without audio-body supplied hints',async()=>{
 const v=speechVocabulary([{name:'Nasi Goreng',aliases:['nasi goreng','Nasgor','<script>']},...Array.from({length:100},(_,i)=>({name:'Menu '+i}))]);assert.ok(v.length<=400);assert.ok(v.includes('Nasgor'));assert.ok(!v.includes('<'));assert.equal(v.split('Nasi Goreng').length,2);
 let hints;const engine=createTranscriber({verifyFiles:async()=>{},runner:async(_,o)=>{if(o.check)return {ready:true};hints=o.vocabulary;return {text:'nasi dua',durationSeconds:2};}});
 await engine.transcribe({mimeType:'audio/wav',audio:Buffer.from('transport fixture').toString('base64'),vocabulary:'injected'},{vocabulary:'Nasi Goreng'});assert.equal(hints,'Nasi Goreng');
});

test('production-plan HTTP requires authentication and CSRF and denies cashier',async t=>{
 const app=createApp({filename:':memory:',extractor:createExtractor({provider:'rules'}),transcriber:{status:async()=>({available:false})}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
 const post=(path,body,cookie)=>fetch(base+'/api'+path,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}: {})},body:JSON.stringify(body)});
 assert.equal((await post('/production-plan',{})).status,401);
 const reg=await post('/auth/register',{businessName:'HTTP plan',email:randomUUID()+'@example.test',password:'Http-test-password'}),cookie=reg.headers.get('set-cookie').split(';')[0],owner=await reg.json();
 assert.equal((await post('/production-plan',{},cookie)).status,403);
 const email=randomUUID()+'@example.test';await post('/staff',{name:'Cashier',role:'cashier',email,password:'Cashier-password',confirmed:true,idempotencyKey:randomUUID(),csrf:owner.csrf},cookie);
 const login=await post('/auth/login',{email,password:'Cashier-password'}),staff=await login.json(),sc=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await post('/production-plan',{csrf:staff.csrf},sc)).status,403);
});

test('speech HTTP vocabulary comes only from authenticated business catalog',async t=>{
 const hints=[];const app=createApp({filename:':memory:',extractor:createExtractor({provider:'rules'}),transcriber:{status:async()=>({available:true}),transcribe:async(_,options)=>{hints.push(options.vocabulary);return {text:'test',durationSeconds:2};}}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
 const post=(path,body,cookie)=>fetch(base+'/api'+path,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}: {})},body:JSON.stringify(body)});
 for(const name of ['Nasi A','Mie B']){
  const reg=await post('/auth/register',{businessName:name,email:randomUUID()+'@example.test',password:'Speech-scope-password'}),cookie=reg.headers.get('set-cookie').split(';')[0],owner=await reg.json();
  const p=await post('/ingredients',{name:'Bahan '+name,unit:'kg',min:0,storageNote:'',catalogRevision:1,csrf:owner.csrf},cookie).then(r=>r.json());
  const menu=await post('/menus',{name,price:10000,aliases:[],recipe:{[p.id]:.1},catalogRevision:2,csrf:owner.csrf},cookie);assert.equal(menu.status,201);
  const result=await post('/transcriptions',{audio:'fixture',vocabulary:'injected-other-menu',csrf:owner.csrf},cookie);assert.equal(result.status,200);
 }
 assert.equal(hints.length,2);assert.ok(hints[0].includes('Nasi A'));assert.ok(!hints[0].includes('Mie B'));assert.ok(hints[1].includes('Mie B'));assert.ok(!hints[1].includes('Nasi A'));assert.ok(hints.every(h=>!h.includes('injected')));
});
