import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStore} from '../server/store.mjs';
import {createIdentity} from '../server/identity.mjs';
import {createService} from '../server/service.mjs';
import {csvText,salesRows} from '../public/csv.js';

function setup(t){const store=createStore(':memory:');t.after(()=>store.close());const identity=createIdentity(store),service=createService(store);const reg=(extra={})=>identity.register({businessName:'Usaha pengujian',email:randomUUID()+'@example.test',password:'Community-test-password',...extra});return {store,identity,service,reg};}
test('signup needs no group and owners create an invitation later',t=>{
  const {identity,service,reg}=setup(t),s=reg();assert.equal(service.bootstrap(s).community.enabled,false);assert.match(service.bootstrap(s).audit[0].message,/Akun usaha mandiri/);assert.equal(service.bootstrap(s).community.inviteCode,null);
  assert.throws(()=>identity.createCommunity(s,{communityName:'x'}));
  identity.createCommunity(s,{communityName:'Kelompok pemilik'});const group=service.bootstrap(s).community;assert.equal(group.enabled,true);assert.match(group.inviteCode,/^[A-F0-9]{10}$/);assert.equal(identity.createCommunity(s,{communityName:'Kelompok pemilik'}).duplicate,true);
});
test('joining preserves business, inventory, menu, staff, sale, usage and quota while resetting consent',t=>{
  const {store,identity,service,reg}=setup(t),host=reg({communityName:'Kelompok tujuan'}),member=reg({communityName:'Kelompok lama sendiri'}),old=member.workspace_id,business=member.business_id,oldCode=service.bootstrap(member).community.inviteCode;
  const p=service.saveIngredient(member,null,{name:'Bahan sendiri',unit:'gram',min:0,storageNote:'',catalogRevision:1});
  service.saveMenu(member,null,{name:'Menu sendiri',price:5000,aliases:[],recipe:{[p.id]:20},catalogRevision:2});
  service.receive(member,{productId:p.id,qty:100,unitPrice:100,supplier:'',idempotencyKey:randomUUID(),catalogRevision:3});
  service.transaction(member,{items:[{id:store.menus(member)[0].id,qty:1,note:''}],idempotencyKey:randomUUID(),catalogRevision:3});
  identity.createStaff(member,{name:'Kasir sendiri',email:randomUUID()+'@example.test',password:'Staff-community-password',role:'cashier',confirmed:true,idempotencyKey:randomUUID()});
  const before=service.bootstrap(member),staff=identity.staff(member),code=service.bootstrap(host).community.inviteCode;
  assert.throws(()=>identity.joinCommunity(member,{inviteCode:code,expectedWorkspace:old,confirmed:false}));
  identity.joinCommunity(member,{inviteCode:code.toLowerCase(),expectedWorkspace:old,confirmed:true});
  const current=identity.resolve(member.id),after=service.bootstrap(current);
  assert.equal(current.workspace_id,host.workspace_id);assert.equal(current.business_id,business);assert.deepEqual(after.stock,before.stock);assert.deepEqual(after.menu,before.menu);assert.equal(after.transactions[0].id,before.transactions[0].id);assert.equal(after.transactions[0].total,before.transactions[0].total);assert.equal(identity.staff(current)[0].id,staff[0].id);assert.equal(identity.staff(current)[0].revision,staff[0].revision+1);assert.equal(after.shared,false);assert.equal(after.community.canManage,false);assert.equal(after.community.inviteCode,null);
  assert.equal(store.get('SELECT COUNT(*) AS n FROM daily_usage WHERE workspace_id=? AND business_id=?',host.workspace_id,business).n,1);assert.deepEqual(store.all('PRAGMA foreign_key_check'),[]);
  assert.equal(identity.joinCommunity(current,{inviteCode:code,expectedWorkspace:old,confirmed:true}).duplicate,true);
  assert.throws(()=>reg({inviteCode:oldCode}),/tidak ditemukan/);
  assert.throws(()=>identity.joinCommunity(host,{inviteCode:code+'FF',expectedWorkspace:host.workspace_id,confirmed:true}));
});
test('join fails atomically on conflicting ingredient units and protects a manager with members',t=>{
  const {store,identity,service,reg}=setup(t),host=reg({communityName:'Kelompok aktif'}),member=reg();
  service.saveQuote(host,{productName:'Tepung',unit:'gram',supplier:'Pemasok',unitPrice:100,shipping:0,minimum:1,expiresAt:new Date(Date.now()+3600000).toISOString()});
  service.saveIngredient(member,null,{name:'Tepung',unit:'kg',min:0,storageNote:'',catalogRevision:1});
  const before=service.bootstrap(member),code=service.bootstrap(host).community.inviteCode;
  assert.throws(()=>identity.joinCommunity(member,{inviteCode:code,expectedWorkspace:member.workspace_id,confirmed:true}),/Satuan/);
  assert.equal(identity.resolve(member.id).workspace_id,member.workspace_id);assert.deepEqual(service.bootstrap(member).catalog,before.catalog);assert.deepEqual(store.all('PRAGMA foreign_key_check'),[]);
  const third=reg({inviteCode:code});assert.throws(()=>identity.joinCommunity(host,{inviteCode:service.bootstrap(reg({communityName:'Tujuan lain'})).community.inviteCode,expectedWorkspace:host.workspace_id,confirmed:true}),/mengelola/);assert.equal(identity.resolve(third.id).workspace_id,host.workspace_id);
});
test('same-name same-unit material joins without losing stock, recipe, usage or sale reversibility',t=>{
  const {store,identity,service,reg}=setup(t),host=reg({communityName:'Kelompok bahan sama'}),member=reg();
  service.saveQuote(host,{productName:'Tepung',unit:'gram',supplier:'Pemasok',unitPrice:100,shipping:0,minimum:1,expiresAt:new Date(Date.now()+3600000).toISOString()});
  const p=service.saveIngredient(member,null,{name:'Tepung',unit:'gram',min:10,storageNote:'Catatan asal',catalogRevision:1});
  const menu=service.saveMenu(member,null,{name:'Roti',price:5000,aliases:[],recipe:{[p.id]:20},catalogRevision:2});
  service.receive(member,{productId:p.id,qty:100,unitPrice:100,supplier:'Pemasok sendiri',idempotencyKey:randomUUID(),catalogRevision:3});
  const sale=service.transaction(member,{items:[{id:menu.id,qty:1,note:''}],idempotencyKey:randomUUID(),catalogRevision:3});
  const target=service.bootstrap(host).sharedProduct;
  identity.joinCommunity(member,{inviteCode:service.bootstrap(host).community.inviteCode,expectedWorkspace:member.workspace_id,confirmed:true});
  const current=identity.resolve(member.id),data=service.bootstrap(current);
  assert.equal(data.catalog.length,1);assert.equal(data.catalog[0].id,target.id);assert.equal(data.stock[target.id],80);assert.equal(data.menu[0].recipe[target.id],20);assert.equal(data.stockReceipts[0].product_id,target.id);
  assert.equal(store.get('SELECT quantity FROM daily_usage WHERE workspace_id=? AND business_id=? AND product_id=?',current.workspace_id,current.business_id,target.id).quantity,200000);
  service.cancelSale(current,sale.id);assert.equal(service.bootstrap(current).stock[target.id],100);assert.deepEqual(store.all('PRAGMA foreign_key_check'),[]);
});
test('Excel CSV declares delimiter, preserves Indonesian text and escapes formulas and separators',()=>{
  const text=csvText([['Nama','Jumlah'],['Kopi; susu "hangat"',1.5],['=1+2',-10],['Énak\nsekali',0]]);
  assert.ok(text.startsWith('\uFEFFsep=;\r\n'));assert.ok(text.includes('"Kopi; susu ""hangat""";1,5'));assert.ok(text.includes('"\'=1+2";-10'));assert.ok(text.includes('Énak\nsekali'));
  const rows=salesRows([{id:'sale',date:'2026-10-18',time:'09.00',items:[{qty:2,name:'Kopi'}],total:20000,payment_method:'qris',fee:2000,net:18000}]);assert.equal(rows[1][3],'QRIS');assert.equal(rows[1][6],18000);assert.equal(rows[0].at(-1),'ID transaksi');
});
