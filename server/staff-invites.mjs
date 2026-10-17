import {createHash,randomUUID} from 'node:crypto';
import {requireValue} from './common.mjs';
export const STAFF_CODE_TTL=15*60*1000;
export const normalizeStaffCode=code=>typeof code==='string'?code.replace(/[\s-]/g,'').toUpperCase():'';
const validCode=code=>/^[A-HJ-NP-Z2-9]{8}$/.test(code);
const digest=value=>createHash('sha256').update(value).digest('hex');
export const accountTableSQL=(name='accounts')=>`CREATE TABLE ${name}(id TEXT PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT,salt TEXT,workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,created_at TEXT NOT NULL,CHECK((email IS NULL AND password_hash IS NULL AND salt IS NULL) OR (email IS NOT NULL AND password_hash IS NOT NULL AND salt IS NOT NULL)),FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE)`;

// Generalized ALTER TABLE procedure: copy first, then replace in one transaction.
// No values/IDs/credential hashes change and FK cascades are disabled for the copy.
export function migrateAccountCredentials(db){
  const columns=db.prepare('PRAGMA table_info(accounts)').all();
  if(!columns.find(c=>c.name==='email')?.notnull)return;
  if(columns.map(c=>c.name).join(',')!=='id,email,password_hash,salt,workspace_id,business_id,created_at')throw Error('Schema akun belum dikenali; migrasi dibatalkan tanpa mengganti tabel.');
  const custom=db.prepare("SELECT type,sql FROM sqlite_master WHERE type IN ('view','trigger') AND tbl_name<>'accounts' AND sql IS NOT NULL").all();
  if(custom.some(c=>/\baccounts\b/i.test(c.sql)))throw Error('Periksa view/trigger akun tambahan sebelum migrasi.');
  const objects=db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name='accounts' AND type IN ('index','trigger') AND sql IS NOT NULL").all();
  const foreignKeys=db.prepare('PRAGMA foreign_keys').get().foreign_keys;
  db.exec('PRAGMA foreign_keys=OFF');
  try{
    db.exec('BEGIN IMMEDIATE');
    db.exec(accountTableSQL('accounts_pairing_migration'));
    db.exec('INSERT INTO accounts_pairing_migration SELECT id,email,password_hash,salt,workspace_id,business_id,created_at FROM accounts');
    db.exec('DROP TABLE accounts; ALTER TABLE accounts_pairing_migration RENAME TO accounts');
    for(const object of objects)db.exec(object.sql);
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Relasi akun tidak valid; migrasi dibatalkan.');
    db.exec('COMMIT');
  }catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}
  finally{db.exec('PRAGMA foreign_keys='+Number(foreignKeys));}
}
export function migrateStaffInvites(db){
  db.exec(`CREATE TABLE IF NOT EXISTS staff_invites(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,account_id TEXT NOT NULL,role_revision INTEGER NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('cashier','kitchen')),code_hash TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL,created_at TEXT NOT NULL,expires_at INTEGER NOT NULL,used_at TEXT,revoked_at TEXT,idem TEXT NOT NULL,fingerprint TEXT NOT NULL,UNIQUE(workspace_id,business_id,idem),FOREIGN KEY(account_id) REFERENCES accounts(id),FOREIGN KEY(created_by) REFERENCES accounts(id),FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id));
    CREATE INDEX IF NOT EXISTS staff_invite_scope ON staff_invites(workspace_id,business_id,account_id);`);
}
export function createStaffInvites(store,{owner,account,issue}){
  const {get,all,run,atomic}=store,scope=s=>[s.workspace_id,s.business_id];
  const select=`SELECT i.*,r.revision AS current_revision,r.disabled_at,r.role AS current_role FROM staff_invites i JOIN account_roles r ON r.account_id=i.account_id AND r.workspace_id=i.workspace_id AND r.business_id=i.business_id`;
  const status=r=>r.used_at?'used':r.revoked_at||r.disabled_at||r.current_revision!==r.role_revision||r.current_role!==r.role?'revoked':r.expires_at<=Date.now()?'expired':'active';
  const metadata=r=>({id:r.id,accountId:r.account_id,name:r.name,role:r.role,createdAt:r.created_at,expiresAt:new Date(r.expires_at).toISOString(),status:status(r)});
  function staffInvites(s){owner(s);return all(select+' WHERE i.workspace_id=? AND i.business_id=? ORDER BY i.created_at DESC,i.rowid DESC LIMIT 50',...scope(s)).map(metadata);}
  function createStaffInvite(s,b){
    owner(s);const code=normalizeStaffCode(b.code),existing=typeof b.accountId==='string'&&!!b.accountId;
    requireValue(validCode(code),'Kode baru belum valid. Buka kembali pembuatan kode.');
    requireValue(b.confirmed===true,'Periksa nama dan hak akses staf lalu konfirmasi pembuatan kode.');
    requireValue(typeof b.idempotencyKey==='string'&&b.idempotencyKey.length>=8&&b.idempotencyKey.length<=100,'Kunci pembuatan kode tidak valid.');
    requireValue(!existing||Number.isInteger(b.revision),'Versi akun staf belum valid. Perbarui daftar.');
    requireValue(existing||typeof b.name==='string'&&b.name.trim().length>=2&&b.name.trim().length<=60,'Nama staf harus 2–60 karakter.');
    requireValue(existing||['cashier','kitchen'].includes(b.role),'Pilih peran Kasir atau Dapur.');
    const codeHash=digest(code),fingerprint=digest(JSON.stringify([existing?b.accountId:null,existing?b.revision:null,existing?null:b.name.trim(),existing?null:b.role,codeHash]));
    return atomic(()=>{
      const previous=get(select+' WHERE i.workspace_id=? AND i.business_id=? AND i.idem=?',...scope(s),b.idempotencyKey);
      if(previous){requireValue(previous.fingerprint===fingerprint,'Kunci pembuatan sudah dipakai untuk kode atau staf berbeda.',409);return {...metadata(previous),duplicate:true};}
      requireValue(!get('SELECT id FROM staff_invites WHERE code_hash=?',codeHash)&&!get('SELECT account_id FROM staff_access_codes WHERE code_hash=?',codeHash),'Kode sudah pernah dipakai. Tutup pemeriksaan dan buat kode baru.',409);
      let target;
      if(existing){
        target=get("SELECT account_id,name,role,revision,disabled_at FROM account_roles WHERE account_id=? AND workspace_id=? AND business_id=? AND role<>'owner'",b.accountId,...scope(s));
        requireValue(target&&!target.disabled_at,'Staf aktif tidak ditemukan.',404);requireValue(target.revision===b.revision,'Akses staf berubah. Perbarui daftar.',409);
      }else{
        requireValue(get("SELECT COUNT(*) AS n FROM account_roles WHERE workspace_id=? AND business_id=? AND role<>'owner'",...scope(s)).n<30,'Maksimal 30 akun staf per usaha pada versi ini.',409);
        const id=randomUUID();
        run('INSERT INTO accounts(id,email,password_hash,salt,workspace_id,business_id,created_at) VALUES(?,NULL,NULL,NULL,?,?,?)',id,...scope(s),new Date().toISOString());
        run('INSERT INTO account_roles(account_id,workspace_id,business_id,role,name,created_by) VALUES(?,?,?,?,?,?)',id,...scope(s),b.role,b.name.trim(),account(s).id);
        target={account_id:id,name:b.name.trim(),role:b.role,revision:1};
      }
      const now=new Date().toISOString(),id=randomUUID();
      run('UPDATE staff_invites SET revoked_at=? WHERE workspace_id=? AND business_id=? AND account_id=? AND used_at IS NULL AND revoked_at IS NULL',now,...scope(s),target.account_id);
      run('INSERT INTO staff_invites(id,workspace_id,business_id,account_id,role_revision,name,role,code_hash,created_by,created_at,expires_at,idem,fingerprint) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',id,...scope(s),target.account_id,target.revision,target.name,target.role,codeHash,account(s).id,now,Date.now()+STAFF_CODE_TTL,b.idempotencyKey,fingerprint);
      store.log(...scope(s),`Kode masuk sekali pakai dibuat untuk ${target.name} (${target.role}); berlaku 15 menit.`);
      return {...metadata(get(select+' WHERE i.id=?',id)),duplicate:false};
    });
  }
  function revokeStaffInvite(s,id,b){
    owner(s);requireValue(b.confirmed===true,'Konfirmasi pencabutan kode masuk.');
    return atomic(()=>{const row=get(select+' WHERE i.id=? AND i.workspace_id=? AND i.business_id=?',id,...scope(s));requireValue(row,'Kode masuk tidak ditemukan.',404);
      if(status(row)==='active'){run('UPDATE staff_invites SET revoked_at=? WHERE id=?',new Date().toISOString(),id);store.log(...scope(s),`Kode masuk ${row.name} dicabut; sesi yang sudah masuk tidak diubah.`);}
      return metadata(get(select+' WHERE i.id=?',id));
    });
  }
  function loginStaffCode(b){
    const code=normalizeStaffCode(b.code);requireValue(validCode(code),'Kode tidak valid, sudah dipakai atau kedaluwarsa. Minta kode baru kepada pemilik.',401);
    return atomic(()=>{const row=get(select+' WHERE i.code_hash=?',digest(code));requireValue(row&&status(row)==='active','Kode tidak valid, sudah dipakai atau kedaluwarsa. Minta kode baru kepada pemilik.',401);
      run('UPDATE staff_invites SET used_at=? WHERE id=?',new Date().toISOString(),row.id);
      const s=issue({id:row.account_id,workspace_id:row.workspace_id,business_id:row.business_id});
      store.withActor(s,()=>store.log(...scope(s),'Staf masuk dengan kode sekali pakai.'));return s;
    });
  }
  return {staffInvites,createStaffInvite,revokeStaffInvite,loginStaffCode};
}
