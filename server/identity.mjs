import {randomUUID,randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {requireValue} from './common.mjs';
import {createStaffInvites} from './staff-invites.mjs';
import {createAccountRecovery,remainingRecoveryCodes} from './account-recovery.mjs';
import {createStaffAccess} from './staff-access.mjs';

export function createIdentity(store) {
  const {get,run,atomic}=store;
  const emailOf=value=>typeof value==='string' ? value.trim().toLowerCase() : '';
  function credentials(body){
    const email=emailOf(body.email);
    requireValue(email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Isi alamat email yang valid.');
    requireValue(typeof body.password==='string' && body.password.length>=10 && body.password.length<=128,'Kata sandi harus 10–128 karakter.');
    return email;
  }
  function issue(account){const s=store.session(account.business_id,account.workspace_id);run('INSERT INTO account_sessions VALUES(?,?)',s.id,account.id);return resolve(s.id);}
  function register(body){
    const email=credentials(body);
    requireValue(typeof body.businessName==='string' && body.businessName.trim().length>=2 && body.businessName.trim().length<=60,'Nama usaha harus 2–60 karakter.');
    const joining=typeof body.inviteCode==='string' && !!body.inviteCode.trim();
    requireValue(joining || (typeof body.communityName==='string' && body.communityName.trim().length>=2 && body.communityName.trim().length<=80),'Isi nama kelompok atau kode bergabung.');
    const salt=randomBytes(16).toString('hex'),hash=scryptSync(body.password,salt,64).toString('hex');
    return atomic(()=>{
      requireValue(!get('SELECT id FROM accounts WHERE email=?',email),'Email sudah terdaftar. Masuk dengan akunmu.',409);
      let workspace=joining && get('SELECT * FROM workspaces WHERE join_code=?',body.inviteCode.trim());
      requireValue(!joining || workspace,'Kode kelompok tidak ditemukan.',404);
      const business=randomUUID(),now=new Date().toISOString();
      if(!joining){const id=randomUUID();run('INSERT INTO workspaces(id,version,quote_expires,created_at,active_cycle,name,join_code,owner_business_id,settings) VALUES(?,1,0,?,1,?,?,?,?)',id,now,body.communityName.trim(),randomBytes(12).toString('hex'),business,'{}');run("INSERT INTO collective_cycles VALUES(?,1,'planning',?,NULL)",id,now);workspace=get('SELECT * FROM workspaces WHERE id=?',id);}
      const name=body.businessName.trim();run('INSERT INTO businesses VALUES(?,?,?,?,?)',workspace.id,business,name,name,Array.from(name)[0].toUpperCase());
      run('INSERT INTO business_state VALUES(?,?,1,0)',workspace.id,business);
      run("INSERT INTO demands(workspace_id,business_id,qty,active,budget,expires_at,approved_version,decision,stock_revision) VALUES(?,?,0,0,NULL,0,NULL,'pending',0)",workspace.id,business);
      const product=JSON.parse(workspace.settings || '{}').product;
      if(product){run('INSERT INTO ingredients VALUES(?,?,?,?,?,?,0,?,1)',workspace.id,business,product.id,product.name,product.name.normalize('NFKC').toLowerCase(),product.unit,'');run('INSERT INTO inventory VALUES(?,?,?,?,NULL)',workspace.id,business,product.id,0);}
      const account={id:randomUUID(),workspace_id:workspace.id,business_id:business};run('INSERT INTO accounts VALUES(?,?,?,?,?,?,?)',account.id,email,hash,salt,workspace.id,business,now);
      run("INSERT INTO account_roles(account_id,workspace_id,business_id,role,name) VALUES(?,?,?,'owner','Pemilik usaha')",account.id,workspace.id,business);
      store.withActor({...account,account_id:account.id},()=>store.log(workspace.id,business,joining ? 'Usaha bergabung ke kelompok dengan kode undangan.' : 'Usaha dan kelompok dibuat oleh pemilik.'));
      return issue(account);
    });
  }
  function login(body){
    const email=credentials(body),account=get('SELECT a.* FROM accounts a JOIN account_roles r ON r.account_id=a.id AND r.workspace_id=a.workspace_id AND r.business_id=a.business_id WHERE a.email=? AND r.disabled_at IS NULL',email);
    // Equal work for unknown addresses; password contents never enter responses or logs.
    const candidate=scryptSync(body.password,account?.salt || 'unregistered-account',64);
    requireValue(account && timingSafeEqual(candidate,Buffer.from(account.password_hash,'hex')),'Email atau kata sandi tidak sesuai.',401);
    return atomic(()=>issue(account));
  }
  function resolve(id){return id && get('SELECT s.*,u.id AS account_id,r.role,r.name AS account_name,r.revision AS role_revision FROM sessions s JOIN account_sessions a ON a.session_id=s.id JOIN accounts u ON u.id=a.account_id AND u.workspace_id=s.workspace_id AND u.business_id=s.business_id JOIN account_roles r ON r.account_id=u.id AND r.workspace_id=u.workspace_id AND r.business_id=u.business_id WHERE s.id=? AND s.expires_at>? AND r.disabled_at IS NULL',id,Date.now());}
  function account(s){const row=get('SELECT a.*,r.role,r.name AS account_name,r.revision AS role_revision FROM accounts a JOIN account_sessions x ON x.account_id=a.id JOIN account_roles r ON r.account_id=a.id AND r.workspace_id=a.workspace_id AND r.business_id=a.business_id WHERE x.session_id=? AND a.workspace_id=? AND a.business_id=? AND r.disabled_at IS NULL',s.id,s.workspace_id,s.business_id);requireValue(row,'Sesi akun tidak ditemukan.',401);return row;}
  function details(s){const a=account(s);return {id:a.id,email:a.email,hasPassword:!!a.password_hash,hasAccessCode:!!store.get('SELECT account_id FROM staff_access_codes WHERE account_id=?',a.id),createdAt:a.created_at,role:a.role,name:a.account_name,roleRevision:a.role_revision,recoveryCodes:a.role==='owner'&&a.password_hash?remainingRecoveryCodes(store,a.id):null};}
  function owner(s){requireValue(account(s).role==='owner','Hanya pemilik usaha dapat mengelola akun staf.',403);}
  function staff(s){owner(s);return store.all("SELECT a.id,a.email,a.created_at,r.name,r.role,r.revision,r.disabled_at,p.phone,p.notes,c.account_id AS code_account FROM accounts a JOIN account_roles r ON r.account_id=a.id LEFT JOIN staff_profiles p ON p.account_id=a.id LEFT JOIN staff_access_codes c ON c.account_id=a.id WHERE a.workspace_id=? AND a.business_id=? AND r.workspace_id=a.workspace_id AND r.business_id=a.business_id AND r.role<>'owner' ORDER BY a.created_at,a.id",s.workspace_id,s.business_id).map(a=>({id:a.id,email:a.email,name:a.name,role:a.role,revision:a.revision,createdAt:a.created_at,disabled:!!a.disabled_at,phone:a.phone||'',notes:a.notes||'',hasAccessCode:!!a.code_account}));}
  function createStaff(s,b){
    owner(s);const email=credentials(b);
    requireValue(typeof b.name==='string'&&b.name.trim().length>=2&&b.name.trim().length<=60,'Nama staf harus 2–60 karakter.');
    requireValue(['cashier','kitchen'].includes(b.role),'Pilih peran Kasir atau Dapur.');
    requireValue(typeof b.idempotencyKey==='string'&&b.idempotencyKey.length>=8&&b.idempotencyKey.length<=100,'Kunci pembuatan staf tidak valid.');
    requireValue(b.confirmed===true,'Periksa akses staf dan konfirmasi pembuatan akun.');
    const fingerprint=createHash('sha256').update(JSON.stringify([email,b.name.trim(),b.role])).digest('hex');
    return atomic(()=>{
      const previous=get('SELECT account_id,fingerprint FROM account_roles WHERE workspace_id=? AND business_id=? AND idem=?',s.workspace_id,s.business_id,b.idempotencyKey);
      if(previous){requireValue(previous.fingerprint===fingerprint,'Kunci pembuatan sudah dipakai untuk staf berbeda.',409);return {id:previous.account_id,duplicate:true};}
      requireValue(!get('SELECT id FROM accounts WHERE email=?',email),'Email sudah digunakan. Pilih alamat email lain.',409);
      requireValue(get("SELECT COUNT(*) AS n FROM account_roles WHERE workspace_id=? AND business_id=? AND role<>'owner'",s.workspace_id,s.business_id).n<30,'Maksimal 30 akun staf per usaha pada versi ini.',409);
      const id=randomUUID(),salt=randomBytes(16).toString('hex'),hash=scryptSync(b.password,salt,64).toString('hex');
      run('INSERT INTO accounts VALUES(?,?,?,?,?,?,?)',id,email,hash,salt,s.workspace_id,s.business_id,new Date().toISOString());
      run('INSERT INTO account_roles(account_id,workspace_id,business_id,role,name,created_by,idem,fingerprint) VALUES(?,?,?,?,?,?,?,?)',id,s.workspace_id,s.business_id,b.role,b.name.trim(),account(s).id,b.idempotencyKey,fingerprint);
      store.log(s.workspace_id,s.business_id,`Akun staf dibuat: ${b.name.trim()} (${b.role}).`);return {id,duplicate:false};
    });
  }
  function updateStaff(s,id,b){
    owner(s);requireValue(['disable','enable','role'].includes(b.action),'Tindakan staf tidak valid.');
    requireValue(b.action!=='role'||['cashier','kitchen'].includes(b.role),'Pilih peran Kasir atau Dapur.');
    requireValue(Number.isInteger(b.revision)&&b.confirmed===true,'Periksa perubahan akses dan versi akun staf.');
    requireValue(typeof b.idempotencyKey==='string'&&b.idempotencyKey.length>=8&&b.idempotencyKey.length<=100,'Kunci perubahan staf tidak valid.');
    const fingerprint=createHash('sha256').update(JSON.stringify([id,b.action,b.role||null,b.revision])).digest('hex');
    return atomic(()=>{
      const previous=get('SELECT fingerprint,result FROM staff_actions WHERE workspace_id=? AND business_id=? AND idem=?',s.workspace_id,s.business_id,b.idempotencyKey);
      if(previous){requireValue(previous.fingerprint===fingerprint,'Kunci tindakan sudah digunakan untuk perubahan berbeda.',409);return {...JSON.parse(previous.result),duplicate:true};}
      const row=get("SELECT * FROM account_roles WHERE account_id=? AND workspace_id=? AND business_id=? AND role<>'owner'",id,s.workspace_id,s.business_id);
      requireValue(row,'Akun staf tidak ditemukan.',404);requireValue(row.revision===b.revision,'Akses staf berubah. Perbarui daftar sebelum menyimpan.',409);
      if(b.action==='disable')run('UPDATE account_roles SET disabled_at=?,revision=revision+1 WHERE account_id=?',new Date().toISOString(),id);
      if(b.action==='enable')run('UPDATE account_roles SET disabled_at=NULL,revision=revision+1 WHERE account_id=?',id);
      if(b.action==='role')run('UPDATE account_roles SET role=?,revision=revision+1 WHERE account_id=?',b.role,id);
      run('DELETE FROM sessions WHERE id IN (SELECT session_id FROM account_sessions WHERE account_id=?)',id);
      run('UPDATE staff_invites SET revoked_at=? WHERE account_id=? AND used_at IS NULL AND revoked_at IS NULL',new Date().toISOString(),id);
      store.log(s.workspace_id,s.business_id,`Akses staf ${row.name}: ${b.action}; seluruh sesi akun ini dikeluarkan.`);
      const result={id,revision:row.revision+1};run('INSERT INTO staff_actions VALUES(?,?,?,?,?)',s.workspace_id,s.business_id,b.idempotencyKey,fingerprint,JSON.stringify(result));return result;
    });
  }
  function saveBusiness(s,body){
    owner(s);
    requireValue(typeof body.businessName==='string' && body.businessName.trim().length>=2 && body.businessName.trim().length<=60,'Nama usaha harus 2–60 karakter.');
    const name=body.businessName.trim();return atomic(()=>{account(s);run('UPDATE businesses SET name=?,short_name=?,letter=? WHERE workspace_id=? AND id=?',name,name,Array.from(name)[0].toUpperCase(),s.workspace_id,s.business_id);store.log(s.workspace_id,s.business_id,'Nama usaha diperbarui oleh pemilik akun.');return {saved:true};});
  }
  function changePassword(s,body){
    requireValue(typeof body.currentPassword==='string' && body.currentPassword.length>=10 && body.currentPassword.length<=128,'Isi kata sandi saat ini.');
    requireValue(typeof body.newPassword==='string' && body.newPassword.length>=10 && body.newPassword.length<=128,'Kata sandi baru harus 10–128 karakter.');
    requireValue(body.currentPassword!==body.newPassword,'Gunakan kata sandi baru yang berbeda.');
    const a=account(s);requireValue(a.password_hash&&a.salt,'Akun ini masuk dengan kode. Minta kode baru kepada pemilik jika perlu masuk lagi.',403);const candidate=scryptSync(body.currentPassword,a.salt,64);
    requireValue(timingSafeEqual(candidate,Buffer.from(a.password_hash,'hex')),'Kata sandi saat ini tidak sesuai.',403,'incorrect_password');
    const salt=randomBytes(16).toString('hex'),hash=scryptSync(body.newPassword,salt,64).toString('hex');
    return atomic(()=>{
      run('UPDATE accounts SET password_hash=?,salt=? WHERE id=?',hash,salt,a.id);
      const result=run('DELETE FROM sessions WHERE id IN (SELECT session_id FROM account_sessions WHERE account_id=? AND session_id<>?)',a.id,s.id);
      run('UPDATE staff_invites SET revoked_at=? WHERE account_id=? AND used_at IS NULL AND revoked_at IS NULL',new Date().toISOString(),a.id);
      store.log(s.workspace_id,s.business_id,'Kata sandi diperbarui; sesi lain pada akun ini dikeluarkan.');return {saved:true,revokedSessions:Number(result.changes)};
    });
  }
  function saveCommunity(s,body){
    owner(s);
    requireValue(typeof body.communityName==='string' && body.communityName.trim().length>=2 && body.communityName.trim().length<=80,'Nama kelompok harus 2–80 karakter.');
    return atomic(()=>{account(s);const w=get('SELECT owner_business_id FROM workspaces WHERE id=?',s.workspace_id);requireValue(w.owner_business_id===s.business_id,'Hanya pengelola kelompok dapat mengubah pengaturan ini.',403);run('UPDATE workspaces SET name=? WHERE id=?',body.communityName.trim(),s.workspace_id);store.log(s.workspace_id,s.business_id,'Nama kelompok diperbarui oleh pengelola.');return {saved:true};});
  }
  function rotateInvite(s,body){
    owner(s);
    requireValue(typeof body.expectedCode==='string' && body.expectedCode.length<=64,'Kode undangan asal tidak valid.');
    return atomic(()=>{account(s);const w=get('SELECT owner_business_id,join_code FROM workspaces WHERE id=?',s.workspace_id);requireValue(w.owner_business_id===s.business_id,'Hanya pengelola kelompok dapat mengganti kode undangan.',403);requireValue(w.join_code===body.expectedCode,'Kode sudah berubah. Perbarui data untuk melihat kode terbaru.',409);const code=randomBytes(12).toString('hex');run('UPDATE workspaces SET join_code=? WHERE id=?',code,s.workspace_id);store.log(s.workspace_id,s.business_id,'Kode undangan diganti; kode sebelumnya tidak dapat dipakai bergabung.');return {saved:true};});
  }
  const legacyInvites=createStaffInvites(store,{owner,account,issue}),access=createStaffAccess(store,{owner,account,issue});
  function loginStaffCode(body){return access.loginStaffAccess(body)||legacyInvites.loginStaffCode(body);}
  return store.attribute({register,login,resolve,details,staff,createStaff,updateStaff,saveBusiness,changePassword,saveCommunity,rotateInvite,...legacyInvites,...access,loginStaffCode,...createAccountRecovery(store,{account,owner,issue,emailOf})});
}
