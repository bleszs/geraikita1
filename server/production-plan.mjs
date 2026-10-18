import {requireValue,quantity,units} from './common.mjs';

// Preview only: no reservations, sales, training records, or purchase orders.
export function productionPlan(store,s,body,available){
  const revision=store.get('SELECT catalog_revision FROM business_state WHERE workspace_id=? AND business_id=?',s.workspace_id,s.business_id).catalog_revision;
  requireValue(body.catalogRevision===revision,'Resep atau menu berubah. Perbarui data lalu periksa target porsi.',409);
  requireValue(Array.isArray(body.items)&&body.items.length>0&&body.items.length<=100,'Pilih minimal satu menu dan maksimal 100 menu.');
  const menu=store.menus(s),catalog=store.ingredients(s),seen=new Set(),needed=new Map();
  const items=body.items.map(i=>{
    requireValue(i&&typeof i.id==='string'&&!seen.has(i.id)&&Number.isInteger(i.qty)&&i.qty>=1&&i.qty<=1000,'Target harus unik dan berupa 1–1.000 porsi per menu.');seen.add(i.id);
    const m=menu.find(m=>m.id===i.id);requireValue(m,'Menu tidak ditemukan pada usaha ini.');
    for(const [id,q] of Object.entries(m.recipe))needed.set(id,(needed.get(id)||0)+units(q)*i.qty);
    return {id:m.id,name:m.name,qty:i.qty};
  });
  const ingredients=catalog.filter(c=>needed.has(c.id)).map(c=>{
    const stock=available(s,c.id),required=needed.get(c.id),precision=['butir','buah'].includes(c.unit)?1:100;
    const shortage=Math.max(0,quantity(required-stock));
    return {productId:c.id,name:c.name,unit:c.unit,required:quantity(required),available:quantity(stock),buy:Math.max(0,Math.ceil((shortage-1e-10)*precision)/precision)};
  });
  return {kind:'production_target_calculation',catalogRevision:revision,items,ingredients,calculatedAt:new Date().toISOString(),note:'Perhitungan target porsi dari resep; bukan prediksi AI dan tidak mengubah stok.'};
}
