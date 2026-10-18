import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {addDays} from '../common.mjs';

const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const finite = v => typeof v === 'number' && Number.isFinite(v);
export function kulakanFeatures(history, asOf, variant) {
  if (!['lags','calendar'].includes(variant) || history.length < 14) throw new Error('Model memerlukan 14 tanggal lengkap.');
  const past = history.slice(-14);
  for (let i=0;i<14;i++) {
    const row=past[i], next=past[i+1]?.date ?? asOf;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || new Date(row.date+'T12:00:00Z').toISOString().slice(0,10)!==row.date || !finite(row.quantity) || row.quantity<0 || addDays(row.date,1)!==next) throw new Error('Tanggal atau jumlah pemakaian tidak lengkap.');
  }
  const q=past.map(r=>r.quantity), scale=Math.max(mean(q),1e-6), last=q.slice(-7), avg=mean(last), sorted=[...last].sort((a,b)=>a-b);
  const x=[...q].reverse().map(n=>n/scale);
  x.push(mean(q.slice(-3))/scale,avg/scale,sorted[3]/scale,Math.sqrt(mean(last.map(n=>(n-avg)**2)))/scale,(avg-mean(q.slice(0,7)))/scale,last.filter(n=>n===0).length/7,(q[7]+q[8])/scale);
  if(variant==='calendar'){
    const day=(new Date(asOf+'T12:00:00Z').getUTCDay()+6)%7;
    x.push(Math.sin(2*Math.PI*day/7),Math.cos(2*Math.PI*day/7),Number(day>=5)+Number((day+1)%7>=5));
  }
  return {x:x.map(v=>Math.round(v*1e12)/1e12),scale,base:2*avg};
}

export function validateKulakanModel(a) {
  if(a?.schemaVersion!==1 || a.kind!=='gerai-kulakan-sales-hgb-v1' || !['lags','calendar'].includes(a.variant) || !finite(a.weight) || a.weight<=0 || a.weight>1 || a.contextDays!==14 || a.horizonDays!==2 || !finite(a.estimator?.bias) || a.features?.length!==(a.variant==='calendar'?24:21) || !Array.isArray(a.estimator.trees) || !a.estimator.trees.length || a.estimator.trees.length>1000) throw new Error('Artefak model kulakan tidak valid.');
  for(const tree of a.estimator.trees){
    if(!Array.isArray(tree) || !tree.length || tree.length>2000)throw new Error('Pohon model tidak valid.');
    for(let i=0;i<tree.length;i++){
      const [f,t,l,r,v,leaf]=tree[i];
      if(!finite(v)||typeof leaf!=='boolean'||(!leaf&&(!Number.isInteger(f)||f<0||f>=a.features.length||!finite(t)||!Number.isInteger(l)||!Number.isInteger(r)||l<=i||r<=i||l>=tree.length||r>=tree.length)))throw new Error('Simpul model tidak valid.');
    }
  }
  return a;
}

export function predictKulakan(a, history, asOf) {
  const {x,scale,base}=kulakanFeatures(history,asOf,a.variant);
  let residual=a.estimator.bias;
  for(const tree of a.estimator.trees){
    let i=0;
    for(let steps=0;steps<tree.length;steps++){
      const [f,t,l,r,v,leaf]=tree[i];
      if(leaf){residual+=v;break;}
      i=x[f]<=t?l:r;
      if(steps===tree.length-1)throw new Error('Siklus pohon model.');
    }
  }
  const result=Math.max(0,base+a.weight*scale*residual);
  if(!finite(result))throw new Error('Prediksi tidak valid.');
  return result;
}

let loaded;
export function loadKulakanModel(){
  if(loaded===undefined){
    try{
      const lock=JSON.parse(readFileSync(new URL('./kulakan-source.json',import.meta.url),'utf8'));
      const raw=readFileSync(new URL('./artifacts/kulakan-sales-v1.json',import.meta.url));
      if(createHash('sha256').update(raw).digest('hex')!==lock.sha256)throw new Error('Checksum model berubah.');
      loaded=validateKulakanModel(JSON.parse(raw.toString('utf8')));
      if(loaded.runId!==lock.runId)throw new Error('Run model berubah.');
    }catch{loaded=null;}
  }
  return loaded;
}

export function kulakanModelSummary(a=loadKulakanModel()){
  if(!a)return {available:false,reason:'Model kulakan belum tersedia.'};
  return {available:true,kind:a.kind,runId:a.runId,trainedAt:a.trainedAt,trainingSeries:a.trainingSeries,trainingTargets:a.trainingTargets,contextDays:a.contextDays,horizonDays:a.horizonDays,source:a.source,evaluation:a.evaluation,
    businessRequirement:'Aktif setelah sedikitnya 42 tanggal tercatat berurutan dan mengalahkan MA7 serta nilai terakhir pada 14 target lokal dua hari.',
    demonstration:{...a.demonstration,cases:a.demonstration.cases.map(c=>({...c,predicted:predictKulakan(a,c.history,c.asOf)}))}};
}

// Public qualification is not evidence of Indonesian ingredient accuracy. Gate every business separately.
export function evaluateLocalKulakan(series,asOf,a=loadKulakanModel()){
  if(!a?.evaluation?.qualified)return {status:'unavailable',reason:'Model publik belum lolos pembanding.'};
  const rows=series.filter(r=>r.date<asOf).sort((a,b)=>a.date.localeCompare(b.date)).slice(-42).map(r=>({date:r.date,quantity:r.qty}));
  if(rows.length<42)return {status:'insufficient_history',reason:`Terkumpul ${rows.length}/42 tanggal tercatat; model publik belum divalidasi pada bahan ini.`};
  if(rows[14].date<=a.trainingThrough)return {status:'not_applicable',reason:'Periode backtest lokal harus sesudah periode pelatihan model publik.'};
  try{
    kulakanFeatures(rows,asOf,a.variant);
    const errors={model:0,ma7:0,naive:0};let actualTotal=0;
    for(let i=14;i<42;i+=2){
      const past=rows.slice(0,i),date=rows[i].date;
      const pred=predictKulakan(a,past,date),actual=rows[i].quantity+rows[i+1].quantity;
      if(addDays(rows[i].date,1)!==rows[i+1].date)throw new Error('Tanggal target terputus.');
      errors.model+=Math.abs(actual-pred);errors.ma7+=Math.abs(actual-2*mean(past.slice(-7).map(r=>r.quantity)));errors.naive+=Math.abs(actual-2*past.at(-1).quantity);actualTotal+=actual;
    }
    const metrics=Object.fromEntries(Object.entries(errors).map(([name,error])=>[name,{mae:error/14,wape:actualTotal?error/actualTotal:null,observations:14}]));
    if(!(errors.model<errors.ma7 && errors.model<errors.naive))return {status:'not_qualified',reason:'Model publik belum mengalahkan kedua pembanding pada histori bahan ini.',localMetrics:metrics};
    return {status:'active',kind:a.kind,runId:a.runId,predicted:predictKulakan(a,rows,asOf),localMetrics:metrics,datasetDays:42,reason:'Model dilatih pada penjualan ritel publik, lalu lolos backtest lokal bahan ini. Belum merupakan jaminan akurasi masa depan.'};
  }catch{return {status:'incomplete_history',reason:'Butuh tanggal pemakaian berurutan sampai kemarin; tanggal kosong tidak dianggap nol oleh model.'};}
}
