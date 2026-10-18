const DATABASE = 'gerai-kita-device-v2';
let opening;
const storageError = () => new Error('Penyimpanan perangkat tidak tersedia. Izinkan penyimpanan situs, lalu coba lagi.');
function database() {
  if (!opening) {
    const pending = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('snapshots');
      request.result.createObjectStore('drafts', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const db=request.result;
      const invalidate=()=>{if(opening===pending)opening=undefined;};
      db.onclose=invalidate;
      db.onversionchange=()=>{invalidate();db.close();};
      resolve(db);
    };
    request.onerror = () => reject(storageError());
    });
    opening=pending;
    pending.catch(()=>{if(opening===pending)opening=undefined;});
  }
  return opening;
}
async function transaction(name, mode, work) {
  let tx;
  // Retry only when no transaction has started, never after an uncertain write.
  for(let attempt=0;attempt<2;attempt++){
    let db;
    try{db=await database();tx=db.transaction(name,mode);break;}
    catch(error){
      if(error.name!=='InvalidStateError'||attempt===1)throw storageError();
      opening=undefined;db?.close();
    }
  }
  return new Promise((resolve, reject) => {
    let result; let failure;
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(failure || new Error('Catatan belum tersimpan di perangkat. Periksa ruang penyimpanan lalu coba lagi.'));
    try{work(tx.objectStore(name), value => { result = value; }, error => { failure = error; tx.abort(); });}
    catch{failure=storageError();tx.abort();}
  });
}
export const scopeOf = data => `${data.workspaceId}:${data.workspaceEpoch}:${data.business.id}`+(data.account?.role&&data.account.role!=='owner'?`:${data.account.id}:${data.account.role}:${data.account.roleRevision}`:'');
export const readSnapshot = () => {
  try{if(localStorage.getItem('gerai-kita-signed-out')==='1')return Promise.resolve(undefined);}catch{}
  return transaction('snapshots', 'readonly', (store, done) => { store.get('latest').onsuccess = e => done(e.target.result); });
};
export const saveSnapshot = async data => {
  await transaction('snapshots', 'readwrite', store => { store.put({ data, savedAt: new Date().toISOString() }, 'latest'); });
  try{localStorage.removeItem('gerai-kita-signed-out');}catch{}
};
export const clearSnapshot = () => {
  try{localStorage.setItem('gerai-kita-signed-out','1');}catch{}
  return transaction('snapshots','readwrite',store=>{store.delete('latest');});
};
export const readAction = scope => transaction('snapshots','readonly',(store,done)=>{store.get('action:'+scope).onsuccess=e=>done(e.target.result);});
export const saveAction = (scope,action) => transaction('snapshots','readwrite',(store,done,fail)=>{
  store.get('action:'+scope).onsuccess=e=>{
    const old=e.target.result;
    if(action.scope!==scope || (old && (old.path!==action.path || JSON.stringify(old.payload)!==JSON.stringify(action.payload))))return fail(new Error('Selesaikan pemeriksaan catatan sebelumnya sebelum mengganti rincian.'));
    try{store.put(action,'action:'+scope);done(action);}catch(err){fail(err);}
  };
});
export const clearAction = scope => transaction('snapshots','readwrite',store=>{store.delete('action:'+scope);});
export const readReceiptDraft = key => transaction('snapshots','readonly',(store,done)=>{store.get('receipt:'+key).onsuccess=e=>done(e.target.result);});
export const saveReceiptDraft = (key,data) => transaction('snapshots','readwrite',store=>{store.put(data,'receipt:'+key);});
export const clearReceiptDraft = key => transaction('snapshots','readwrite',store=>{store.delete('receipt:'+key);});
export const readOfferDraft = key => transaction('snapshots','readonly',(store,done)=>{store.get('offer:'+key).onsuccess=e=>done(e.target.result);});
export const saveOfferDraft = (key,data) => transaction('snapshots','readwrite',store=>{store.put(data,'offer:'+key);});
export const clearOfferDraft = key => transaction('snapshots','readwrite',store=>{store.delete('offer:'+key);});
export const readReceiptCancellation = key => transaction('snapshots','readonly',(store,done)=>{store.get('receipt-cancel:'+key).onsuccess=e=>done(e.target.result);});
export const saveReceiptCancellation = (key,data) => transaction('snapshots','readwrite',store=>{store.put(data,'receipt-cancel:'+key);});
export const clearReceiptCancellation = key => transaction('snapshots','readwrite',store=>{store.delete('receipt-cancel:'+key);});
export const readStockReceiptDraft = key => transaction('snapshots','readonly',(store,done)=>{store.get('stock-receipt:'+key).onsuccess=e=>done(e.target.result);});
export const saveStockReceiptDraft = (key,data) => transaction('snapshots','readwrite',(store,done,fail)=>{
  store.get('stock-receipt:'+key).onsuccess=e=>{
    const old=e.target.result;
    if(data.key!==key || (old && JSON.stringify(old.payload)!==JSON.stringify(data.payload))) return fail(new Error('Status barang masuk belum pasti. Periksa catatan asli sebelum mengganti rincian.'));
    try{store.put(data,'stock-receipt:'+key);done(data);}catch(error){fail(error);}
  };
});
export const clearStockReceiptDraft = key => transaction('snapshots','readwrite',store=>{store.delete('stock-receipt:'+key);});
export const readStockCancellation = key => transaction('snapshots','readonly',(store,done)=>{store.get('stock-cancel:'+key).onsuccess=e=>done(e.target.result);});
export const saveStockCancellation = (key,data) => transaction('snapshots','readwrite',(store,done,fail)=>{
  store.get('stock-cancel:'+key).onsuccess=e=>{
    const old=e.target.result;
    if(data.key!==key || (old && (old.receiptId!==data.receiptId || old.reason!==data.reason)))return fail(new Error('Pembatalan belum pasti. Periksa catatan dan alasan asal sebelum menggantinya.'));
    try{store.put(data,'stock-cancel:'+key);done(data);}catch(error){fail(error);}
  };
});
export const clearStockCancellation = key => transaction('snapshots','readwrite',store=>{store.delete('stock-cancel:'+key);});
export const listDrafts = () => transaction('drafts', 'readonly', (store, done) => { store.getAll().onsuccess = e => done(e.target.result.sort((a,b) => a.createdAt.localeCompare(b.createdAt))); });
export const putDraft = draft => transaction('drafts', 'readwrite', (store, done, fail) => {
  store.getAll().onsuccess = event => {
    const all = event.target.result; const old = all.find(d => d.id === draft.id);
    if (!old && all.length >= 50) return fail(new Error('Maksimal 50 catatan tertunda di perangkat. Selesaikan atau hapus draft yang tidak diperlukan.'));
    if (old && (old.scope !== draft.scope || (old.status !== 'draft' && JSON.stringify(old.payload) !== JSON.stringify(draft.payload)))) return fail(new Error('Status pengiriman belum pasti. Kirim ulang rincian asli dengan kunci yang sama.'));
    store.put(draft); done(draft);
  };
});
export const removeDraft = (id, confirmed = false) => transaction('drafts', 'readwrite', (store, done, fail) => {
  store.get(id).onsuccess = event => {
    if (event.target.result?.status !== 'draft' && event.target.result && !confirmed) return fail(new Error('Periksa status pengiriman sebelum menghapus catatan ini.'));
    store.delete(id); done(true);
  };
});
export function validateDraft(items, menus) {
  if (!items?.length || items.length > 20 || items.some(i => !menus.some(m => m.id === i.id) || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 99 || typeof i.note !== 'string' || i.note.length > 500)) throw new Error('Periksa menu, jumlah 1–99 porsi dan catatan maksimal 500 karakter.');
}
export async function registerPwa(onChange) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const announce = () => { if (registration.waiting && navigator.serviceWorker.controller) onChange(registration); };
    announce(); registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', announce));
  } catch { /* The app still works online when installation is unavailable. */ }
}
