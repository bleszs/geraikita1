import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from './fixtures/store.mjs';
import {createStore as emptyStore} from '../server/store.mjs';
import {createService} from '../server/service.mjs';
import {createApp} from '../server/http.mjs';
import {migrateKitchen} from '../server/kitchen.mjs';
const fresh=(t,file=':memory:')=>{const store=createStore(file);t.after(()=>{try{store.close();}catch{}});const s=store.session(),svc=createService(store);return {store,s,svc};};
function configure(svc,s,id,minutes,station,passiveMinutes){const state=svc.bootstrap(s),m=state.menu.find(m=>m.id===id);svc.saveMenu(s,id,{...m,catalogRevision:state.catalogRevision,preparation:{minutes,station,passiveMinutes}});}
function enter(svc,s,label,items){return svc.kitchen.create(s,{label,channel:'dine_in',items,catalogRevision:svc.bootstrap(s).catalogRevision,idempotencyKey:randomUUID()});}
const find=(svc,s,id)=>svc.kitchen.snapshot(s).orders.find(o=>o.id===id);
function step(svc,s,id,action,taskId,extra={}){return svc.kitchen.change(s,id,{action,taskId,revision:find(svc,s,id).revision,idempotencyKey:randomUUID(),...extra});}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('station waiting limits are validated, scoped, revision guarded and preserved for older clients',t=>{
 const {s,svc,store}=fresh(t);configure(svc,s,'nasi',5,'dapur',2);
 assert.equal(svc.kitchen.snapshot(s).stations[0].agingMinutes,15);
 for(const agingMinutes of [0,121,1.5,'5',null])assert.throws(()=>svc.kitchen.saveStation(s,{station:'dapur',cooks:1,equipment:null,revision:0,agingMinutes}),/batas tunggu/);
 const saved=svc.kitchen.saveStation(s,{station:'dapur',cooks:1,equipment:null,revision:0,agingMinutes:5});assert.equal(saved.agingMinutes,5);
 const previous=svc.kitchen.snapshot(s).revision;
 assert.throws(()=>svc.kitchen.saveStation(s,{station:'dapur',cooks:1,equipment:null,revision:0,agingMinutes:30}),/berubah/);
 assert.equal(svc.kitchen.snapshot(s).revision,previous);
 const older=svc.kitchen.saveStation(s,{station:'dapur',cooks:2,equipment:null,revision:1});assert.equal(older.agingMinutes,5);
 const changed=svc.kitchen.saveStation(s,{station:'dapur',cooks:2,equipment:null,revision:2,agingMinutes:30});assert.equal(changed.agingMinutes,30);
 assert.notEqual(svc.kitchen.snapshot(s).revision,previous);
 const other=store.session('budi',s.workspace_id);assert.equal(svc.kitchen.snapshot(other).stations.find(c=>c.station==='dapur'),undefined);
 assert.throws(()=>svc.kitchen.saveStation(other,{station:'dapur',cooks:1,equipment:null,revision:0,agingMinutes:1}),/belum dipakai/);
});

test('legacy station migration adds default waiting minutes while preserving every existing station value',t=>{
 const {store,s,svc}=fresh(t);configure(svc,s,'nasi',5,'dapur',2);
 svc.kitchen.saveStation(s,{station:'dapur',cooks:2,equipment:1,revision:0});
 store.db.exec('ALTER TABLE kitchen_stations DROP COLUMN aging_minutes');
 const before=store.all('SELECT * FROM kitchen_stations');
 const legacyColumns=Object.keys(before[0]);
 migrateKitchen(store.db);
 assert.deepEqual(store.all('SELECT '+legacyColumns.join(',')+' FROM kitchen_stations'),before);
 assert.equal(store.get('SELECT aging_minutes FROM kitchen_stations').aging_minutes,15);
});

test('station capacity opens one priority slot per cook and limits passive equipment',t=>{
 const {s,svc}=fresh(t);configure(svc,s,'nasi',5,'dapur',2);
 const orders=[1,2,3].map(n=>enter(svc,s,'Meja '+n,[{id:'nasi',qty:1}])),task=o=>find(svc,s,o.id).tasks[0];
 let state=svc.kitchen.snapshot(s);const dapur=state.stations.find(c=>c.station==='dapur');
 assert.deepEqual([dapur.cooks,dapur.equipment,dapur.revision],[1,null,0]);assert.equal(state.next.find(n=>n.station==='dapur').taskIds.length,1);
 assert.throws(()=>svc.kitchen.saveStation(s,{station:'oven',cooks:2,equipment:null,revision:0}),/belum dipakai/);
 assert.throws(()=>svc.kitchen.saveStation(s,{station:'dapur',cooks:0,equipment:null,revision:0}),/staf aktif/);
 assert.equal(svc.kitchen.saveStation(s,{station:'Dapur',cooks:2,equipment:1,revision:0}).revision,1);
 assert.throws(()=>svc.kitchen.saveStation(s,{station:'dapur',cooks:3,equipment:1,revision:0}),/berubah/);
 state=svc.kitchen.snapshot(s);const slots=state.next.find(n=>n.station==='dapur').taskIds;assert.equal(slots.length,2);
 const [first,second]=slots.map(id=>orders.find(o=>task(o).id===id)),third=orders.find(o=>![first,second].includes(o));
 step(svc,s,first.id,'start',task(first).id);step(svc,s,second.id,'start',task(second).id);
 assert.throws(()=>step(svc,s,third.id,'start',task(third).id),/2 staf aktif/);
 step(svc,s,first.id,'passive',task(first).id);
 assert.throws(()=>step(svc,s,second.id,'passive',task(second).id),/penuh/);
 step(svc,s,third.id,'start',task(third).id);
 assert.throws(()=>step(svc,s,first.id,'resume',task(first).id),/2 staf aktif/);
 step(svc,s,first.id,'ready',task(first).id);step(svc,s,second.id,'passive',task(second).id);
});

test('voiding a queued item releases only its reservation and the sale excludes it',t=>{
 const {s,svc}=fresh(t);configure(svc,s,'ayam',10,'dapur',3);configure(svc,s,'teh',2,'minuman',0);
 const before=svc.bootstrap(s),o=enter(svc,s,'Meja 4',[{id:'ayam',qty:1},{id:'teh',qty:1}]),tasks=find(svc,s,o.id).tasks,tea=tasks.find(x=>x.menu_id==='teh'),chicken=tasks.find(x=>x.menu_id==='ayam');
 assert.throws(()=>step(svc,s,o.id,'void',tea.id,{wasted:{gula:0}}),/belum dikerjakan/);
 step(svc,s,o.id,'void',tea.id);let state=svc.bootstrap(s),order=state.kitchen.orders.find(x=>x.id===o.id);
 assert.equal(order.total,18000);assert.equal(order.status,'queued');assert.equal(order.items.find(i=>i.id==='teh').voided,true);
 close(state.availableStock.gula,before.availableStock.gula);close(state.availableStock.gelas,before.availableStock.gelas);close(state.availableStock.telur,before.availableStock.telur-1);
 assert.deepEqual(state.stock,before.stock);assert.equal(state.movements.length,before.movements.length);
 assert.throws(()=>step(svc,s,o.id,'void',chicken.id),/item terakhir/);
 assert.deepEqual(svc.kitchen.command(s,{text:'mulai ayam geprek meja empat',revisions:{[o.id]:order.revision}}).taskId,chicken.id);
 step(svc,s,o.id,'start',chicken.id);step(svc,s,o.id,'ready',chicken.id);const done=step(svc,s,o.id,'complete');
 state=svc.bootstrap(s);const sale=state.transactions.find(x=>x.id===done.saleId);
 assert.equal(sale.total,18000);assert.deepEqual(sale.items.map(i=>i.id),['ayam']);close(state.stock.gula,before.stock.gula);close(state.stock.telur,before.stock.telur-1);
});

test('started item records owner-entered partial waste and returns unused reservation',t=>{
 const {s,svc}=fresh(t);configure(svc,s,'ayam',10,'dapur',3);configure(svc,s,'teh',2,'minuman',0);
 const before=svc.bootstrap(s),o=enter(svc,s,'Meja 5',[{id:'ayam',qty:2},{id:'teh',qty:1}]),chicken=find(svc,s,o.id).tasks.find(x=>x.menu_id==='ayam');
 assert.deepEqual(chicken.usage,{telur:20000,beras:3000,minyak:1000});
 step(svc,s,o.id,'start',chicken.id);
 assert.throws(()=>step(svc,s,o.id,'void',chicken.id,{wasted:{telur:1}}),/Konfirmasi/);
 assert.throws(()=>step(svc,s,o.id,'void',chicken.id,{confirmed:true,wasted:{telur:3}}),/0 sampai/);
 assert.throws(()=>step(svc,s,o.id,'void',chicken.id,{confirmed:true,wasted:{gula:0.01}}),/resep item/);
 step(svc,s,o.id,'void',chicken.id,{confirmed:true,wasted:{telur:1,beras:0}});
 const state=svc.bootstrap(s),order=state.kitchen.orders.find(x=>x.id===o.id);
 close(state.stock.telur,before.stock.telur-1);close(state.stock.beras,before.stock.beras);close(state.stock.minyak,before.stock.minyak-0.1);
 close(state.availableStock.telur,before.availableStock.telur-1);close(state.availableStock.gula,before.availableStock.gula-0.04);
 assert.equal(order.total,8000);assert.equal(order.tasks.find(x=>x.id===chicken.id).status,'voided');assert.deepEqual(order.tasks.find(x=>x.id===chicken.id).waste,{telur:10000,beras:0,minyak:1000});
 assert.deepEqual(state.movements.filter(m=>m.reason==='kitchen_waste').length,2);assert.equal(state.transactions.length,before.transactions.length);
});

test('order discard can record only the ingredients actually used',t=>{
 const {s,svc}=fresh(t);configure(svc,s,'ayam',10,'dapur',3);
 const before=svc.bootstrap(s),o=enter(svc,s,'Meja 6',[{id:'ayam',qty:1}]),task=find(svc,s,o.id).tasks[0];step(svc,s,o.id,'start',task.id);
 assert.throws(()=>step(svc,s,o.id,'discard',null,{confirmed:true,wasted:{beras:1}}),/0 sampai/);
 assert.equal(step(svc,s,o.id,'discard',null,{confirmed:true,wasted:{telur:0,beras:0.1,minyak:0}}).status,'discarded');
 const state=svc.bootstrap(s);close(state.stock.telur,before.stock.telur);close(state.stock.beras,before.stock.beras-0.1);
 assert.deepEqual(state.availableStock.telur,before.availableStock.telur);assert.equal(state.transactions.length,before.transactions.length);
});

test('legacy multi-item tasks without per-item usage refuse item void; migration adds columns without changing data',t=>{
 const dir=mkdtempSync(join(tmpdir(),'gerai-capacity-')),file=join(dir,'store.sqlite');
 const {store,s,svc}=fresh(t,file);configure(svc,s,'ayam',10,'dapur',3);configure(svc,s,'teh',2,'minuman',0);
 const o=enter(svc,s,'Lama',[{id:'ayam',qty:1},{id:'teh',qty:1}]);
 store.db.exec('DROP TABLE kitchen_stations;ALTER TABLE kitchen_tasks DROP COLUMN waste_json;ALTER TABLE kitchen_tasks DROP COLUMN usage_json;ALTER TABLE kitchen_tasks DROP COLUMN item_index');
 const tables=()=>store.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(x=>x.name),old=tables();
 const rows=st=>old.map(n=>[n,st.all(`SELECT * FROM ${n}`).map(r=>{const {item_index,usage_json,waste_json,...rest}=r;return JSON.stringify(rest);}).sort()]),before=rows(store);store.close();
 const reopened=emptyStore(file);t.after(()=>{reopened.close();rmSync(dir,{recursive:true,force:true});});assert.deepEqual(rows(reopened),before);
 assert.deepEqual(reopened.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(x=>x.name),[...old,'kitchen_stations'].sort());
 assert.equal(reopened.get('SELECT COUNT(*) AS n FROM kitchen_tasks WHERE usage_json IS NOT NULL OR item_index IS NOT NULL').n,0);
 const legacy=createService(reopened),order=legacy.kitchen.snapshot(s).orders.find(x=>x.id===o.id),tea=order.tasks.find(x=>x.menu_id==='teh');
 assert.equal(tea.usage,null);assert.throws(()=>legacy.kitchen.change(s,o.id,{action:'void',taskId:tea.id,revision:order.revision,idempotencyKey:randomUUID()}),/Pesanan lama/);
});

test('etaMinutes tracks remaining work and decreases as tasks advance through phases',t=>{
 const {s,svc}=fresh(t);configure(svc,s,'nasi',8,'dapur',5);// 8 min active, 5 min passive
 const o=enter(svc,s,'ETA test',[{id:'nasi',qty:2}]);
 let order=svc.kitchen.snapshot(s).orders.find(x=>x.id===o.id);
 assert.equal(order.tasks[0].etaMinutes,8*2,'queued: (active+passive)×qty');
 assert.equal(order.etaMinutes,8*2,'order ETA=task ETA');
 step(svc,s,o.id,'start',order.tasks[0].id);
 order=svc.kitchen.snapshot(s).orders.find(x=>x.id===o.id);
 assert.ok(order.tasks[0].etaMinutes<=8*2,'active ETA ≤ queued ETA');
 assert.ok(order.tasks[0].etaMinutes>=0,'ETA non-negative');
 step(svc,s,o.id,'passive',order.tasks[0].id);
 order=svc.kitchen.snapshot(s).orders.find(x=>x.id===o.id);
 assert.ok(order.tasks[0].etaMinutes<=5*2,'passive ETA ≤ passive_minutes×qty');
 step(svc,s,o.id,'ready',order.tasks[0].id);
 order=svc.kitchen.snapshot(s).orders.find(x=>x.id===o.id);
 assert.equal(order.tasks[0].etaMinutes,null,'ready task ETA=null');
 assert.equal(order.etaMinutes,0,'all ready: order ETA=0');
});
test('etaMinutes accounts for tasks ahead in queue at single-worker station',t=>{
 const {s,svc}=fresh(t);configure(svc,s,'nasi',8,'dapur',5);// default cooks=1
 const o1=enter(svc,s,'Meja A',[{id:'nasi',qty:1}]),o2=enter(svc,s,'Meja B',[{id:'nasi',qty:1}]);
 const snap=svc.kitchen.snapshot(s);
 const firstId=snap.next.find(n=>n.station==='dapur').taskIds[0];
 const first=snap.orders.find(o=>o.tasks.some(t=>t.id===firstId));
 const second=snap.orders.find(o=>[o1.id,o2.id].includes(o.id)&&o.id!==first.id);
 assert.equal(first.tasks[0].etaMinutes,8,'first task: total 8 includes passive 5');
 assert.equal(second.tasks[0].etaMinutes,11,'second starts after first active phase 3, then takes total 8');
 assert.equal(first.etaMinutes,first.tasks[0].etaMinutes);
 assert.equal(second.etaMinutes,second.tasks[0].etaMinutes);
});
test('HTTP: owner sets capacity; kitchen voids with full waste only; cashier cannot void',async t=>{
 const app=createApp({filename:':memory:',extractor:{status:async()=>({provider:'rules'})},transcriber:{status:async()=>({available:false})}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
 async function auth(path,body){const r=await fetch(base+'/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok(r.ok);return {data:await r.json(),cookie:r.headers.get('set-cookie').split(';')[0]};}
 const staff=role=>({email:randomUUID()+'@example.test',password:'StaffTesting2026!',name:'Staf '+role,role,confirmed:true,idempotencyKey:randomUUID()});
 const owner=await auth('register',{email:randomUUID()+'@example.test',password:'OwnerTesting2026!',businessName:'Usaha',communityName:'Kelompok'});
 const post=(who,path,body={})=>fetch(base+'/api'+path,{method:'POST',headers:{cookie:who.cookie,'Content-Type':'application/json'},body:JSON.stringify({...body,csrf:who.data.csrf})});
 const cb=staff('cashier'),kb=staff('kitchen');for(const b of [cb,kb])assert.equal((await post(owner,'/staff',b)).status,201);const cashier=await auth('login',cb),kitchen=await auth('login',kb);
 const s=app.store.get('SELECT * FROM sessions WHERE csrf=?',owner.data.csrf),svc=app.service;
 const p=svc.saveIngredient(s,null,{name:'Tepung',unit:'gram',min:0,storageNote:'',catalogRevision:1});svc.receive(s,{productId:p.id,qty:1000,unitPrice:1,supplier:'',idempotencyKey:randomUUID()});
 const m=svc.saveMenu(s,null,{name:'Roti',price:5000,aliases:[],recipe:{[p.id]:10},catalogRevision:2,preparation:{minutes:4,passiveMinutes:1,station:'oven'}});
 assert.equal((await post(kitchen,'/kitchen/stations',{station:'oven',cooks:2,equipment:null,revision:0})).status,403);
 assert.equal((await post(owner,'/kitchen/stations',{station:'oven',cooks:2,equipment:3,revision:0})).status,200);
 const prefix=who=>who.data.account.id+':'+who.data.account.roleRevision+':';
 const {id}=await(await post(cashier,'/kitchen/orders',{label:'Meja 1',channel:'dine_in',items:[{id:m.id,qty:1},{id:m.id,qty:2}],catalogRevision:3,idempotencyKey:prefix(cashier)+randomUUID()})).json();
 const k=await(await fetch(base+'/api/bootstrap',{headers:{cookie:kitchen.cookie}})).json(),o=k.kitchen.orders.find(o=>o.id===id);
 assert.deepEqual(k.kitchen.stations.map(c=>[c.station,c.cooks,c.equipment,'revision' in c]),[['oven',2,3,false]]);assert.equal(k.kitchen.next[0].taskIds.length,2);
 assert.equal(o.etaMinutes,svc.kitchen.snapshot(s).orders.find(x=>x.id===id).etaMinutes);assert.equal(o.tasks[0].etaMinutes,4);assert.equal('usage' in o.tasks[0],false);assert.equal(JSON.stringify(k).includes('Tepung'),false);
 const [a,b]=o.tasks;
 assert.equal((await post(cashier,`/kitchen/orders/${id}/actions`,{action:'void',taskId:a.id,revision:1,idempotencyKey:prefix(cashier)+randomUUID()})).status,403);
 assert.equal((await post(kitchen,`/kitchen/orders/${id}/actions`,{action:'start',taskId:a.id,revision:1,idempotencyKey:prefix(kitchen)+randomUUID()})).status,200);
 assert.equal((await post(kitchen,`/kitchen/orders/${id}/actions`,{action:'void',taskId:a.id,revision:2,confirmed:true,wasted:{[p.id]:0},idempotencyKey:prefix(kitchen)+randomUUID()})).status,403);
 assert.equal((await post(kitchen,`/kitchen/orders/${id}/actions`,{action:'void',taskId:a.id,revision:2,confirmed:true,idempotencyKey:prefix(kitchen)+randomUUID()})).status,403);
 const after=svc.bootstrap(s);close(after.stock[p.id],1000);close(after.availableStock[p.id],1000-a.qty*10-b.qty*10);
});
