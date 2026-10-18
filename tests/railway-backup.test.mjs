import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createStore} from '../server/store.mjs';
import {createIdentity} from '../server/identity.mjs';
import {backupDatabase} from '../scripts/maintenance.mjs';
import {saveVerifiedBackup} from '../scripts/railway-backup.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(t){
  const directory=mkdtempSync(path.join(os.tmpdir(),'gerai-railway-backup-test-'));
  t.after(()=>{
    const resolved=path.resolve(directory);
    assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));
    assert(path.basename(resolved).startsWith('gerai-railway-backup-test-'));
    rmSync(resolved,{recursive:true,force:true});
  });
  return directory;
}
const envelope=bytes=>({kind:'gerai-kita-sqlite-backup',bytes:bytes.length,base64:bytes.toString('base64'),sha256:sha(bytes)});

test('download verification restores actual WAL-backed account data through store migrations without changing rows',t=>{
  const directory=fixture(t),source=path.join(directory,'source.sqlite'),store=createStore(source);
  try{
    createIdentity(store).register({email:'restore-check@example.test',password:'Restore-check-password-2026',businessName:'Usaha uji restore',communityName:'Kelompok sementara'});
    const snapshot=backupDatabase(source,path.join(directory,'export'));
    const output=saveVerifiedBackup(envelope(readFileSync(snapshot.filename)),path.join(directory,'download'));
    assert.equal(output.integrity,'ok');assert.equal(output.foreignKeys,'ok');
    assert.deepEqual(output.restore,{applicationStoreOpened:true,tablesCompared:38,allRowsEqual:true});
    assert.equal(output.productionRestorePerformed,false);
    const restored=new DatabaseSync(output.filename,{readOnly:true});
    try{assert.equal(restored.prepare('SELECT COUNT(*) n FROM accounts').get().n,1);assert.equal(restored.prepare('SELECT name FROM businesses').get().name,'Usaha uji restore');}finally{restored.close();}
    assert.equal(sha(readFileSync(output.filename)),output.sha256);
    assert.equal(JSON.parse(readFileSync(output.filename+'.json','utf8')).restore.allRowsEqual,true);
  }finally{store.close();}
});

test('tampered bytes and a noncanonical transport are rejected before publishing any backup',t=>{
  const directory=fixture(t),bytes=Buffer.from('untrusted transport'),payload=envelope(bytes);
  assert.throws(()=>saveVerifiedBackup({...payload,sha256:'0'.repeat(64)},directory),/checksum mismatch/);
  assert.throws(()=>saveVerifiedBackup({...payload,base64:'!'.repeat(payload.base64.length)},directory),/checksum mismatch/);
  assert.throws(()=>saveVerifiedBackup({...payload,bytes:65*1024*1024},directory),/Invalid backup envelope/);
  assert.deepEqual(readdirSync(directory),[]);
});

test('older snapshot remains verifiable after additive plan tables and station defaults are migrated',t=>{
  const directory=fixture(t),filename=path.join(directory,'legacy.sqlite'),store=createStore(filename);
  try{
    createIdentity(store).register({email:'legacy-plan@example.test',password:'Legacy-restore-password-2026',businessName:'Usaha lama',communityName:'Kelompok lama'});
    store.db.exec("DROP TABLE usage_zero_confirmations; DROP TABLE ai_usage_events; DROP TABLE plan_interests; ALTER TABLE kitchen_stations DROP COLUMN aging_minutes");
    const snapshot=backupDatabase(filename,path.join(directory,'export-legacy')),bytes=readFileSync(snapshot.filename);
    const output=saveVerifiedBackup(envelope(bytes),path.join(directory,'download-legacy'));
    assert.equal(output.restore.tablesCompared,35);assert.equal(output.restore.allRowsEqual,true);assert.equal(output.sha256,sha(bytes));
    const raw=new DatabaseSync(output.filename,{readOnly:true});try{assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='ai_usage_events'").get().n,0);}finally{raw.close();}
  }finally{store.close();}
});

test('a checksum-valid non-SQLite payload is never finalized and an existing backup remains untouched',t=>{
  const directory=fixture(t),source=path.join(directory,'source.sqlite'),store=createStore(source);store.close();
  const snapshot=backupDatabase(source,path.join(directory,'export')),destination=path.join(directory,'download');
  const first=saveVerifiedBackup(envelope(readFileSync(snapshot.filename)),destination);
  const before=readdirSync(destination).sort();
  assert.throws(()=>saveVerifiedBackup(envelope(Buffer.from('not SQLite')),destination));
  assert.deepEqual(readdirSync(destination).sort(),before);
  assert.equal(sha(readFileSync(first.filename)),first.sha256);
});
