import {randomUUID,createHash} from 'node:crypto';
import {requireValue,units,quantity,dayAt,PAYMENT_METHODS,applicationFee} from './common.mjs';
import {usage} from '../public/catalog.js';
import {planKitchen} from './kitchen-schedule.mjs';
import {pendingRequests} from './order-requests.mjs';

export function migrateKitchen(db){
  db.exec(`CREATE TABLE IF NOT EXISTS kitchen_menus(workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,menu_id TEXT NOT NULL,minutes INTEGER NOT NULL,station TEXT NOT NULL,passive_minutes INTEGER NOT NULL,PRIMARY KEY(workspace_id,business_id,menu_id));
    CREATE TABLE IF NOT EXISTS kitchen_orders(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,idem TEXT NOT NULL,fingerprint TEXT NOT NULL,label TEXT NOT NULL,channel TEXT NOT NULL,status TEXT NOT NULL,revision INTEGER NOT NULL,items TEXT NOT NULL,usage_json TEXT NOT NULL,total INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,sale_id TEXT,UNIQUE(workspace_id,business_id,idem));
    CREATE TABLE IF NOT EXISTS kitchen_tasks(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,order_id TEXT NOT NULL,menu_id TEXT NOT NULL,name TEXT NOT NULL,qty INTEGER NOT NULL,note TEXT NOT NULL,station TEXT NOT NULL,minutes INTEGER NOT NULL,passive_minutes INTEGER NOT NULL,status TEXT NOT NULL,phase_started_at TEXT,FOREIGN KEY(order_id) REFERENCES kitchen_orders(id));
    CREATE TABLE IF NOT EXISTS kitchen_actions(workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,idem TEXT NOT NULL,fingerprint TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(workspace_id,business_id,idem));
    CREATE INDEX IF NOT EXISTS kitchen_scope ON kitchen_orders(workspace_id,business_id,status);
    CREATE TABLE IF NOT EXISTS kitchen_stations(workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,station TEXT NOT NULL,cooks INTEGER NOT NULL,equipment INTEGER,revision INTEGER NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(workspace_id,business_id,station));`);
  // Additive columns: legacy tasks keep NULL and fall back to whole-order usage.
  const columns=db.prepare('PRAGMA table_info(kitchen_tasks)').all().map(c=>c.name);
  if(!columns.includes('item_index'))db.exec('ALTER TABLE kitchen_tasks ADD COLUMN item_index INTEGER');
  if(!columns.includes('usage_json'))db.exec('ALTER TABLE kitchen_tasks ADD COLUMN usage_json TEXT');
  if(!columns.includes('waste_json'))db.exec('ALTER TABLE kitchen_tasks ADD COLUMN waste_json TEXT');
  const stationColumns=db.prepare('PRAGMA table_info(kitchen_stations)').all().map(c=>c.name);
  if(!stationColumns.includes('aging_minutes'))db.exec('ALTER TABLE kitchen_stations ADD COLUMN aging_minutes INTEGER NOT NULL DEFAULT 15 CHECK(aging_minutes BETWEEN 1 AND 120)');
}
const closed=['completed','cancelled','discarded'];
const scope=s=>[s.workspace_id,s.business_id];
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function kitchenReserved(store,s,product){
  return store.all("SELECT usage_json FROM kitchen_orders WHERE workspace_id=? AND business_id=? AND status NOT IN ('completed','cancelled','discarded')",...scope(s)).reduce((sum,r)=>sum+(JSON.parse(r.usage_json)[product]||0),0);
}
// Per-item reservation in integer units; legacy single-item orders use the order total.
function taskUsage(o,t){
  if(t.usage_json)return JSON.parse(t.usage_json);
  return JSON.parse(o.items).length===1?JSON.parse(o.usage_json):null;
}
// Validates an owner-entered waste map against reserved units; omitted products count as fully used.
function wasteOf(reserved,given){
  if(given===undefined||given===null)return {...reserved};
  requireValue(typeof given==='object'&&!Array.isArray(given)&&Object.keys(given).every(p=>p in reserved),'Bahan terbuang harus berasal dari resep item ini.');
  return Object.fromEntries(Object.entries(reserved).map(([p,max])=>{
    const q=given[p]===undefined?quantity(max):given[p];
    requireValue(typeof q==='number'&&Number.isFinite(q)&&q>=0&&Math.abs(q-quantity(units(q)))<1e-9&&units(q)<=max,'Jumlah bahan terbuang harus 0 sampai jumlah yang dicadangkan, maksimal empat angka desimal.');
    return [p,units(q)];
  }));
}
export function createKitchen(store,{available,stockChanged}){
  const {get,all,run,atomic,log,movement}=store;
  const order=(s,id)=>{const r=get('SELECT * FROM kitchen_orders WHERE workspace_id=? AND business_id=? AND id=?',...scope(s),id);requireValue(r,'Pesanan dapur tidak ditemukan.',404);return r;};
  function snapshot(s){
    const settings=all('SELECT menu_id AS menuId,minutes,station,passive_minutes AS passiveMinutes FROM kitchen_menus WHERE workspace_id=? AND business_id=?',...scope(s));
    const rows=all('SELECT * FROM kitchen_orders WHERE workspace_id=? AND business_id=? ORDER BY created_at DESC,rowid DESC',...scope(s));
    const tasks=all('SELECT * FROM kitchen_tasks WHERE workspace_id=? AND business_id=?',...scope(s));
    const capacities=all('SELECT station,cooks,equipment,revision,aging_minutes AS agingMinutes FROM kitchen_stations WHERE workspace_id=? AND business_id=?',...scope(s));
    const {stations,next,taskEtas,orderEtas}=planKitchen(rows,tasks,settings,capacities);
    const ingredients=store.ingredients(s),stock=new Map(ingredients.map(p=>[p.id,available(s,p.id)]));
    const menus=store.menus(s).map(m=>{
      const portions=Math.max(0,Math.min(...Object.entries(m.recipe).map(([p,q])=>Math.floor((stock.get(p)||0)/units(q)))));
      const low=Object.keys(m.recipe).some(p=>{const min=ingredients.find(i=>i.id===p)?.min||0;return min>0&&(stock.get(p)||0)<=units(min);});
      return {id:m.id,name:m.name,configured:settings.some(x=>x.menuId===m.id),portions,status:portions<=0?'out':low?'low':'ok'};
    });
    const orders=rows.map(o=>{const orderTasks=tasks.filter(t=>t.order_id===o.id).map(t=>({...t,usage:taskUsage(o,t),waste:t.waste_json?JSON.parse(t.waste_json):null,etaMinutes:taskEtas.has(t.id)?Math.ceil(taskEtas.get(t.id)):null}));return{...o,items:JSON.parse(o.items),usage:JSON.parse(o.usage_json),tasks:orderTasks,etaMinutes:orderEtas.get(o.id)};});
    // Pending web catalog requests share the kitchen revision so SSE clients see them immediately.
    const requests=pendingRequests(store,s);
    return {settings,stations,orders,next,menus,requests,recentActions:all('SELECT idem FROM kitchen_actions WHERE workspace_id=? AND business_id=? ORDER BY rowid DESC',...scope(s)).map(x=>x.idem),revision:hash([rows.map(o=>[o.id,o.revision,orderEtas.get(o.id)]),menus,settings,stations,next,[...taskEtas].map(([id,value])=>[id,Math.ceil(value)]),requests.map(r=>r.id)])};
  }
  function consume(s,used,reason,ref,date){
    for(const [p,q] of Object.entries(used)){
      if(!q)continue;
      requireValue(get('SELECT quantity FROM inventory WHERE workspace_id=? AND business_id=? AND product_id=?',...scope(s),p)?.quantity>=q,'Saldo stok tidak cukup. Periksa ledger.',409);
      run('UPDATE inventory SET quantity=quantity-? WHERE workspace_id=? AND business_id=? AND product_id=?',q,...scope(s),p);
      run('INSERT INTO daily_usage VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,business_id,product_id,date) DO UPDATE SET quantity=quantity+excluded.quantity',...scope(s),p,date,q);
      movement(...scope(s),p,-quantity(q),reason,ref);
    }
  }
  function create(s,b){
    requireValue(typeof b.idempotencyKey==='string'&&b.idempotencyKey.length>=8&&b.idempotencyKey.length<=100,'Kunci pesanan tidak valid.');
    requireValue(typeof b.label==='string'&&b.label.trim().length>=1&&b.label.trim().length<=60,'Isi nomor meja atau nama pesanan, maksimal 60 karakter.');
    requireValue(['dine_in','takeaway','web','external_manual'].includes(b.channel),'Pilih sumber pesanan.');
    requireValue(Array.isArray(b.items)&&b.items.length>0&&b.items.length<=20,'Isi 1–20 item pesanan.');
    requireValue(b.items.every(i=>i&&typeof i.id==='string'&&Number.isInteger(i.qty)&&i.qty>=1&&i.qty<=99&&(!i.note||typeof i.note==='string'&&i.note.length<=500)),'Item pesanan tidak valid.');
    const fingerprint=hash([b.label.trim(),b.channel,b.items,b.catalogRevision]);
    return atomic(()=>{
      const previous=get('SELECT id,fingerprint FROM kitchen_orders WHERE workspace_id=? AND business_id=? AND idem=?',...scope(s),b.idempotencyKey);
      if(previous){requireValue(previous.fingerprint===fingerprint,'Kunci pesanan sudah dipakai untuk rincian berbeda.',409);return {id:previous.id,duplicate:true};}
      requireValue(get('SELECT catalog_revision FROM business_state WHERE workspace_id=? AND business_id=?',...scope(s)).catalog_revision===b.catalogRevision,'Katalog berubah. Perbarui dan tinjau kembali pesanan.',409);
      const menus=store.menus(s),settings=snapshot(s).settings;
      const items=b.items.map(i=>{const m=menus.find(m=>m.id===i.id),p=settings.find(p=>p.menuId===i.id);requireValue(m&&p,'Atur waktu dan stasiun setiap menu di Produk & stok terlebih dahulu.',409);return {...i,note:i.note||'',name:m.name,unitPrice:m.price,preparation:p};});
      const used=usage(items,menus);
      for(const [p,q] of Object.entries(used))requireValue(available(s,p)>=units(q),'Bahan tidak cukup atau sedang dicadangkan untuk pesanan/surplus lain.',409);
      const id=randomUUID(),now=new Date().toISOString(),total=items.reduce((v,i)=>v+i.unitPrice*i.qty,0);
      run('INSERT INTO kitchen_orders VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)',id,...scope(s),b.idempotencyKey,fingerprint,b.label.trim(),b.channel,'queued',1,JSON.stringify(items),JSON.stringify(Object.fromEntries(Object.entries(used).map(([p,q])=>[p,units(q)]))),total,now,now);
      items.forEach((i,index)=>run('INSERT INTO kitchen_tasks VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,NULL)',randomUUID(),...scope(s),id,i.id,i.name,i.qty,i.note,i.preparation.station,i.preparation.minutes,i.preparation.passiveMinutes,'queued',index,JSON.stringify(Object.fromEntries(Object.entries(usage([i],menus)).map(([p,q])=>[p,units(q)])))));
      stockChanged(s);log(...scope(s),`Pesanan dapur ${b.label.trim()} masuk; bahan dicadangkan, belum menjadi penjualan.`);
      return {id,duplicate:false};
    });
  }
  function change(s,id,b){
    requireValue(typeof b.idempotencyKey==='string'&&b.idempotencyKey.length>=8&&b.idempotencyKey.length<=100,'Kunci tindakan tidak valid.');
    requireValue(Number.isInteger(b.revision),'Versi pesanan tidak valid.');
    requireValue(['start','passive','resume','ready','complete','cancel','discard','void'].includes(b.action),'Tindakan dapur tidak valid.');
    const fingerprint=hash([id,b.action,b.taskId||null,b.revision,b.confirmed===true,...(b.wasted!==undefined?[b.wasted]:[]),...(b.paymentMethod!==undefined?[b.paymentMethod]:[])]);
    return atomic(()=>{
      const prev=get('SELECT * FROM kitchen_actions WHERE workspace_id=? AND business_id=? AND idem=?',...scope(s),b.idempotencyKey);
      if(prev){requireValue(prev.fingerprint===fingerprint,'Kunci tindakan dipakai untuk tindakan berbeda.',409);return {...JSON.parse(prev.result),duplicate:true};}
      const o=order(s,id);requireValue(o.revision===b.revision,'Pesanan berubah di perangkat lain. Perbarui data dan periksa statusnya.',409);
      requireValue(!closed.includes(o.status),'Pesanan sudah ditutup.',409);
      const tasks=all('SELECT * FROM kitchen_tasks WHERE workspace_id=? AND business_id=? AND order_id=?',...scope(s),id),live=tasks.filter(t=>t.status!=='voided'),now=new Date().toISOString(),date=dayAt();
      let status=o.status,saleId=null,wasted=null;
      if(['complete','cancel','discard'].includes(b.action)){
        const used=JSON.parse(o.usage_json);
        if(b.action==='cancel'){
          requireValue(live.every(t=>t.status==='queued'),'Pesanan sudah dikerjakan. Gunakan penutupan bahan terpakai, bukan pengembalian stok.',409);
          requireValue(b.wasted===undefined,'Pembatalan sebelum dikerjakan tidak mencatat bahan terbuang.');
          status='cancelled';
        }else if(b.action==='complete'){
          requireValue(b.wasted===undefined,'Penyelesaian memakai resep pesanan; catat bahan terbuang per item.');
          requireValue(live.every(t=>t.status==='ready'),'Selesaikan semua item sebelum menyerahkan pesanan.',409);
          // Payment is taken at completion, so each order is recorded as a sale exactly once.
          const paymentMethod=b.paymentMethod??'tunai';requireValue(PAYMENT_METHODS.includes(paymentMethod),'Metode pembayaran tidak dikenal.');
          status='completed';saleId=randomUUID();consume(s,used,'sale',saleId,date);
          const items=JSON.parse(o.items).filter(i=>!i.voided);
          const fee=applicationFee(o.total),net=o.total-fee;
          run('INSERT INTO sales(id,workspace_id,business_id,idem,fingerprint,items,total,date,created_at,cancelled_at,usage_snapshot,payment_method,fee,net) VALUES(?,?,?,?,?,?,?,?,?,NULL,?,?,?,?)',saleId,...scope(s),'kitchen:'+id,o.fingerprint,JSON.stringify(items),o.total,date,now,JSON.stringify(Object.fromEntries(Object.entries(used).map(([p,q])=>[p,quantity(q)]))),paymentMethod,fee,net);
        }else{
          requireValue(b.confirmed===true&&live.some(t=>t.status!=='queued'),'Konfirmasi bahwa bahan pesanan akan dicatat terpakai tanpa penjualan.',409);
          // Reserved units not recorded as waste are released with the reservation.
          wasted=wasteOf(used,b.wasted);status='discarded';consume(s,wasted,'kitchen_waste',id,date);
        }
      }else if(b.action==='void'){
        const t=live.find(t=>t.id===b.taskId);requireValue(t,'Item dapur tidak ditemukan atau sudah dibatalkan.',404);
        requireValue(live.length>1,'Ini item terakhir. Gunakan pembatalan atau penutupan pesanan.',409);
        const items=JSON.parse(o.items),index=t.item_index??(items.length===1?0:null),reserved=taskUsage(o,t);
        requireValue(index!==null&&reserved,'Pesanan lama belum menyimpan bahan per item. Tutup seluruh pesanan sebagai bahan terpakai.',409);
        if(t.status==='queued'){requireValue(b.wasted===undefined,'Item belum dikerjakan; bahan dikembalikan tanpa catatan terbuang.');wasted={};}
        else{requireValue(b.confirmed===true,'Konfirmasi bahan item yang terbuang terlebih dahulu.',409);wasted=wasteOf(reserved,b.wasted);consume(s,wasted,'kitchen_waste',id,date);}
        const remaining=Object.fromEntries(Object.entries(JSON.parse(o.usage_json)).map(([p,q])=>[p,q-(reserved[p]||0)]).filter(([,q])=>q>0));
        items[index]={...items[index],voided:true};
        run('UPDATE kitchen_tasks SET status=?,phase_started_at=?,waste_json=? WHERE workspace_id=? AND business_id=? AND id=?','voided',now,JSON.stringify(wasted),...scope(s),t.id);
        run('UPDATE kitchen_orders SET items=?,usage_json=?,total=total-? WHERE workspace_id=? AND business_id=? AND id=?',JSON.stringify(items),JSON.stringify(remaining),items[index].unitPrice*items[index].qty,...scope(s),id);
        const rest=live.filter(x=>x.id!==t.id);
        status=rest.every(x=>x.status==='ready')?'ready':o.status==='queued'&&rest.every(x=>x.status==='queued')?'queued':'preparing';
        stockChanged(s);
      }else{
        const t=live.find(t=>t.id===b.taskId);requireValue(t,'Item dapur tidak ditemukan.',404);
        const target={start:'active',passive:'passive',resume:'active',ready:'ready'}[b.action];
        requireValue(({start:['queued'],passive:['active'],resume:['passive'],ready:['active','passive']})[b.action].includes(t.status),'Tahap item sudah berubah atau tindakan tidak sesuai.',409);
        const state=snapshot(s),capacity=state.stations.find(c=>c.station===t.station);
        if(target==='active')requireValue(capacity.active<capacity.cooks,capacity.cooks===1?'Stasiun masih mengerjakan item aktif. Tandai pasif atau siap terlebih dahulu.':`Stasiun sudah memakai ${capacity.cooks} staf aktif. Tandai pasif atau siap terlebih dahulu.`,409);
        if(b.action==='start')requireValue(state.next.find(n=>n.station===t.station)?.taskIds.includes(t.id),'Ada item yang lebih dahulu diprioritaskan pada stasiun ini.',409);
        if(target==='passive'){
          requireValue(t.passive_minutes>0,'Menu ini tidak mempunyai tahap pasif. Atur untuk pesanan berikutnya.',409);
          requireValue(capacity.equipment===null||capacity.passive<capacity.equipment,`Alat tahap pasif stasiun ini penuh (${capacity.equipment}). Tandai item pasif lain siap terlebih dahulu.`,409);
        }
        run('UPDATE kitchen_tasks SET status=?,phase_started_at=? WHERE workspace_id=? AND business_id=? AND id=?',target,now,...scope(s),t.id);
        status=live.every(x=>x.id===t.id?target==='ready':x.status==='ready')?'ready':'preparing';
      }
      run('UPDATE kitchen_orders SET status=?,revision=revision+1,updated_at=?,sale_id=? WHERE workspace_id=? AND business_id=? AND id=?',status,now,saleId,...scope(s),id);
      if(closed.includes(status)){run("UPDATE kitchen_tasks SET status=? WHERE workspace_id=? AND business_id=? AND order_id=? AND status!='voided'",status,...scope(s),id);stockChanged(s);}
      log(...scope(s),`Dapur ${o.label}: ${b.action}${wasted&&Object.values(wasted).some(Boolean)?'; bahan terbuang dicatat':''}; versi ${o.revision+1}.`);
      const result={id,status,revision:o.revision+1,saleId};
      const actor=store.actorOf(s);
      run('INSERT INTO kitchen_actions(workspace_id,business_id,idem,fingerprint,result,actor_id,actor_name,actor_role,actor_revision) VALUES(?,?,?,?,?,?,?,?,?)',...scope(s),b.idempotencyKey,fingerprint,JSON.stringify(result),actor?.id??null,actor?.name??null,actor?.role??null,actor?.revision??null);return result;
    });
  }
  function saveStation(s,b){
    requireValue(typeof b.station==='string'&&b.station.trim().length>=2&&b.station.trim().length<=40,'Pilih stasiun yang sudah dipakai menu.');
    requireValue(Number.isInteger(b.cooks)&&b.cooks>=1&&b.cooks<=20,'Isi jumlah staf aktif 1–20 per stasiun.');
    requireValue(b.equipment===null||Number.isInteger(b.equipment)&&b.equipment>=1&&b.equipment<=50,'Isi kapasitas alat 1–50 atau kosongkan jika tidak dibatasi.');
    requireValue(Number.isInteger(b.revision)&&b.revision>=0,'Versi stasiun tidak valid.');
    requireValue(b.agingMinutes===undefined||Number.isInteger(b.agingMinutes)&&b.agingMinutes>=1&&b.agingMinutes<=120,'Isi batas tunggu 1–120 menit, tanpa pecahan.');
    const station=b.station.trim().normalize('NFKC').toLowerCase();
    return atomic(()=>{
      requireValue(get('SELECT 1 FROM kitchen_menus WHERE workspace_id=? AND business_id=? AND station=?',...scope(s),station),'Stasiun belum dipakai menu mana pun. Atur menu di Produk & stok terlebih dahulu.',404);
      const previous=get('SELECT revision,aging_minutes FROM kitchen_stations WHERE workspace_id=? AND business_id=? AND station=?',...scope(s),station),current=previous?.revision??0;
      const agingMinutes=b.agingMinutes??previous?.aging_minutes??15;
      requireValue(current===b.revision,'Kapasitas stasiun berubah di perangkat lain. Perbarui data dan periksa kembali.',409);
      run('INSERT INTO kitchen_stations(workspace_id,business_id,station,cooks,equipment,revision,updated_at,aging_minutes) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,business_id,station) DO UPDATE SET cooks=excluded.cooks,equipment=excluded.equipment,revision=excluded.revision,updated_at=excluded.updated_at,aging_minutes=excluded.aging_minutes',...scope(s),station,b.cooks,b.equipment,current+1,new Date().toISOString(),agingMinutes);
      log(...scope(s),`Kapasitas stasiun ${station}: ${b.cooks} staf aktif, alat tahap pasif ${b.equipment??'tidak dibatasi'}, batas tunggu ${agingMinutes} menit.`);
      return {station,cooks:b.cooks,equipment:b.equipment,agingMinutes,revision:current+1};
    });
  }
  function command(s,b){
    requireValue(typeof b.text==='string'&&b.text.length>0&&b.text.length<=300,'Isi perintah maksimal 300 karakter.');
    const text=b.text.normalize('NFKC').toLowerCase().trim();
    requireValue(!/\b(jangan|bukan|batal|hapus|kecuali|belum|tidak)\b/.test(text),'Perintah negasi/pembatalan perlu diperiksa lewat tombol.',409);
    const match=text.match(/^(mulai|pasif|lanjutkan|siap|selesai)\s+(.+)$/);requireValue(match,'Gunakan: mulai/pasif/lanjutkan/siap diikuti nama menu dan label pesanan.',409);
    const state=snapshot(s),action={mulai:'start',pasif:'passive',lanjutkan:'resume',siap:'ready',selesai:'ready'}[match[1]];
    const normalize=v=>v.normalize('NFKC').toLowerCase().trim().replace(/\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\b/g,w=>({satu:'1',dua:'2',tiga:'3',empat:'4',lima:'5',enam:'6',tujuh:'7',delapan:'8',sembilan:'9',sepuluh:'10'})[w]).replace(/\s+/g,' ');
    const candidates=state.orders.filter(o=>!closed.includes(o.status)).flatMap(o=>o.tasks.filter(t=>t.status!=='voided'&&normalize(match[2])===normalize(t.name+' '+o.label)).map(t=>({o,t})));
    requireValue(candidates.length===1,'Perintah belum cocok dengan tepat satu item. Sebut nama menu dan label pesanan lengkap.',409);
    const {o,t}=candidates[0];requireValue(b.revisions?.[o.id]===o.revision,'Pesanan berubah sejak perintah dimulai. Perbarui dan ucapkan kembali.',409);
    return {id:o.id,action,taskId:t.id,revision:o.revision,label:o.label,menu:t.name};
  }
  return {snapshot,create,change,command,saveStation};
}
