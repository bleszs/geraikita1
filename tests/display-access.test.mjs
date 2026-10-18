import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createStore} from './fixtures/store.mjs';
import {createStore as emptyStore} from '../server/store.mjs';
import {createDisplayAccess} from '../server/display-access.mjs';
import {createService} from '../server/service.mjs';
const body=changes=>({label:'Layar pengujian',durationHours:8,token:randomBytes(32).toString('hex'),idempotencyKey:randomUUID(),confirmed:true,...changes});
function fixture(t){const store=createStore(':memory:');t.after(()=>store.close());const s=store.session();return {store,s,access:createDisplayAccess(store)};}
test('display access stores only token hash, returns metadata without secret, and scopes owner operations',t=>{
 const {store,s,access}=fixture(t),b=body(),r=access.create(s,b),other=store.session('budi',s.workspace_id);
 assert.equal(r.status,'active');assert.equal(access.create(s,b).duplicate,true);
 assert.throws(()=>access.create(s,{...b,label:'Berbeda'}),/Kunci/);
 const row=store.get('SELECT * FROM display_access WHERE id=?',r.id);assert.equal(row.token_hash,createHash('sha256').update(b.token).digest('hex'));assert.equal(JSON.stringify(row).includes(b.token),false);
 assert.equal(JSON.stringify(access.list(s)).includes(row.token_hash),false);assert.equal(JSON.stringify(access.list(s)).includes(b.token),false);assert.equal(access.list(other).length,0);
 assert.throws(()=>access.revoke(other,r.id),/tidak ditemukan/);assert.equal(access.resolve('Bearer '+b.token).business_id,s.business_id);
 assert.equal(access.revoke(s,r.id).revoked,true);assert.equal(access.revoke(s,r.id).duplicate,true);assert.throws(()=>access.resolve('Bearer '+b.token),/berakhir/);
});
test('expiry, invalid tokens, active limits and same token cannot bypass access',t=>{
 const {store,s,access}=fixture(t);
 for(const b of [body({confirmed:false}),body({durationHours:0}),body({durationHours:169}),body({label:'x'}),body({token:'bad'})])assert.throws(()=>access.create(s,b));
 assert.throws(()=>access.resolve(),/tautan/);assert.throws(()=>access.resolve('Bearer '+randomBytes(32).toString('hex')),/berakhir/);
 const first=body(),r=access.create(s,first);assert.throws(()=>access.create(s,{...first,idempotencyKey:randomUUID()}),/sudah digunakan/);
 store.run('UPDATE display_access SET expires_at=? WHERE id=?',Date.now()-1,r.id);assert.equal(access.list(s)[0].status,'expired');assert.throws(()=>access.resolve('Bearer '+first.token),/berakhir/);
 for(let i=0;i<10;i++)access.create(s,body());assert.throws(()=>access.create(s,body()),/Maksimal/);
});
test('public projection contains only order code/status, hides labels, menu/stock/price, and changes with real order state',t=>{
 const {store,s,access}=fixture(t),service=createService(store),state=service.bootstrap(s),m=state.menu[0];
 service.saveMenu(s,m.id,{...m,catalogRevision:state.catalogRevision,preparation:{minutes:5,passiveMinutes:1,station:'dapur'}});
 const o=service.kitchen.create(s,{label:'Nama pelanggan pribadi',channel:'dine_in',items:[{id:m.id,qty:1,note:'Catatan pribadi'}],catalogRevision:service.bootstrap(s).catalogRevision,idempotencyKey:randomUUID()});
 const first=access.snapshot(s);const fo=first.orders[0];assert.equal(fo.code,o.id.slice(0,8).toUpperCase());assert.equal(fo.status,'queued');assert.ok(fo.etaMinutes===null||typeof fo.etaMinutes==='number','orders include etaMinutes');assert.equal(first.orders.length,1);assert.deepEqual(Object.keys(first).sort(),['hasMore','orders','updatedAt']);
 assert.equal(JSON.stringify(first).includes('pribadi'),false);assert.equal(JSON.stringify(first).includes(m.name),false);assert.deepEqual(access.snapshot(store.session('budi',s.workspace_id)).orders,[]);
 const task=service.kitchen.snapshot(s).orders[0].tasks[0];service.kitchen.change(s,o.id,{action:'start',taskId:task.id,revision:1,idempotencyKey:randomUUID()});assert.equal(access.snapshot(s).orders[0].status,'preparing');
 service.kitchen.change(s,o.id,{action:'ready',taskId:task.id,revision:2,idempotencyKey:randomUUID()});assert.equal(access.snapshot(s).orders[0].status,'ready');
 service.kitchen.change(s,o.id,{action:'complete',revision:3,idempotencyKey:randomUUID()});assert.deepEqual(access.snapshot(s).orders,[]);
});
test('migration adds one empty table without modifying previous data and persists through reopening',t=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'gerai-display-')),filename=path.join(dir,'store.sqlite');let store=emptyStore(filename);
 t.after(()=>{store?.close();rmSync(dir,{recursive:true,force:true});});
 store.db.exec('DROP TABLE display_access');const snap=()=>store.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map(({name})=>[name,store.all(`SELECT * FROM ${name}`)]),before=snap();assert.equal(before.length,36);store.close();store=emptyStore(filename);
 assert.deepEqual(snap().filter(([name])=>name!=='display_access'),before);assert.equal(store.get('SELECT COUNT(*) AS n FROM display_access').n,0);
 store.close();store=emptyStore(filename);assert.equal(store.get('PRAGMA quick_check').quick_check,'ok');assert.deepEqual(store.all('PRAGMA foreign_key_check'),[]);
});
