import {randomUUID} from 'node:crypto';
import {dayAt,requireValue} from './common.mjs';

export function migratePlans(db){
  db.exec(`CREATE TABLE IF NOT EXISTS ai_usage_events(
    id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,
    feature TEXT NOT NULL CHECK(feature IN ('text','speech')),period TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('reserved','succeeded')),created_at INTEGER NOT NULL,
    FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS ai_usage_scope ON ai_usage_events(workspace_id,business_id,period,feature);
    CREATE TABLE IF NOT EXISTS plan_interests(
      workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,need TEXT NOT NULL,note TEXT NOT NULL,updated_at TEXT NOT NULL,
      PRIMARY KEY(workspace_id,business_id),
      FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);`);
}
const limitOf=(value,fallback)=>{
  const n=Number(value??fallback);
  if(!Number.isSafeInteger(n)||n<0)throw new Error('Kuota AI harus bilangan bulat nol atau lebih.');
  return n;
};
export function createPlans(store,{textLimit=process.env.FREE_AI_TEXT_MONTHLY,speechLimit=process.env.FREE_AI_SPEECH_MONTHLY,now=()=>Date.now()}={}){
  const limits={text:limitOf(textLimit,100),speech:limitOf(speechLimit,30)};
  const scope=s=>[s.workspace_id,s.business_id];
  const period=()=>dayAt(now()).slice(0,7);
  // In-flight reservations count atomically across processes; abandoned ones expire.
  const used=(s,feature)=>store.get("SELECT COUNT(*) AS n FROM ai_usage_events WHERE workspace_id=? AND business_id=? AND period=? AND feature=? AND (status='succeeded' OR created_at>?)",...scope(s),period(),feature,now()-300000).n;
  function snapshot(s){return {id:'basic',name:'Mulai',price:0,menuLimit:null,period:period(),
    usage:Object.fromEntries(Object.keys(limits).map(feature=>{const count=used(s,feature);return [feature,{used:count,limit:limits[feature],remaining:Math.max(0,limits[feature]-count)}];})),
    interest:store.get('SELECT need,note,updated_at FROM plan_interests WHERE workspace_id=? AND business_id=?',...scope(s))||null,
    paidAvailable:false};}
  function reserve(s,feature){
    requireValue(Object.hasOwn(limits,feature),'Jenis pemakaian AI tidak dikenal.');
    return store.atomic(()=>{
      requireValue(used(s,feature)<limits[feature],'Kuota AI bulan ini habis. Pencatatan manual tetap tersedia.',429,'ai_quota_exhausted');
      const id=randomUUID();store.run("INSERT INTO ai_usage_events VALUES(?,?,?,?,?,'reserved',?)",id,...scope(s),feature,period(),now());return id;
    });
  }
  function finish(id,succeeded){
    if(succeeded)store.run("UPDATE ai_usage_events SET status='succeeded' WHERE id=?",id);
    else store.run('DELETE FROM ai_usage_events WHERE id=?',id);
  }
  function interest(s,body){
    requireValue(s.role==='owner','Hanya pemilik dapat mencatat kebutuhan paket.',403);
    requireValue(['staff','outlets','ai','analysis','network'].includes(body.need),'Pilih kebutuhan tambahan.');
    requireValue(typeof body.note==='string'&&body.note.trim().length<=500,'Catatan maksimal 500 karakter.');
    requireValue(body.confirmed===true,'Setujui pencatatan kebutuhan terlebih dahulu.');
    store.run(`INSERT INTO plan_interests VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,business_id) DO UPDATE SET need=excluded.need,note=excluded.note,updated_at=excluded.updated_at`,...scope(s),body.need,body.note.trim(),new Date(now()).toISOString());
    return snapshot(s);
  }
  return {snapshot,reserve,finish,interest};
}
