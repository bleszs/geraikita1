import {createHash,randomUUID} from 'node:crypto';
import {requireValue} from './common.mjs';
import {normalizeStaffCode} from './staff-invites.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const validCode=code=>/^[A-HJ-NP-Z2-9]{8}$/.test(code);

export function migrateStaffAccess(db){
  db.exec(`CREATE TABLE IF NOT EXISTS staff_profiles(
    account_id TEXT PRIMARY KEY,phone TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',access_code TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS staff_access_codes(
    account_id TEXT PRIMARY KEY,code_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,created_by TEXT NOT NULL,
    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES accounts(id));
    CREATE TABLE IF NOT EXISTS staff_access_actions(
    workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,idem TEXT NOT NULL,fingerprint TEXT NOT NULL,result TEXT NOT NULL,
    PRIMARY KEY(workspace_id,business_id,idem));`);
  if(!db.prepare('PRAGMA table_info(staff_profiles)').all().some(c=>c.name==='access_code'))db.exec("ALTER TABLE staff_profiles ADD COLUMN access_code TEXT NOT NULL DEFAULT ''");
}

export function createStaffAccess(store,{owner,account,issue}){
  const {get,run,atomic}=store,scope=s=>[s.workspace_id,s.business_id];
  function create(s,b){
    owner(s);const code=normalizeStaffCode(b.code),name=typeof b.name==='string'?b.name.trim():'',phone=typeof b.phone==='string'?b.phone.trim():'',notes=typeof b.notes==='string'?b.notes.trim():'';
    requireValue(validCode(code),'Kode staf belum valid. Buat ulang kode.');
    requireValue(name.length>=2&&name.length<=60,'Nama staf harus 2–60 karakter.');
    requireValue(['cashier','kitchen'].includes(b.role),'Pilih kategori Kasir atau Dapur.');
    requireValue(phone.length<=30,'Nomor telepon maksimal 30 karakter.');
    requireValue(notes.length<=240,'Biodata atau catatan maksimal 240 karakter.');
    requireValue(b.confirmed===true,'Periksa biodata dan kategori staf sebelum menyimpan.');
    requireValue(typeof b.idempotencyKey==='string'&&b.idempotencyKey.length>=8&&b.idempotencyKey.length<=100,'Kunci pembuatan staf tidak valid.');
    const codeHash=digest(code),fingerprint=digest(JSON.stringify([name,b.role,phone,notes,codeHash]));
    return atomic(()=>{
      const previous=get('SELECT fingerprint,result FROM staff_access_actions WHERE workspace_id=? AND business_id=? AND idem=?',...scope(s),b.idempotencyKey);
      if(previous){requireValue(previous.fingerprint===fingerprint,'Kunci pembuatan sudah dipakai untuk staf berbeda.',409);const saved=JSON.parse(previous.result);delete saved.accessCode;return {...saved,duplicate:true};}
      requireValue(get("SELECT COUNT(*) AS n FROM account_roles WHERE workspace_id=? AND business_id=? AND role<>'owner'",...scope(s)).n<30,'Maksimal 30 staf per usaha.',409);
      requireValue(!get('SELECT account_id FROM staff_access_codes WHERE code_hash=?',codeHash)&&!get('SELECT id FROM staff_invites WHERE code_hash=?',codeHash),'Kode bertabrakan. Buat ulang kode.',409);
      const id=randomUUID(),now=new Date().toISOString();
      run('INSERT INTO accounts(id,email,password_hash,salt,workspace_id,business_id,created_at) VALUES(?,NULL,NULL,NULL,?,?,?)',id,...scope(s),now);
      run('INSERT INTO account_roles(account_id,workspace_id,business_id,role,name,created_by) VALUES(?,?,?,?,?,?)',id,...scope(s),b.role,name,account(s).id);
      run('INSERT INTO staff_profiles(account_id,phone,notes) VALUES(?,?,?)',id,phone,notes);
      run('INSERT INTO staff_access_codes(account_id,code_hash,created_at,created_by) VALUES(?,?,?,?)',id,codeHash,now,account(s).id);
      const result={id,name,role:b.role,phone,notes,revision:1,createdAt:now,disabled:false,hasAccessCode:true};
      run('INSERT INTO staff_access_actions VALUES(?,?,?,?,?)',...scope(s),b.idempotencyKey,fingerprint,JSON.stringify(result));
      store.log(...scope(s),`Staf ditambahkan: ${name} (${b.role}); kode akses aktif sampai staf dihapus.`);return result;
    });
  }
  function login(b){
    const code=normalizeStaffCode(b.code);if(!validCode(code))return null;
    const row=get(`SELECT a.id,a.workspace_id,a.business_id,r.disabled_at FROM staff_access_codes c
      JOIN accounts a ON a.id=c.account_id JOIN account_roles r ON r.account_id=a.id
      WHERE c.code_hash=?`,digest(code));
    requireValue(!row||!row.disabled_at,'Akses staf sudah dinonaktifkan atau dihapus. Hubungi pemilik.',401);
    return row?issue(row):null;
  }
  function remove(s,id,b){
    owner(s);requireValue(b.confirmed===true,'Konfirmasi penghapusan staf.');
    return atomic(()=>{
      const row=get("SELECT account_id,name FROM account_roles WHERE account_id=? AND workspace_id=? AND business_id=? AND role<>'owner'",id,...scope(s));
      requireValue(row,'Staf tidak ditemukan.',404);
      run('DELETE FROM sessions WHERE id IN (SELECT session_id FROM account_sessions WHERE account_id=?)',id);
      run('DELETE FROM staff_invites WHERE account_id=?',id);run('DELETE FROM staff_access_codes WHERE account_id=?',id);run('DELETE FROM staff_profiles WHERE account_id=?',id);
      run('DELETE FROM account_roles WHERE account_id=?',id);run('DELETE FROM accounts WHERE id=?',id);
      store.log(...scope(s),`Staf ${row.name} dihapus; kode dan seluruh sesi dicabut.`);return {id,deleted:true};
    });
  }
  return {createStaffAccess:create,loginStaffAccess:login,deleteStaff:remove};
}
