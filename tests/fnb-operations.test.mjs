import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from '../server/store.mjs';
import {createService} from '../server/service.mjs';
import {createIdentity} from '../server/identity.mjs';
import {staffBootstrap,staffPrefix} from '../server/roles.mjs';
const credentials=()=>({email:randomUUID()+'@example.test',password:'TestingFnB2026!',businessName:'Usaha pengujian',communityName:'Kelompok uji'});
function fixture(t){const store=createStore(':memory:');t.after(()=>store.close());const identity=createIdentity(store),service=createService(store),owner=identity.register(credentials());return {store,identity,service,owner};}
function staff(f,role){const body={...credentials(),name:'Staf '+role,role,confirmed:true,idempotencyKey:randomUUID()};f.identity.createStaff(f.owner,body);return f.identity.login(body);}
function menu(f){const p=f.service.saveIngredient(f.owner,null,{name:'Bahan uji',unit:'kg',min:3,storageNote:'',catalogRevision:1});f.service.receive(f.owner,{productId:p.id,qty:10,unitPrice:1000,supplier:'Uji',idempotencyKey:randomUUID()});const m=f.service.saveMenu(f.owner,null,{name:'Menu uji',price:10000,aliases:[],recipe:{[p.id]:1},catalogRevision:2,preparation:{minutes:5,passiveMinutes:2,station:'kompor'}});return {p:p.id,m:m.id};}
function order(f,s,m,qty){return f.service.kitchen.create(s,{label:'Meja uji',channel:'dine_in',items:[{id:m,qty}],catalogRevision:3,idempotencyKey:staffPrefix(s)+randomUUID()});}
test('availability uses owner minimum and available reservations, with out taking precedence',t=>{
 const f=fixture(t),{m}=menu(f),read=()=>f.service.kitchen.snapshot(f.owner).menus[0];
 assert.equal(read().status,'ok');const first=order(f,f.owner,m,7);assert.equal(read().portions,3);assert.equal(read().status,'low');
 order(f,f.owner,m,3);assert.equal(read().status,'out');f.service.kitchen.change(f.owner,first.id,{action:'cancel',revision:1,idempotencyKey:randomUUID()});assert.equal(read().status,'ok');
});
test('cashier receives only status metadata; kitchen receives no menu inventory data',t=>{
 const f=fixture(t),{m}=menu(f),cashier=staff(f,'cashier'),kitchen=staff(f,'kitchen');order(f,f.owner,m,8);
 const c=staffBootstrap(f.store,f.service,cashier,f.identity.details(cashier)),k=staffBootstrap(f.store,f.service,kitchen,f.identity.details(kitchen));
 assert.deepEqual(Object.keys(c.kitchen.menus[0]).sort(),['configured','id','name','status']);assert.equal(c.kitchen.menus[0].status,'low');assert.equal(JSON.stringify(c).includes('portions'),false);assert.deepEqual(c.lowStock,['Bahan uji']);assert.equal(JSON.stringify(c).includes('min_quantity'),false);assert.deepEqual(k.kitchen.menus,[]);assert.deepEqual(k.lowStock,[]);assert.equal(JSON.stringify(k).includes('Bahan uji'),false);
});
test('new audit and kitchen actions retain trusted actor snapshots, ignore supplied actor and deduplicate',t=>{
 const f=fixture(t),{m}=menu(f),cashier=staff(f,'cashier'),kitchen=staff(f,'kitchen'),o=order(f,cashier,m,1),task=f.service.kitchen.snapshot(kitchen).orders[0].tasks[0];
 let row=f.store.get('SELECT * FROM audit ORDER BY rowid DESC LIMIT 1');assert.equal(row.actor_id,cashier.account_id);assert.equal(row.actor_role,'cashier');
 const b={action:'start',taskId:task.id,revision:1,idempotencyKey:staffPrefix(kitchen)+randomUUID(),actor_id:cashier.account_id,actor_name:'Forged',actor_role:'owner'};
 f.service.kitchen.change(kitchen,o.id,b);const count=f.store.get('SELECT COUNT(*) AS n FROM audit').n;assert.equal(f.service.kitchen.change(kitchen,o.id,b).duplicate,true);assert.equal(f.store.get('SELECT COUNT(*) AS n FROM audit').n,count);
 row=f.store.get('SELECT * FROM kitchen_actions WHERE idem=?',b.idempotencyKey);assert.equal(row.actor_id,kitchen.account_id);assert.equal(row.actor_name,'Staf kitchen');assert.equal(row.actor_role,'kitchen');assert.equal(row.actor_revision,1);
 f.identity.updateStaff(f.owner,kitchen.account_id,{action:'role',role:'cashier',revision:1,confirmed:true,idempotencyKey:randomUUID()});assert.equal(f.store.get('SELECT actor_role FROM kitchen_actions WHERE idem=?',b.idempotencyKey).actor_role,'kitchen');
 const audit=f.service.bootstrap(f.owner).audit.find(x=>x.actor?.id===kitchen.account_id);assert.equal(audit.actor.role,'kitchen');
});
test('actor contexts isolate asynchronous operations and never label another business with a foreign account',async t=>{
 const f=fixture(t),cashier=staff(f,'cashier');
 await Promise.all([f.store.withActor(f.owner,async()=>{await new Promise(r=>setTimeout(r,10));f.store.log(f.owner.workspace_id,f.owner.business_id,'Owner async');}),f.store.withActor(cashier,async()=>{await Promise.resolve();f.store.log(cashier.workspace_id,cashier.business_id,'Cashier async');})]);
 assert.equal(f.store.get("SELECT actor_role FROM audit WHERE message='Owner async'").actor_role,'owner');assert.equal(f.store.get("SELECT actor_role FROM audit WHERE message='Cashier async'").actor_role,'cashier');
 const other=f.identity.register(credentials());f.store.withActor({...cashier,workspace_id:other.workspace_id,business_id:other.business_id},()=>f.store.log(other.workspace_id,other.business_id,'Foreign identity'));
 assert.equal(f.store.get("SELECT actor_id FROM audit WHERE message='Foreign identity'").actor_id,null);
});
test('additive actor migration preserves old audit/action fields and leaves unknown history null',t=>{
 const dir=mkdtempSync(join(tmpdir(),'gerai-fnb-migration-')),filename=join(dir,'old.sqlite');let store=createStore(filename);t.after(()=>{store.close();assert.ok(dir.startsWith(join(tmpdir(),'gerai-fnb-migration-')));rmSync(dir,{recursive:true,force:true});});
 const identity=createIdentity(store),s=identity.register(credentials());store.log(s.workspace_id,s.business_id,'Historical unknown');store.run('INSERT INTO kitchen_actions(workspace_id,business_id,idem,fingerprint,result) VALUES(?,?,?,?,?)',s.workspace_id,s.business_id,'historical-action','historical-hash','{}');
 for(const table of ['audit','kitchen_actions'])for(const col of ['actor_id','actor_name','actor_role','actor_revision'])store.db.exec(`ALTER TABLE ${table} DROP COLUMN ${col}`);
 const before=store.all('SELECT * FROM audit'),actions=store.all('SELECT * FROM kitchen_actions');store.close();store=createStore(filename);
 assert.deepEqual(store.all('SELECT id,workspace_id,business_id,message,created_at FROM audit'),before);assert.deepEqual(store.all('SELECT workspace_id,business_id,idem,fingerprint,result FROM kitchen_actions'),actions);assert.equal(store.get('SELECT COUNT(*) AS n FROM audit WHERE actor_id IS NOT NULL').n,0);assert.equal(store.get('SELECT actor_id FROM kitchen_actions').actor_id,null);
});
