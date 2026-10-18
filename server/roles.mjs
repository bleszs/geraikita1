import {requireValue} from './common.mjs';

export function migrateRoles(db){
  db.exec('BEGIN IMMEDIATE');try{
  const first=!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='account_roles'").get();
  db.exec(`CREATE TABLE IF NOT EXISTS account_roles(account_id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','cashier','kitchen')),name TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,disabled_at TEXT,created_by TEXT,idem TEXT,fingerprint TEXT,FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id),UNIQUE(workspace_id,business_id,idem));
    CREATE UNIQUE INDEX IF NOT EXISTS role_owner ON account_roles(workspace_id,business_id) WHERE role='owner';
    CREATE TABLE IF NOT EXISTS staff_actions(workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,idem TEXT NOT NULL,fingerprint TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(workspace_id,business_id,idem));`);
  if(first)db.exec("INSERT INTO account_roles(account_id,workspace_id,business_id,role,name) SELECT id,workspace_id,business_id,'owner','Pemilik usaha' FROM accounts");
  db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
}
export const staffPrefix=s=>`${s.account_id}:${s.role_revision}:`;
export function authorize(s,path,method,body){
  if(s.role==='owner')return;
  const reading=method==='GET',actions=path.match(/^\/api\/kitchen\/orders\/[a-zA-Z0-9-]+\/actions$/),decision=/^\/api\/order-requests\/[a-zA-Z0-9-]+\/decision$/.test(path);
  let allowed=reading&&['/api/bootstrap','/api/kitchen','/api/kitchen/events'].includes(path);
  if(method==='POST'){
    allowed=['/api/auth/logout','/api/account/password'].includes(path)||s.role==='cashier'&&['/api/kitchen/orders','/api/extractions','/api/kitchen/extractions','/api/transcriptions','/api/transactions'].includes(path)||s.role==='cashier'&&decision||s.role==='kitchen'&&['/api/kitchen/commands','/api/transcriptions'].includes(path);
    if(actions)allowed=(s.role==='cashier'?['complete','cancel']:['start','passive','resume','ready']).includes(body.action)&&body.wasted===undefined;
  }
  requireValue(allowed,'Peran akun ini tidak memiliki akses ke tindakan tersebut.',403,'role_forbidden');
  if(method==='POST'&&(path==='/api/kitchen/orders'||path==='/api/transactions'||actions))requireValue(typeof body.idempotencyKey==='string'&&body.idempotencyKey.startsWith(staffPrefix(s)),'Kunci tindakan harus berasal dari akun dan versi peran saat ini.',409);
}
export function staffBootstrap(store,service,s,account){
  const source=service.kitchen.snapshot(s),cashier=s.role==='cashier',prefix=staffPrefix(s);
  const orders=source.orders.filter(o=>!['completed','cancelled','discarded'].includes(o.status)||o.idem.startsWith(prefix)).map(o=>({id:o.id,label:o.label,channel:o.channel,status:o.status,revision:o.revision,created_at:o.created_at,etaMinutes:o.etaMinutes,
    ...(o.idem.startsWith(prefix)?{idem:o.idem}:{}),...(cashier?{total:o.total}:{}),
    items:o.items.map(i=>({id:i.id,name:i.name,qty:i.qty,note:i.note,...(i.voided?{voided:true}:{}),...(cashier?{unitPrice:i.unitPrice}:{})})),
    tasks:o.tasks.map(t=>({id:t.id,name:t.name,qty:t.qty,note:t.note,station:t.station,minutes:t.minutes,passive_minutes:t.passive_minutes,status:t.status,phase_started_at:t.phase_started_at,etaMinutes:t.etaMinutes}))}));
  const row=store.get('SELECT id,name,letter FROM businesses WHERE workspace_id=? AND id=?',s.workspace_id,s.business_id),epoch=store.get('SELECT created_at FROM workspaces WHERE id=?',s.workspace_id).created_at;
  const lowStock=cashier?store.ingredients(s).filter(p=>service.available(s,p.id)<p.min*10000).map(p=>p.name):[];
  return {mode:'live',workspaceId:s.workspace_id,workspaceEpoch:epoch,business:row,account,csrf:s.csrf,menu:cashier?store.menus(s).map(m=>({id:m.id,name:m.name,price:m.price})):[],lowStock,catalogRevision:store.get('SELECT catalog_revision FROM business_state WHERE workspace_id=? AND business_id=?',s.workspace_id,s.business_id).catalog_revision,
    recentSales:cashier?store.all('SELECT idem FROM sales WHERE workspace_id=? AND business_id=? AND substr(idem,1,?)=?',s.workspace_id,s.business_id,prefix.length,prefix).map(r=>r.idem):[],...(cashier?{finance:service.finance(s)}:{}),kitchen:{orders,next:source.next,requests:cashier?source.requests:[],stations:source.stations.map(({revision,...c})=>c),menus:cashier?source.menus.map(({id,name,configured,status})=>({id,name,configured,status})):[],recentActions:source.recentActions.filter(k=>k.startsWith(prefix)),revision:source.revision},offlineRestricted:true};
}
