import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createStore} from '../server/store.mjs';
import {createIdentity} from '../server/identity.mjs';
import {createApp} from '../server/http.mjs';
import {migrateAccountCredentials,STAFF_CODE_TTL} from '../server/staff-invites.mjs';
const credentials=()=>({email:randomUUID()+'@example.test',password:'PairingTesting2026!',businessName:'Usaha kode',communityName:'Kelompok kode'});
const body=(code='ABCD2345')=>({name:'Kasir pengujian kode',role:'cashier',code,confirmed:true,idempotencyKey:randomUUID()});
function fixture(t){const store=createStore(':memory:');t.after(()=>store.close());const identity=createIdentity(store),owner=identity.register(credentials());return {store,identity,owner};}
test('code-only staff has no invented credentials; invite retry creates only one account and returns metadata',t=>{
 const {store,identity,owner}=fixture(t),b=body(),now=Date.now(),invite=identity.createStaffInvite(owner,b);
 assert.equal(invite.status,'active');assert.ok(Date.parse(invite.expiresAt)>=now+STAFF_CODE_TTL-100);assert.ok(Date.parse(invite.expiresAt)<=Date.now()+STAFF_CODE_TTL);
 assert.equal(identity.createStaffInvite(owner,b).duplicate,true);assert.equal(store.get('SELECT COUNT(*) AS n FROM accounts').n,2);
 const a=store.get('SELECT * FROM accounts WHERE id=?',invite.accountId);for(const key of ['email','password_hash','salt'])assert.equal(a[key],null);
 const raw=store.get('SELECT * FROM staff_invites');assert.notEqual(raw.code_hash,b.code);assert.match(raw.code_hash,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(identity.staffInvites(owner)).includes(b.code),false);assert.equal(JSON.stringify(identity.staffInvites(owner)).includes(raw.code_hash),false);assert.equal(JSON.stringify(store.all('SELECT * FROM audit')).includes(b.code),false);
 assert.throws(()=>identity.createStaffInvite(owner,{...b,name:'Changed identity'}),/Kunci/);
 const s=identity.loginStaffCode({code:'abcd-2345',role:'owner',workspace_id:'fake'});assert.equal(s.role,'cashier');assert.equal(s.business_id,owner.business_id);assert.equal(identity.details(s).hasPassword,false);assert.equal(identity.details(s).email,null);assert.throws(()=>identity.changePassword(s,{currentPassword:'Anything2026!',newPassword:'NewAnything2026!'}),/kode/);assert.throws(()=>identity.loginStaffCode({code:b.code}),/Kode/);assert.equal(identity.staffInvites(owner)[0].status,'used');
});
test('existing password staff pairs to the same account, replaces pending code and retains active sessions',t=>{
 const {store,identity,owner}=fixture(t),b={...credentials(),name:'Koki lama',role:'kitchen',confirmed:true,idempotencyKey:randomUUID()},a=identity.createStaff(owner,b),old=identity.login(b);
 const first=identity.createStaffInvite(owner,{...body(),accountId:a.id,revision:1}),second=identity.createStaffInvite(owner,{...body('WXYZ6789'),accountId:a.id,revision:1});
 assert.equal(identity.resolve(old.id).account_id,a.id);assert.throws(()=>identity.loginStaffCode({code:'ABCD2345'}),/Kode/);const paired=identity.loginStaffCode({code:'WXYZ6789'});assert.equal(paired.account_id,a.id);assert.equal(paired.role,'kitchen');assert.equal(identity.details(paired).hasPassword,true);assert.equal(identity.login(b).account_id,a.id);assert.equal(store.get('SELECT COUNT(*) AS n FROM accounts').n,2);assert.equal(identity.staffInvites(owner).find(i=>i.id===first.id).status,'revoked');assert.equal(identity.staffInvites(owner).find(i=>i.id===second.id).status,'used');
});
test('expired, revoked, disabled and role-changed codes never issue or revive sessions',t=>{
 const {store,identity,owner}=fixture(t),i=identity.createStaffInvite(owner,body());store.run('UPDATE staff_invites SET expires_at=? WHERE id=?',Date.now()-1,i.id);assert.throws(()=>identity.loginStaffCode({code:'ABCD2345'}),/Kode/);
 const b={...body('WXYZ6789'),accountId:i.accountId,revision:1},next=identity.createStaffInvite(owner,b);identity.revokeStaffInvite(owner,next.id,{confirmed:true});const count=store.get('SELECT COUNT(*) AS n FROM audit').n;identity.revokeStaffInvite(owner,next.id,{confirmed:true});assert.equal(store.get('SELECT COUNT(*) AS n FROM audit').n,count);assert.throws(()=>identity.loginStaffCode({code:b.code}),/Kode/);
 identity.createStaffInvite(owner,{...body('EFGH2345'),accountId:i.accountId,revision:1});identity.updateStaff(owner,i.accountId,{action:'disable',revision:1,confirmed:true,idempotencyKey:randomUUID()});identity.updateStaff(owner,i.accountId,{action:'enable',revision:2,confirmed:true,idempotencyKey:randomUUID()});assert.throws(()=>identity.loginStaffCode({code:'EFGH2345'}),/Kode/);
 identity.createStaffInvite(owner,{...body('JKLM2345'),accountId:i.accountId,revision:3});identity.updateStaff(owner,i.accountId,{action:'role',role:'kitchen',revision:3,confirmed:true,idempotencyKey:randomUUID()});assert.throws(()=>identity.loginStaffCode({code:'JKLM2345'}),/Kode/);
});
test('owners cannot pair another business, an owner account or grant owner role; staff cannot manage invites',t=>{
 const {identity,owner}=fixture(t),other=identity.register(credentials()),a=identity.createStaffInvite(owner,body()),s=identity.loginStaffCode({code:'ABCD2345'});
 assert.throws(()=>identity.createStaffInvite(other,{...body('WXYZ6789'),accountId:a.accountId,revision:1}),/tidak ditemukan/);assert.throws(()=>identity.createStaffInvite(owner,{...body('WXYZ6789'),accountId:owner.account_id,revision:1}),/tidak ditemukan/);assert.throws(()=>identity.createStaffInvite(owner,{...body('WXYZ6789'),role:'owner'}),/peran/);assert.throws(()=>identity.createStaffInvite(s,body('WXYZ6789')),/pemilik/);assert.throws(()=>identity.staffInvites(s),/pemilik/);assert.throws(()=>identity.revokeStaffInvite(other,a.id,{confirmed:true}),/tidak ditemukan/);
});
test('password change invalidates pending invitations without dropping the current password session',t=>{
 const {identity,owner}=fixture(t),b={...credentials(),name:'Kasir sandi',role:'cashier',confirmed:true,idempotencyKey:randomUUID()},a=identity.createStaff(owner,b),s=identity.login(b);identity.createStaffInvite(owner,{...body(),accountId:a.id,revision:1});identity.changePassword(s,{currentPassword:b.password,newPassword:'ChangedStaff2026!'});assert.ok(identity.resolve(s.id));assert.throws(()=>identity.loginStaffCode({code:'ABCD2345'}),/Kode/);
});
test('nullable credential migration preserves every old row, password, session, index and trigger',t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'gerai-pairing-migration-')),file=path.join(directory,'test.sqlite');let store=createStore(file);t.after(()=>{store.close();assert.equal(path.dirname(path.resolve(directory)),path.resolve(tmpdir()));assert.ok(path.basename(directory).startsWith('gerai-pairing-migration-'));rmSync(directory,{recursive:true,force:true});});
 let identity=createIdentity(store);const b=credentials(),s=identity.register(b);
 store.db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE; CREATE TABLE accounts_oldshape(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,salt TEXT NOT NULL,workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE); INSERT INTO accounts_oldshape SELECT * FROM accounts; DROP TABLE accounts; ALTER TABLE accounts_oldshape RENAME TO accounts; CREATE INDEX pairing_test_index ON accounts(workspace_id,business_id); CREATE TRIGGER pairing_test_trigger AFTER UPDATE OF email ON accounts BEGIN SELECT 1; END; COMMIT; PRAGMA foreign_keys=ON');
 const names=store.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(r=>r.name),snapshot=()=>names.map(name=>[name,store.all(`SELECT * FROM ${name}`).map(row=>JSON.stringify(row)).sort()]),before=snapshot();store.close();store=createStore(file);identity=createIdentity(store);
 assert.deepEqual(snapshot(),before);assert.equal(identity.resolve(s.id).role,'owner');assert.equal(identity.login(b).account_id,s.account_id);assert.ok(store.get("SELECT name FROM sqlite_master WHERE name='pairing_test_index'"));assert.ok(store.get("SELECT name FROM sqlite_master WHERE name='pairing_test_trigger'"));assert.deepEqual(store.all('PRAGMA foreign_key_check'),[]);assert.equal(store.get('PRAGMA foreign_keys').foreign_keys,1);assert.equal(store.all('PRAGMA table_info(accounts)').find(c=>c.name==='email').notnull,0);
});
test('unrecognized account schema aborts migration before changing values or foreign-key enforcement',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec('PRAGMA foreign_keys=ON; CREATE TABLE accounts(id TEXT,email TEXT NOT NULL,custom TEXT); INSERT INTO accounts VALUES(\'old\',\'old@example.test\',\'keep\')');const before=db.prepare('SELECT * FROM accounts').all();assert.throws(()=>migrateAccountCredentials(db),/belum dikenali/);assert.deepEqual(db.prepare('SELECT * FROM accounts').all(),before);assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);}finally{db.close();}
});
async function appFixture(t){const app=createApp({filename:':memory:',extractor:{status:async()=>({available:false})},transcriber:{status:async()=>({available:false})}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;const post=async(path,body,headers={})=>fetch(base+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});const response=await post('/auth/register',credentials()),owner=await response.json(),cookie=response.headers.get('set-cookie').split(';')[0];return {app,post,owner,cookie};}
test('HTTP pairing enforces owner/CSRF/origin, consumes once under concurrent attempts and keeps projection restricted',async t=>{
 const f=await appFixture(t),b=body();assert.equal((await f.post('/staff-invites',b,{cookie:f.cookie})).status,403);assert.equal((await f.post('/staff-invites',{...b,csrf:f.owner.csrf},{cookie:f.cookie,origin:'https://foreign.invalid'})).status,403);
 const created=await f.post('/staff-invites',{...b,csrf:f.owner.csrf},{cookie:f.cookie});assert.equal(created.status,201);const meta=await created.json();assert.equal(JSON.stringify(meta).includes(b.code),false);
 const responses=await Promise.all([f.post('/auth/staff-code',{code:b.code}),f.post('/auth/staff-code',{code:b.code})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,401]);const ok=responses.find(r=>r.status===200),state=await ok.json(),cookie=ok.headers.get('set-cookie').split(';')[0];assert.equal(state.account.role,'cashier');assert.equal(state.account.hasPassword,false);assert.equal(state.account.email,null);for(const key of ['staff','staffInvites','audit','stock','catalog'])assert.equal(key in state,false);assert.equal((await f.post('/staff-invites',{...body('WXYZ6789'),csrf:state.csrf},{cookie})).status,403);assert.equal((await f.post('/auth/staff-code',{code:b.code},{cookie:f.cookie})).status,409);
});
test('staff-code attempts are bounded per source across changing guesses and valid codes do not bypass lockout',async t=>{
 const f=await appFixture(t);await f.post('/staff-invites',{...body(),csrf:f.owner.csrf},{cookie:f.cookie});
 for(let i=0;i<8;i++)assert.equal((await f.post('/auth/staff-code',{code:'WXYZ678'+String(i)})).status,401);
 assert.equal((await f.post('/auth/staff-code',{code:'ABCD2345'})).status,429);
 assert.equal(f.app.store.get('SELECT used_at FROM staff_invites').used_at,null);
});

test('persistent staff code survives repeated logins and is revoked only when owner deletes the staff profile',t=>{
 const {store,identity,owner}=fixture(t),code='QRST2345',created=identity.createStaffAccess(owner,{name:'Kasir tetap',role:'cashier',phone:'0812345',notes:'Shift pagi',code,confirmed:true,idempotencyKey:randomUUID()});
 assert.equal(created.hasAccessCode,true);assert.equal(identity.staff(owner).find(x=>x.id===created.id).phone,'0812345');
 const first=identity.loginStaffCode({code}),second=identity.loginStaffCode({code:'qrst-2345'});assert.equal(first.account_id,created.id);assert.equal(second.account_id,created.id);
 assert.equal(JSON.stringify(store.all('SELECT * FROM staff_access_codes')).includes(code),false);
 identity.deleteStaff(owner,created.id,{confirmed:true});assert.equal(identity.resolve(first.id),undefined);assert.equal(identity.resolve(second.id),undefined);assert.throws(()=>identity.loginStaffCode({code}),/Kode/);assert.equal(identity.staff(owner).some(x=>x.id===created.id),false);
});
