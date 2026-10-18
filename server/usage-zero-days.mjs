import {randomUUID} from 'node:crypto';
import {requireValue,dayAt,addDays} from './common.mjs';
import {validDate} from './ml/forecast-model.mjs';

export function createUsageZeroDays(store){
 const scope=s=>[s.workspace_id,s.business_id];
 const find=(s,product,date)=>store.get('SELECT * FROM usage_zero_confirmations WHERE workspace_id=? AND business_id=? AND product_id=? AND date=?',...scope(s),product,date);
 function validate(s,b){
  requireValue(b.confirmed===true,'Konfirmasikan bahwa catatan tanggal ini sudah diperiksa.');
  requireValue(validDate(b.date)&&b.date>=addDays(dayAt(),-365)&&b.date<dayAt(),'Pilih tanggal yang sudah selesai dalam 365 hari terakhir.');
  requireValue(typeof b.productId==='string'&&store.ingredients(s).some(p=>p.id===b.productId),'Bahan tidak ditemukan pada usaha ini.');
  requireValue(b.catalogRevision===store.get('SELECT catalog_revision FROM business_state WHERE workspace_id=? AND business_id=?',...scope(s)).catalog_revision,'Katalog berubah. Perbarui data lalu periksa bahan kembali.',409);
 }
 function save(s,b){return store.atomic(()=>{
  validate(s,b);
  const usage=store.get('SELECT quantity FROM daily_usage WHERE workspace_id=? AND business_id=? AND product_id=? AND date=?',...scope(s),b.productId,b.date);
  requireValue(!usage||usage.quantity===0,'Tanggal ini sudah memiliki pemakaian. Koreksi catatan asal; jumlah tidak dapat diganti menjadi nol.',409);
  const previous=find(s,b.productId,b.date);if(previous)return {saved:true,duplicate:true,id:previous.id};
  const id=randomUUID(),created=new Date().toISOString();
  if(!usage)store.run('INSERT INTO daily_usage VALUES(?,?,?,?,0)',...scope(s),b.productId,b.date);
  store.run('INSERT INTO usage_zero_confirmations VALUES(?,?,?,?,?,?,?,?)',id,...scope(s),b.productId,b.date,s.account_id,created,usage?0:1);
  const ingredient=store.ingredients(s).find(p=>p.id===b.productId);
  store.log(...scope(s),`Pemilik mengonfirmasi ${ingredient.name} tanpa pemakaian pada ${b.date}. Stok dan transaksi tidak berubah.`);
  return {saved:true,duplicate:false,id};
 });}
 function retract(s,b){return store.atomic(()=>{
  validate(s,b);requireValue(typeof b.id==='string','Pilih konfirmasi yang hendak dibatalkan.');
  const previous=find(s,b.productId,b.date);
  if(!previous)return {saved:true,duplicate:true};
  requireValue(previous.id===b.id,'Konfirmasi berubah di sesi lain. Perbarui data dahulu.',409);
  const usage=store.get('SELECT quantity FROM daily_usage WHERE workspace_id=? AND business_id=? AND product_id=? AND date=?',...scope(s),b.productId,b.date);
  requireValue(!usage||usage.quantity===0,'Pemakaian sudah berubah. Periksa catatan asal sebelum membatalkan konfirmasi.',409);
  if(previous.created_usage)store.run('DELETE FROM daily_usage WHERE workspace_id=? AND business_id=? AND product_id=? AND date=? AND quantity=0',...scope(s),b.productId,b.date);
  store.run('DELETE FROM usage_zero_confirmations WHERE id=? AND workspace_id=? AND business_id=?',b.id,...scope(s));
  store.log(...scope(s),`Konfirmasi tanpa pemakaian ${b.date} dibatalkan. Catatan nol asal transaksi tetap dipertahankan.`);
  return {saved:true,duplicate:false};
 });}
 const list=s=>store.all('SELECT id,product_id AS productId,date,created_at AS createdAt FROM usage_zero_confirmations WHERE workspace_id=? AND business_id=? AND date>=? ORDER BY created_at DESC,rowid DESC LIMIT 20',...scope(s),addDays(dayAt(),-365));
 return {save,retract,list};
}
