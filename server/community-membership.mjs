import {randomBytes} from 'node:crypto';
import {requireValue} from './common.mjs';

export const communityEnabled=w=>JSON.parse(w.settings||'{}').communityEnabled!==false;
export const communityCode=()=>randomBytes(5).toString('hex').toUpperCase();

export function createCommunityMembership(store,{owner}){
  const {get,all,run,atomic}=store;
  function create(s,b){
    owner(s);
    requireValue(typeof b.communityName==='string'&&b.communityName.trim().length>=2&&b.communityName.trim().length<=80,'Nama kelompok harus 2–80 karakter.');
    return atomic(()=>{
      const w=get('SELECT * FROM workspaces WHERE id=?',s.workspace_id);
      requireValue(w.owner_business_id===s.business_id,'Kamu sudah menjadi anggota kelompok. Hubungi pengelola untuk perubahan kelompok.',409);
      if(communityEnabled(w)){
        requireValue(w.name===b.communityName.trim(),'Kelompok sudah dibuat. Gunakan pengaturan nama kelompok.',409);
        return {saved:true,duplicate:true};
      }
      run('UPDATE workspaces SET name=?,join_code=?,settings=? WHERE id=?',b.communityName.trim(),communityCode(),JSON.stringify({...JSON.parse(w.settings||'{}'),communityEnabled:true}),w.id);
      store.log(w.id,s.business_id,'Pemilik membuat kelompok Beli bersama.');return {saved:true};
    });
  }
  function join(s,b){
    owner(s);
    requireValue(typeof b.inviteCode==='string'&&/^[a-zA-Z0-9]{8,64}$/.test(b.inviteCode.trim()),'Periksa kode kelompok yang diberikan pengelola.');
    requireValue(b.confirmed===true,'Konfirmasi perpindahan kelompok terlebih dahulu.');
    return atomic(()=>{
      const target=get('SELECT * FROM workspaces WHERE join_code=? COLLATE NOCASE',b.inviteCode.trim());
      requireValue(target&&communityEnabled(target),'Kode kelompok tidak ditemukan atau sudah diganti.',404);
      if(target.id===s.workspace_id)return {joined:true,duplicate:true};
      requireValue(b.expectedWorkspace===s.workspace_id,'Kelompok berubah. Perbarui data sebelum bergabung.',409);
      const old=get('SELECT * FROM workspaces WHERE id=?',s.workspace_id);
      requireValue(!(old.owner_business_id===s.business_id&&get('SELECT COUNT(*) AS n FROM businesses WHERE workspace_id=?',old.id).n>1),'Kamu masih mengelola anggota lain. Tetap kelola kelompok ini sebelum berpindah.',409);
      requireValue(!get('SELECT id FROM collective_orders WHERE workspace_id=?',old.id),'Riwayat pembelian bersama masih terikat ke kelompok ini. Perpindahan belum dapat dilakukan.',409);
      requireValue(!get('SELECT id FROM offers WHERE workspace_id=? AND owner_id=?',old.id,s.business_id)&&!get('SELECT id FROM transfers WHERE workspace_id=? AND receiver_id=?',old.id,s.business_id),'Usaha ini memiliki riwayat transfer antaranggota yang masih terikat ke kelompok lama.',409);
      requireValue(!get("SELECT id FROM collective_orders WHERE workspace_id=? AND status<>'cancelled' AND cycle=?",target.id,target.active_cycle),'Kelompok tujuan sedang menjalankan rencana pembelian. Tunggu siklus berikutnya.',409);
      // All business rows move atomically; business identity, stock, sales and staff persist.
      // Deferred foreign keys are checked before commit, never disabled.
      store.db.exec('PRAGMA defer_foreign_keys=ON');
      const names=all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").map(r=>r.name);
      for(const name of names){
        const table='"'+name.replaceAll('"','""')+'"',columns=all('PRAGMA table_info('+table+')').map(c=>c.name);
        if(columns.includes('workspace_id')&&columns.includes('business_id'))run(`UPDATE ${table} SET workspace_id=? WHERE workspace_id=? AND business_id=?`,target.id,old.id,s.business_id);
      }
      run('UPDATE businesses SET workspace_id=? WHERE workspace_id=? AND id=?',target.id,old.id,s.business_id);
      run("UPDATE demands SET qty=0,active=0,budget=NULL,expires_at=0,approved_version=NULL,decision='pending' WHERE workspace_id=? AND business_id=?",target.id,s.business_id);
      run('UPDATE ingredients SET shared=0 WHERE workspace_id=? AND business_id=?',target.id,s.business_id);
      const product=JSON.parse(target.settings||'{}').product;
      if(product){
        const normalized=product.name.normalize('NFKC').toLowerCase();
        const existing=get('SELECT * FROM ingredients WHERE workspace_id=? AND business_id=? AND id=?',target.id,s.business_id,product.id)||get('SELECT * FROM ingredients WHERE workspace_id=? AND business_id=? AND normalized_name=?',target.id,s.business_id,normalized);
        requireValue(!existing||(existing.normalized_name===normalized&&existing.unit===product.unit),'Satuan bahan kelompok berbeda dari bahan dengan nama yang sama di katalog usahamu. Samakan satuannya sebelum bergabung; stok tidak diubah.',409);
        if(existing){
          if(existing.id!==product.id){
            // Same normalized name and exact unit: align the internal identifier,
            // retaining every quantity and the original receipt/sale labels.
            for(const name of names){
              const table='"'+name.replaceAll('"','""')+'"',columns=all('PRAGMA table_info('+table+')').map(c=>c.name);
              if(!columns.includes('workspace_id')||!columns.includes('business_id'))continue;
              if(columns.includes('product_id'))run(`UPDATE ${table} SET product_id=? WHERE workspace_id=? AND business_id=? AND product_id=?`,product.id,target.id,s.business_id,existing.id);
              for(const column of ['recipe','usage_snapshot','usage_json','waste_json'].filter(c=>columns.includes(c))){
                for(const row of all(`SELECT rowid AS _rowid,"${column}" AS value FROM ${table} WHERE workspace_id=? AND business_id=? AND "${column}" IS NOT NULL`,target.id,s.business_id)){
                  const value=JSON.parse(row.value);
                  if(Object.hasOwn(value,existing.id)){
                    requireValue(!Object.hasOwn(value,product.id),'Bahan bersama bertabrakan dengan catatan lama. Data asal tetap utuh.',409);
                    value[product.id]=value[existing.id];delete value[existing.id];
                    run(`UPDATE ${table} SET "${column}"=? WHERE rowid=?`,JSON.stringify(value),row._rowid);
                  }
                }
              }
            }
            run('UPDATE ingredients SET id=? WHERE workspace_id=? AND business_id=? AND id=?',product.id,target.id,s.business_id,existing.id);
          }
          run('UPDATE ingredients SET shared=1 WHERE workspace_id=? AND business_id=? AND id=?',target.id,s.business_id,product.id);
        }
        else{
          requireValue(get('SELECT COUNT(*) AS n FROM ingredients WHERE workspace_id=? AND business_id=?',target.id,s.business_id).n<25,'Katalog bahan sudah penuh. Periksa katalog sebelum menambah bahan bersama.',409);
          run('INSERT INTO ingredients VALUES(?,?,?,?,?,?,0,?,1)',target.id,s.business_id,product.id,product.name,normalized,product.unit,'');
          run('INSERT INTO inventory VALUES(?,?,?,?,NULL)',target.id,s.business_id,product.id,0);
        }
      }
      // Old sessions and public links must not keep authority after scope changes.
      run('DELETE FROM sessions WHERE workspace_id=? AND business_id=? AND id<>?',target.id,s.business_id,s.id);
      run('UPDATE display_access SET revoked_at=? WHERE workspace_id=? AND business_id=? AND revoked_at IS NULL',new Date().toISOString(),target.id,s.business_id);
      run('UPDATE account_roles SET revision=revision+1 WHERE workspace_id=? AND business_id=?',target.id,s.business_id);
      run('UPDATE business_state SET catalog_revision=catalog_revision+1 WHERE workspace_id=? AND business_id=?',target.id,s.business_id);
      run('UPDATE workspaces SET version=version+1 WHERE id IN (?,?)',old.id,target.id);
      if(old.owner_business_id===s.business_id)run('UPDATE workspaces SET join_code=NULL,settings=? WHERE id=?',JSON.stringify({...JSON.parse(old.settings||'{}'),communityEnabled:false}),old.id);
      run("UPDATE demands SET approved_version=NULL,decision='pending' WHERE workspace_id IN (?,?)",old.id,target.id);
      requireValue(all('PRAGMA foreign_key_check').length===0,'Perpindahan belum dapat disimpan. Data asal tetap utuh.',409);
      store.withActor({...s,workspace_id:target.id},()=>store.log(target.id,s.business_id,'Pemilik bergabung ke kelompok melalui Beli bersama. Izin berbagi kebutuhan direset.'));
      return {joined:true};
    });
  }
  return {createCommunity:create,joinCommunity:join};
}
