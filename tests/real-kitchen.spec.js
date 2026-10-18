import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
async function setup(page){
 await page.goto('/');const state=await page.evaluate(async email=>{
  const post=async(path,body,csrf)=>{const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,...(csrf?{csrf}:{})})});const x=await r.json();if(!r.ok)throw Error(x.error);return x;};
  const s=await post('auth/register',{email,password:'KitchenTest2026!',businessName:'Usaha uji dapur',communityName:'Kelompok uji'}),csrf=s.csrf;
  const p=await post('ingredients',{name:'Tepung uji dapur',unit:'gram',min:0,storageNote:'',catalogRevision:1},csrf);
  await post('stock-receipts',{productId:p.id,qty:1000,unitPrice:1,supplier:'',idempotencyKey:crypto.randomUUID()},csrf);
  const m=await post('menus',{name:'Roti uji dapur',price:7000,aliases:[],recipe:{[p.id]:25},catalogRevision:2,preparation:{minutes:6,passiveMinutes:3,station:'pemanggang'}},csrf);
  return {csrf,menu:m.id,product:p.id};
 },'kitchen-'+randomUUID()+'@example.test');
 await page.reload();await expect(page.locator('#main h1')).toContainText('dapur');
 const skip=page.locator('.guide-welcome [data-guide-action="dismiss"]');if(await skip.count())await skip.click();return state;
}
test('multi-item kitchen order reserves, advances phases and synchronizes a second display',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const state=await setup(page),other=await context.newPage();await other.goto('/#layanan');
 await page.getByLabel('Label pesanan / meja').fill('Meja 2');await page.getByLabel('Menu item 1',{exact:true}).selectOption(state.menu);await page.getByLabel('Porsi item 1',{exact:true}).fill('2');
 await page.getByRole('button',{name:'Tambah item',exact:true}).click();await page.getByLabel('Menu item 2',{exact:true}).selectOption(state.menu);await page.getByRole('button',{name:'Masukkan ke antrean',exact:true}).click();
 await expect(page.locator('.kitchen-order')).toHaveCount(1);await expect(other.locator('.service-orders')).toContainText('Meja 2');
 let data=await page.evaluate(()=>fetch('/api/bootstrap').then(r=>r.json()));expect(data.stock[state.product]).toBe(1000);expect(data.availableStock[state.product]).toBe(925);expect(data.transactions).toHaveLength(0);
 await page.getByRole('button',{name:'Mulai giliran ini',exact:true}).click();await page.getByRole('button',{name:'Mulai tahap pasif',exact:true}).click();await page.getByRole('button',{name:'Mulai giliran ini',exact:true}).click();
 await page.getByRole('button',{name:'Tandai siap',exact:true}).first().click();await expect(page.getByRole('button',{name:'Tandai siap',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'Tandai siap',exact:true}).click();
 await expect(other.locator('.service-orders')).toContainText('Siap disajikan');await page.getByRole('button',{name:'Selesaikan & catat penjualan',exact:true}).click();await expect(page.locator('.kitchen-order')).toHaveCount(0);await expect(other.locator('.service-orders')).toHaveCount(0);
 data=await page.evaluate(()=>fetch('/api/bootstrap').then(r=>r.json()));expect(data.stock[state.product]).toBe(925);expect(data.transactions).toHaveLength(1);expect(data.transactions[0].total).toBe(21000);expect(errors).toEqual([]);await other.close();
});
test('typed voice-controller commands, responsive views and explicit cancellation',async({page})=>{
 const state=await setup(page);await page.getByLabel('Label pesanan / meja').fill('Meja 3');await page.getByLabel('Menu item 1',{exact:true}).selectOption(state.menu);await page.getByRole('button',{name:'Masukkan ke antrean',exact:true}).click();
 await page.getByLabel('Perintah teks',{exact:true}).fill('mulai roti uji dapur meja tiga');await page.getByRole('button',{name:'Jalankan perintah',exact:true}).click();await expect(page.locator('.kitchen-task .tag')).toHaveText('Dikerjakan');await expect(page.getByLabel('Perintah teks',{exact:true})).toBeFocused();
 await page.getByLabel('Perintah teks',{exact:true}).fill('jangan siap roti uji dapur meja tiga');await page.getByRole('button',{name:'Jalankan perintah',exact:true}).click();await expect(page.locator('[data-form="kitchen-command"] [role="alert"]')).toContainText('negasi');
 await expect(page.locator('#toast')).toBeHidden({timeout:10000});await mkdir('data/kitchen-captures',{recursive:true});for(const [name,width,theme]of[['desktop',1440,'light'],['mobile',390,'light'],['dark',1440,'dark']]){await page.setViewportSize({width,height:1000});await page.evaluate(async t=>{document.documentElement.dataset.theme=t;document.activeElement?.blur();scrollTo(0,0);await document.fonts.ready;},theme);await page.screenshot({path:`data/kitchen-captures/${name}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.getByRole('button',{name:'Tutup sebagai bahan terpakai',exact:true}).click();await expect(page.locator('[data-form="kitchen-discard"] [name="confirmed"]')).toBeFocused();await expect(page.getByText('Pesanan ditutup tanpa penjualan',{exact:false})).toBeVisible();await expect(page.locator('[data-form="kitchen-discard"] input[type="number"]')).toHaveValue('25');await page.getByRole('button',{name:'Kembali',exact:true}).click();await expect(page.locator('[data-form="kitchen-discard"]')).toHaveCount(0);await expect(page.locator('.kitchen-order h3')).toBeFocused();
  await page.goto('/#layanan');await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});await page.screenshot({path:'data/kitchen-captures/service.png',fullPage:true});
  await page.route('**/api/kitchen/events',route=>route.abort());await page.reload();await expect(page.locator('#kitchen-live-status')).toContainText('Pembaruan terputus');await expect(page.getByRole('button',{name:'Perbarui status',exact:true})).toBeVisible();await page.screenshot({path:'data/kitchen-captures/service-reconnecting.png',fullPage:true});
});
test('opt-in handsfree capture changes one stage and releases microphone on navigation without storing transcript',async({page})=>{
 await page.addInitScript(()=>{
  window.kitchenMic={requests:0,stops:0};
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{window.kitchenMic.requests++;return {getTracks:()=>[{stop(){window.kitchenMic.stops++;},addEventListener(){}}]};}});
  class Recorder{static isTypeSupported(){return true;}constructor(){this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['technical transport only'],{type:'audio/webm'})});this.onstop?.();}}
  window.MediaRecorder=Recorder;
 });
 await page.route('**/api/bootstrap',async route=>{const r=await route.fetch(),data=await r.json();await route.fulfill({json:{...data,speech:{available:true}}});});
 let transcriptionCalls=0;await page.route('**/api/transcriptions',async route=>{transcriptionCalls++;await route.fulfill({json:{text:'mulai roti uji dapur meja empat'}});});
 const state=await setup(page);await page.getByLabel('Label pesanan / meja').fill('Meja 4');await page.getByLabel('Menu item 1',{exact:true}).selectOption(state.menu);await page.getByRole('button',{name:'Masukkan ke antrean',exact:true}).click();await expect(page.locator('.kitchen-order')).toHaveCount(1);
 expect(await page.evaluate(()=>window.kitchenMic.requests)).toBe(0);
 await page.getByRole('button',{name:'Aktifkan kendali suara',exact:true}).click();await expect(page.locator('.kitchen-task .tag')).toHaveText('Dikerjakan',{timeout:12000});
 await page.getByRole('button',{name:'Hentikan kendali suara',exact:true}).click();expect(transcriptionCalls).toBe(1);expect(await page.evaluate(()=>window.kitchenMic.stops)).toBeGreaterThan(0);
 const stored=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('gerai-kita-device-v2');r.onsuccess=()=>{const db=r.result,q=db.transaction('snapshots').objectStore('snapshots').getAll();q.onsuccess=()=>{resolve(JSON.stringify(q.result));db.close();};};}));expect(stored).not.toContain('mulai roti uji dapur meja empat');
 await page.getByRole('button',{name:'Aktifkan kendali suara',exact:true}).click();await page.goto('/#stok');await expect(page.locator('#main h1')).toBeVisible();expect(await page.evaluate(()=>window.kitchenMic.stops)).toBeGreaterThan(1);
});
test('station capacity opens parallel turns, limits passive equipment and records partial item waste',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const state=await setup(page);
 await page.getByLabel('Staf aktif pemanggang',{exact:true}).fill('2');await page.getByLabel('Alat tahap pasif pemanggang',{exact:true}).fill('1');await page.getByRole('button',{name:'Simpan kapasitas pemanggang',exact:true}).click();
 await expect(page.getByLabel('Staf aktif pemanggang',{exact:true})).toHaveValue('2');
 await page.getByLabel('Label pesanan / meja').fill('Meja 7');await page.getByLabel('Menu item 1',{exact:true}).selectOption(state.menu);await page.getByLabel('Porsi item 1',{exact:true}).fill('2');
 await page.getByRole('button',{name:'Tambah item',exact:true}).click();await page.getByLabel('Menu item 2',{exact:true}).selectOption(state.menu);await page.getByRole('button',{name:'Masukkan ke antrean',exact:true}).click();
 await expect(page.getByRole('button',{name:'Mulai giliran ini',exact:true})).toHaveCount(2);
 await page.getByRole('button',{name:'Mulai giliran ini',exact:true}).first().click();await expect(page.getByRole('button',{name:'Mulai giliran ini',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'Mulai giliran ini',exact:true}).click();
 await page.getByRole('button',{name:'Mulai tahap pasif',exact:true}).first().click();await expect(page.getByRole('button',{name:'Mulai tahap pasif',exact:true})).toHaveCount(0);await expect(page.getByText('Alat tahap pasif penuh',{exact:false})).toBeVisible();
 const big=page.locator('.kitchen-task',{hasText:'2 Roti uji dapur'});await big.getByRole('button',{name:'Catat item terbuang',exact:true}).click();
 const form=page.locator('[data-form="kitchen-void"]');await expect(form.locator('input[type="number"]')).toBeFocused();await expect(form.locator('input[type="number"]')).toHaveValue('50');
 await form.locator('input[type="number"]').fill('20');await form.getByLabel('Saya sudah memeriksa bahan item ini').check();if(process.env.CAPTURE_REVIEW){await expect(page.locator('#toast')).toBeHidden({timeout:10000});await mkdir('data/kitchen-captures',{recursive:true});for(const [name,width]of[['capacity-waste-desktop',1440],['capacity-waste-mobile',390]]){await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{document.activeElement?.blur();scrollTo(0,0);await document.fonts.ready;});await page.screenshot({path:'data/kitchen-captures/'+name+'.png',fullPage:true});}}await form.getByRole('button',{name:'Catat terbuang & keluarkan item',exact:true}).click();
 await expect(page.locator('.kitchen-task.is-voided')).toContainText('Terbuang: 20 gram Tepung uji dapur');
 const data=await page.evaluate(()=>fetch('/api/bootstrap').then(r=>r.json()));expect(data.stock[state.product]).toBe(980);expect(data.availableStock[state.product]).toBe(955);expect(data.kitchen.orders[0].total).toBe(7000);expect(errors).toEqual([]);
});

test('station waiting limit persists and a conflicting second station preserves only its own edits',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const data=await setup(page);
 const first=page.locator('[data-form="kitchen-station"]').filter({has:page.locator('input[name="station"][value="pemanggang"]')});
 await expect(first.getByLabel('Batas tunggu pemanggang (menit)',{exact:true})).toHaveValue('15');
 await first.getByLabel('Batas tunggu pemanggang (menit)',{exact:true}).fill('5');
 await first.getByRole('button',{name:'Simpan kapasitas pemanggang',exact:true}).click();
 await expect.poll(async()=>{const s=await (await page.request.get('/api/bootstrap')).json();return s.kitchen.stations[0].agingMinutes;}).toBe(5);
 await page.reload();await expect(first.getByLabel('Batas tunggu pemanggang (menit)',{exact:true})).toHaveValue('5');
 const station='minuman hangat untuk pesanan pelanggan';let s=await (await page.request.get('/api/bootstrap')).json();
 const create=await page.request.post('/api/menus',{data:{csrf:s.csrf,name:'Minuman uji kedua',price:3000,aliases:[],recipe:{[data.product]:10},catalogRevision:s.catalogRevision,preparation:{minutes:2,passiveMinutes:0,station}}});expect(create.status()).toBe(201);
 await page.reload();
 const second=page.locator('[data-form="kitchen-station"]').filter({has:page.locator('input[name="station"][value="'+station+'"]')});
 const label='Batas tunggu '+station+' (menit)';await second.getByLabel(label,{exact:true}).fill('8');
 const outside=await page.request.post('/api/kitchen/stations',{data:{csrf:s.csrf,station,cooks:1,equipment:null,agingMinutes:30,revision:0}});expect(outside.status()).toBe(200);
 await second.getByRole('button',{name:'Simpan kapasitas '+station,exact:true}).click();
 await expect(second.locator('.form-error')).toContainText('berubah di perangkat lain');
 await expect(second.getByLabel(label,{exact:true})).toHaveValue('8');await expect(first.getByLabel('Batas tunggu pemanggang (menit)',{exact:true})).toHaveValue('5');
 await expect(first.locator('.form-error')).toBeEmpty();
 const capture=async(name,width,dark=false)=>{
  if(!process.env.CAPTURE_REVIEW)return;await mkdir('.impeccable/review',{recursive:true});await page.setViewportSize({width,height:1000});
  if(dark)await page.getByRole('button',{name:'Ubah tema',exact:true}).click();
  await page.evaluate(async()=>{document.activeElement?.blur();scrollTo(0,0);await document.fonts.ready;});await page.mouse.move(width-1,1);
  await page.screenshot({path:'.impeccable/review/'+name+'.png',fullPage:true,animations:'disabled'});
  await page.locator('.kitchen-capacity').screenshot({path:'.impeccable/review/'+name+'-panel.png',animations:'disabled'});
 };
 await capture('aging-conflict-desktop',1440);await capture('aging-conflict-mobile-dark',320,true);
 await second.getByRole('button',{name:'Muat pengaturan terbaru '+station,exact:true}).click();
 await expect(second.getByLabel(label,{exact:true})).toHaveValue('30');await expect(second.getByLabel(label,{exact:true})).toBeFocused();
 await expect(second.locator('.form-error')).toBeEmpty();expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await capture('aging-saved-mobile-dark',320);await page.getByRole('button',{name:'Ubah tema',exact:true}).click();await capture('aging-saved-desktop',1440);
 s=await (await page.request.get('/api/bootstrap')).json();expect(s.transactions).toEqual([]);expect(s.stock[data.product]).toBe(1000);
});
