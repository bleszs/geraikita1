import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request as httpRequest} from 'node:http';
import {createStore} from '../server/store.mjs';
import {createIdentity} from '../server/identity.mjs';
import {createApp} from '../server/http.mjs';
import {staffPrefix} from '../server/roles.mjs';
const registration=()=>({email:randomUUID()+'@example.test',password:'OwnerTesting2026!',businessName:'Usaha utama',communityName:'Kelompok'});
const staffBody=(role='cashier')=>({email:randomUUID()+'@example.test',password:'StaffTesting2026!',name:'Staf uji '+role,role,confirmed:true,idempotencyKey:randomUUID()});
function fixture(t){const store=createStore(':memory:');t.after(()=>store.close());const identity=createIdentity(store),owner=identity.register(registration());return {store,identity,owner};}
test('role migration preserves every existing table and session; reopen retains roles and never repairs missing roles into owners',t=>{
 const dir=mkdtempSync(join(tmpdir(),'gerai-staff-')),file=join(dir,'test.sqlite');let store=createStore(file);
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 let identity=createIdentity(store);const owner=identity.register(registration());store.db.exec('DROP TABLE staff_actions; DROP TABLE account_roles');
 const tables=store.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(x=>x.name);assert.equal(tables.length,35);
 const snapshot=()=>tables.map(name=>[name,store.all(`SELECT * FROM ${name}`).map(r=>JSON.stringify(r)).sort()]);const before=snapshot();store.close();store=createStore(file);identity=createIdentity(store);
 assert.deepEqual(snapshot(),before);assert.equal(identity.resolve(owner.id).role,'owner');assert.equal(store.get('SELECT COUNT(*) AS n FROM account_roles').n,1);
 const a=staffBody(),b=staffBody('kitchen');identity.createStaff(identity.resolve(owner.id),a);const deleted=identity.createStaff(identity.resolve(owner.id),b);const session=identity.login(a),missing=identity.login(b);store.run('DELETE FROM account_roles WHERE account_id=?',deleted.id);
 store.close();store=createStore(file);identity=createIdentity(store);assert.equal(identity.resolve(session.id).role,'cashier');assert.equal(identity.resolve(missing.id),undefined);assert.throws(()=>identity.login(b),/sesuai/);assert.equal(store.get('SELECT COUNT(*) AS n FROM account_roles').n,2);
});
test('staff creation has one business, explicit roles, scoped metadata, hashed passwords and idempotent recovery',t=>{
 const {store,identity,owner}=fixture(t),b=staffBody(),created=identity.createStaff(owner,b);assert.equal(identity.createStaff(owner,{...b,password:'OtherPassword2026!'}).duplicate,true);
 const s=identity.login(b);assert.equal(s.role,'cashier');assert.equal(s.business_id,owner.business_id);assert.equal(store.get('SELECT COUNT(*) AS n FROM businesses').n,1);
 assert.equal(store.get('SELECT password_hash FROM accounts WHERE id=?',created.id).password_hash.includes(b.password),false);assert.equal(JSON.stringify(identity.staff(owner)).includes(b.password),false);assert.equal(identity.details(s).role,'cashier');
 assert.throws(()=>identity.createStaff(owner,{...staffBody(),role:'owner'}),/peran/);assert.throws(()=>identity.createStaff(s,staffBody()),/pemilik/);assert.throws(()=>identity.createStaff(owner,{...b,name:'Different'}),/Kunci/);
});
test('disable and role changes revoke every target session; enabling never resurrects old sessions',t=>{
 const {identity,owner}=fixture(t),b=staffBody(),{id}=identity.createStaff(owner,b),one=identity.login(b),two=identity.login(b);
 const change={action:'disable',revision:1,confirmed:true,idempotencyKey:randomUUID()};identity.updateStaff(owner,id,change);assert.equal(identity.updateStaff(owner,id,change).duplicate,true);
 assert.equal(identity.resolve(one.id),undefined);assert.equal(identity.resolve(two.id),undefined);assert.throws(()=>identity.login(b),/sesuai/);assert.ok(identity.resolve(owner.id));
 identity.updateStaff(owner,id,{action:'enable',revision:2,confirmed:true,idempotencyKey:randomUUID()});assert.equal(identity.resolve(one.id),undefined);const next=identity.login(b);assert.equal(next.role,'cashier');
 identity.updateStaff(owner,id,{action:'role',role:'kitchen',revision:3,confirmed:true,idempotencyKey:randomUUID()});assert.equal(identity.resolve(next.id),undefined);assert.equal(identity.login(b).role,'kitchen');
});
test('staff changes reject foreign scope, owner targets, stale versions and missing approval',t=>{
 const {identity,owner}=fixture(t),{id}=identity.createStaff(owner,staffBody()),other=identity.register(registration());
 const b={action:'disable',revision:1,confirmed:true,idempotencyKey:randomUUID()};assert.throws(()=>identity.updateStaff(other,id,b),/tidak ditemukan/);assert.throws(()=>identity.updateStaff(owner,identity.details(owner).id,b),/tidak ditemukan/);
 assert.throws(()=>identity.updateStaff(owner,id,{...b,confirmed:false}),/Periksa/);identity.updateStaff(owner,id,b);assert.throws(()=>identity.updateStaff(owner,id,{...b,idempotencyKey:randomUUID()}),/berubah/);
});
test('missing role rows fail closed rather than silently granting ownership',t=>{
 const {store,identity,owner}=fixture(t),b=staffBody();const {id}=identity.createStaff(owner,b),s=identity.login(b);store.run('DELETE FROM account_roles WHERE account_id=?',id);assert.equal(identity.resolve(s.id),undefined);assert.throws(()=>identity.login(b),/sesuai/);
});
test('HTTP role matrix prevents owner API access, strips kitchen finance and lets staff finish one real order',async t=>{
 const app=createApp({filename:':memory:',extractor:{status:async()=>({provider:'rules'})},transcriber:{status:async()=>({available:false})}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
 async function auth(path,body){const r=await fetch(base+'/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok(r.ok);return {data:await r.json(),cookie:r.headers.get('set-cookie').split(';')[0]};}
 const owner=await auth('register',registration());const post=(who,path,body={})=>fetch(base+'/api'+path,{method:'POST',headers:{cookie:who.cookie,'Content-Type':'application/json'},body:JSON.stringify({...body,csrf:who.data.csrf})});
 const cb=staffBody(),kb=staffBody('kitchen');for(const b of [cb,kb])assert.equal((await post(owner,'/staff',b)).status,201);const cashier=await auth('login',cb),kitchen=await auth('login',kb);
 const s=app.identity||app.store.get('SELECT * FROM sessions WHERE csrf=?',owner.data.csrf),svc=app.service;
 const p=svc.saveIngredient(s,null,{name:'Bahan rahasia',unit:'gram',min:0,storageNote:'Catatan rahasia',catalogRevision:1});svc.receive(s,{productId:p.id,qty:1000,unitPrice:999,supplier:'Pemasok pribadi',idempotencyKey:randomUUID()});
 const m=svc.saveMenu(s,null,{name:'Menu pesanan',price:27000,aliases:[],recipe:{[p.id]:25},catalogRevision:2,preparation:{minutes:5,passiveMinutes:1,station:'dapur'}});
 for(const who of [cashier,kitchen])for(const path of ['/staff','/menus','/ingredients','/offers','/displays','/community/invite','/usage-reviews'])assert.equal((await post(who,path,{workspace_id:'fake',role:'owner'})).status,403,path);
 assert.equal((await post(kitchen,'/transactions',{workspace_id:'fake',role:'owner'})).status,403,'/transactions');assert.notEqual((await post(cashier,'/transactions',{workspace_id:'fake',role:'owner'})).status,403,'cashier may record a direct sale');
 const read=async who=>{const r=await fetch(base+'/api/bootstrap',{headers:{cookie:who.cookie}});return r.json();};
 const c=await read(cashier),k=await read(kitchen);for(const x of [c,k])for(const key of ['stock','availableStock','catalog','transactions','audit','community','group','staff','displays','recommendations'])assert.equal(key in x,false,key);
 assert.equal(c.menu[0].price,27000);assert.equal(k.menu.length,0);assert.equal(JSON.stringify(k).includes('Pemasok pribadi'),false);assert.equal(JSON.stringify(k).includes('Bahan rahasia'),false);
 const prefix=who=>who.data.account.id+':'+who.data.account.roleRevision+':';
 assert.equal((await post(kitchen,'/kitchen/orders',{})).status,403);
 const created=await post(cashier,'/kitchen/orders',{label:'Meja 1',channel:'dine_in',items:[{id:m.id,qty:1,note:'Tanpa gula'}],catalogRevision:3,idempotencyKey:prefix(cashier)+randomUUID()});assert.equal(created.status,201);const {id}=await created.json();
 let state=await read(kitchen),o=state.kitchen.orders.find(o=>o.id===id);assert.equal('total'in o,false);assert.equal('unitPrice'in o.items[0],false);assert.equal('usage'in o,false);assert.equal('usage_json'in o,false);assert.equal('idem'in o,false);
 const task=o.tasks[0];assert.equal((await post(cashier,`/kitchen/orders/${id}/actions`,{action:'start',taskId:task.id,revision:1,idempotencyKey:prefix(cashier)+randomUUID()})).status,403);
 assert.equal((await post(kitchen,`/kitchen/orders/${id}/actions`,{action:'start',taskId:task.id,revision:1,idempotencyKey:prefix(kitchen)+randomUUID()})).status,200);
 assert.equal((await post(kitchen,`/kitchen/orders/${id}/actions`,{action:'complete',revision:2,idempotencyKey:prefix(kitchen)+randomUUID()})).status,403);
 assert.equal((await post(kitchen,`/kitchen/orders/${id}/actions`,{action:'ready',taskId:task.id,revision:2,idempotencyKey:prefix(kitchen)+randomUUID()})).status,200);
 assert.equal((await post(cashier,`/kitchen/orders/${id}/actions`,{action:'complete',revision:3,idempotencyKey:prefix(cashier)+randomUUID()})).status,200);
 assert.equal(app.store.get('SELECT COUNT(*) AS n FROM sales').n,1);const ki=await read(kitchen);assert.equal(JSON.stringify(ki).includes('27000'),false);
 const sale={items:[{id:m.id,qty:2,note:'Pesanan selesai'}],catalogRevision:3,idempotencyKey:prefix(cashier)+randomUUID()};
 assert.equal((await post(cashier,'/transactions',{...sale,idempotencyKey:randomUUID()})).status,409);
 const one=await post(cashier,'/transactions',sale),two=await post(cashier,'/transactions',sale);assert.equal(one.status,201);assert.equal(two.status,201);assert.equal((await two.json()).duplicate,true);
 assert.equal(app.store.get('SELECT COUNT(*) AS n FROM sales').n,2);assert.equal(svc.bootstrap(s).stock[p.id],925);
 assert.ok((await read(cashier)).recentSales.includes(sale.idempotencyKey));assert.deepEqual((await read(kitchen)).recentSales,[]);
 assert.equal(app.store.get('SELECT actor_id FROM audit ORDER BY rowid DESC').actor_id,cashier.data.account.id);
 const cb2=staffBody();await post(owner,'/staff',cb2);const cashier2=await auth('login',cb2);assert.deepEqual((await read(cashier2)).recentSales,[]);
 assert.equal((await post(cashier2,'/transactions',sale)).status,409);

});
test('revocation during a partially uploaded POST is checked again before dispatch',async t=>{
 const app=createApp({filename:':memory:',extractor:{status:async()=>({provider:'rules'})},transcriber:{status:async()=>({available:false})}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;let slow;
 t.after(()=>{slow?.destroy();return app.close();});
 async function auth(path,b){const r=await fetch(base+'/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});assert.ok(r.ok);return {cookie:r.headers.get('set-cookie').split(';')[0],data:await r.json()};}
 const owner=await auth('register',registration()),b=staffBody();const created=await fetch(base+'/api/staff',{method:'POST',headers:{cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({...b,csrf:owner.data.csrf})});assert.equal(created.status,201);const {id}=await created.json(),cashier=await auth('login',b);
 const body=JSON.stringify({csrf:cashier.data.csrf,idempotencyKey:cashier.data.account.id+':1:'+randomUUID(),label:'Cannot dispatch',channel:'dine_in',items:[],catalogRevision:1});
 const accepted=new Promise(resolve=>app.server.once('request',resolve));
 const response=new Promise((resolve,reject)=>{slow=httpRequest(base+'/api/kitchen/orders',{method:'POST',headers:{cookie:cashier.cookie,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});slow.on('error',reject);});
 slow.write(body.slice(0,12));await accepted;
 const revoked=await fetch(base+'/api/staff/'+id,{method:'POST',headers:{cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({csrf:owner.data.csrf,action:'disable',revision:1,confirmed:true,idempotencyKey:randomUUID()})});assert.equal(revoked.status,200);
 slow.end(body.slice(12));assert.equal(await response,401);assert.equal(app.store.get('SELECT COUNT(*) AS n FROM kitchen_orders').n,0);
});
