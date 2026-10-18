import {test,expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
import {createApp} from '../server/http.mjs';
import {createExtractor} from '../server/extractor.mjs';
import {addDays,dayAt,units} from '../server/common.mjs';
import {evaluateLocalKulakan} from '../server/ml/kulakan-model.mjs';
let app,base;
test.beforeAll(async()=>{app=createApp({filename:':memory:',extractor:createExtractor({provider:'rules'}),transcriber:{status:async()=>({available:false})}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;});
test.afterAll(async()=>{const closing=app.close();app.server.closeAllConnections();await closing;});
test.afterEach(async({page})=>{await page.goto('about:blank');});
async function owner(page){
  const response=await page.request.post(base+'/api/auth/register',{data:{businessName:'Kedai uji alur',email:crypto.randomUUID()+'@example.test',password:'Hci-test-password'}});expect(response.status()).toBe(201);const state=await response.json();
  const post=async(path,data)=>{const r=await page.request.post(base+'/api'+path,{data:{...data,csrf:state.csrf}});expect(r.ok()).toBe(true);return r.json();};return {state,post};
}
async function capture(page,name,width,theme='light'){
  await page.setViewportSize({width,height:1000});await page.evaluate(async theme=>{document.documentElement.dataset.theme=theme;document.activeElement?.blur();document.querySelector('#toast').hidden=true;scrollTo(0,0);await document.fonts.ready;},theme);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(process.env.CAPTURE_HCI_REVIEW){await mkdir('.impeccable/review/hci-v56',{recursive:true});await page.screenshot({path:'.impeccable/review/hci-v56/'+name+'.png',fullPage:true,animations:'disabled'});}
}

test('cashier and kitchen prioritize work, preserve input and filters during updates, and keep payment accessible',async({page,browser})=>{
  test.setTimeout(90000);const f=await owner(page),p=await f.post('/ingredients',{name:'Bahan privat',unit:'gram',min:0,storageNote:'',catalogRevision:1});
  await f.post('/stock-receipts',{productId:p.id,qty:1000,unitPrice:10,supplier:'',idempotencyKey:crypto.randomUUID()});
  const menu=await f.post('/menus',{name:'Nasi uji alur',price:15000,aliases:[],recipe:{[p.id]:10},catalogRevision:2,preparation:{minutes:5,passiveMinutes:2,station:'Kompor'}});
  const users={};for(const role of ['cashier','kitchen']){users[role]={email:crypto.randomUUID()+'@example.test',password:'Hci-staff-password',name:role==='cashier'?'Kasir uji':'Dapur uji',role,confirmed:true,idempotencyKey:crypto.randomUUID()};await f.post('/staff',users[role]);}
  const order=async label=>{const saved=await f.post('/kitchen/orders',{label,channel:'dine_in',items:[{id:menu.id,qty:1,note:'Tanpa sambal'}],catalogRevision:3,idempotencyKey:crypto.randomUUID()});const data=await page.request.get(base+'/api/bootstrap').then(r=>r.json());return data.kitchen.orders.find(o=>o.id===saved.id);};
  const ready=await order('Meja siap');await f.post('/kitchen/orders/'+ready.id+'/actions',{action:'start',taskId:ready.tasks[0].id,revision:1,idempotencyKey:crypto.randomUUID()});await f.post('/kitchen/orders/'+ready.id+'/actions',{action:'ready',taskId:ready.tasks[0].id,revision:2,idempotencyKey:crypto.randomUUID()});
  const cooking=await order('Meja dimasak');await f.post('/kitchen/orders/'+cooking.id+'/actions',{action:'start',taskId:cooking.tasks[0].id,revision:1,idempotencyKey:crypto.randomUUID()});await order('Meja menunggu');
  const cc=await browser.newContext({baseURL:base}),kc=await browser.newContext({baseURL:base}),cashier=await cc.newPage(),kitchen=await kc.newPage();
  try{
    for(const [client,user] of [[cashier,users.cashier],[kitchen,users.kitchen]]){expect((await client.request.post('/api/auth/login',{data:user})).status()).toBe(200);await client.goto('/api/staff/screen#dapur');await expect(client.locator('.staff-shell')).toBeVisible();}
    await expect(cashier.locator('.kitchen-order').first()).toContainText('Meja siap');
    await expect(cashier.locator('.staff-finance')).not.toHaveAttribute('open','');
    expect(await cashier.locator('.staff-intake').evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('.staff-finance'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    await cashier.getByLabel('Pesanan pelanggan').fill('Teks pesanan belum dikirim');
    const filter=cashier.locator('[data-filter="ready"]');await filter.focus();await cashier.keyboard.press('Enter');await expect(filter).toHaveAttribute('aria-pressed','true');await expect(cashier.locator('.kitchen-order')).toHaveCount(1);
    await order('Meja baru');await expect(cashier.locator('[data-filter="all"]')).toContainText('4');await expect(filter).toBeFocused();await expect(cashier.getByLabel('Pesanan pelanggan')).toHaveValue('Teks pesanan belum dikirim');
    await cashier.locator('.staff-finance>summary').click();await cashier.getByRole('button',{name:'Perbarui data',exact:true}).click();await expect(cashier.locator('.staff-finance')).toHaveAttribute('open','');await cashier.locator('.staff-finance>summary').click();
    await cashier.locator('[data-filter="all"]').click();await capture(cashier,'cashier-desktop',1440);await capture(cashier,'cashier-mobile',360);await capture(cashier,'cashier-mobile-dark',360,'dark');
    await cashier.getByRole('button',{name:'Pesanan baru',exact:true}).click();await expect(cashier.getByLabel('Pesanan pelanggan')).toBeFocused();await expect(cashier.getByLabel('Pesanan pelanggan')).toBeInViewport();
    await cashier.getByRole('button',{name:'Kembali ke antrean',exact:true}).click();await expect(cashier.locator('#kitchen-queue-title')).toBeFocused();
    const payment=cashier.getByRole('button',{name:'Terima pembayaran & serahkan',exact:true});await payment.click();for(const method of ['Tunai','QRIS','Transfer Bank','E-Wallet'])await expect(cashier.locator('.pay-card').getByRole('button',{name:method,exact:true})).toBeVisible();await capture(cashier,'cashier-payment-mobile',360,'dark');
    await cashier.getByRole('button',{name:'Batal',exact:true}).focus();await cashier.keyboard.press('Tab');await expect(cashier.locator('.pay-card').getByRole('button',{name:'Tutup',exact:true})).toBeFocused();await cashier.keyboard.press('Shift+Tab');await expect(cashier.getByRole('button',{name:'Batal',exact:true})).toBeFocused();await cashier.keyboard.press('Escape');await expect(payment).toBeFocused();
    await expect(kitchen.locator('body')).not.toContainText('Bahan privat');await expect(kitchen.locator('.staff-finance')).toHaveCount(0);
    const preparing=kitchen.locator('[data-filter="preparing"]');await preparing.click();await expect(kitchen.locator('.kitchen-order')).toHaveCount(1);
    expect((await kitchen.getByRole('button',{name:'Tandai siap',exact:true}).boundingBox()).height).toBeGreaterThanOrEqual(48);
    await capture(kitchen,'kitchen-desktop',1440);await capture(kitchen,'kitchen-mobile-dark',360,'dark');
    await kitchen.getByRole('button',{name:'Mulai tahap pasif',exact:true}).click();await expect(kitchen.getByRole('button',{name:'Lanjutkan pengerjaan',exact:true})).toBeVisible();await kitchen.getByRole('button',{name:'Tandai siap',exact:true}).click();await expect(kitchen.locator('.kitchen-order')).toHaveCount(0);
    await expect(cashier.locator('[data-filter="ready"]')).toContainText('2');const data=await page.request.get(base+'/api/bootstrap').then(r=>r.json());expect(data.transactions).toHaveLength(0);
  }finally{await Promise.all([cashier.goto('about:blank'),kitchen.goto('about:blank')]);await cc.close();await kc.close();}
});

test('restock shows computed AI purchase advice, baseline and unknown states with evidence folded and refresh read-only',async({page})=>{
  const f=await owner(page),publicData=JSON.parse(await readFile(new URL('./fixtures/kulakan-public-history.json',import.meta.url),'utf8')),asOf=dayAt();
  // Public quantities and shifted dates here are isolated UI fixtures, never account production data.
  const histories=publicData.series.map(s=>s.history.map((r,i)=>({date:addDays(asOf,i-42),qty:r.qty*10})));
  const history=histories.find(h=>evaluateLocalKulakan(h,asOf).status==='active');expect(history).toBeTruthy();
  const ingredients=[];for(const [i,name] of ['Bahan dengan model','Bahan dengan estimasi','Bahan belum tercatat'].entries())ingredients.push(await f.post('/ingredients',{name,unit:'kg',min:0,storageNote:'',catalogRevision:i+1}));
  for(const r of history)app.store.run('INSERT INTO daily_usage VALUES(?,?,?,?,?)',f.state.workspaceId,f.state.business.id,ingredients[0].id,r.date,units(r.qty));
  for(let i=0;i<42;i++)app.store.run('INSERT INTO daily_usage VALUES(?,?,?,?,?)',f.state.workspaceId,f.state.business.id,ingredients[1].id,addDays(asOf,i-42),units(10));
  for(const p of ingredients)await f.post('/stock-receipts',{productId:p.id,qty:1,unitPrice:1000,supplier:'',idempotencyKey:crypto.randomUUID()});
  const before=await page.request.get(base+'/api/bootstrap').then(r=>r.json());await page.goto(base+'/#restock');
  const ai=page.locator('[data-restock-product="'+ingredients[0].id+'"]'),r=before.recommendations.find(r=>r.productId===ingredients[0].id);
  expect(r.method).toBe('kulakan_sales_hgb');await expect(ai).toContainText('Prediksi AI');await expect(ai.locator('.restock-decision strong')).toHaveText(new Intl.NumberFormat('id-ID',{maximumFractionDigits:4}).format(r.amount)+' kg');
  await expect(page.locator('[data-restock-product="'+ingredients[1].id+'"]')).toContainText('Estimasi histori');await expect(page.locator('[data-restock-product="'+ingredients[2].id+'"]')).toContainText('Belum ada prediksi');
  await expect(page.locator('.kulakan-model')).not.toHaveAttribute('open','');await expect(page.locator('.usage-review')).not.toHaveAttribute('open','');expect(await page.locator('#main').innerText()).not.toContain('19.000 target');
  await capture(page,'restock-desktop',1440);await capture(page,'restock-mobile',360);await capture(page,'restock-mobile-dark',360,'dark');
  await ai.locator('summary').click();await expect(ai).toContainText('stok tersedia');await page.getByRole('button',{name:'Perbarui prediksi',exact:true}).click();
  const after=await page.request.get(base+'/api/bootstrap').then(r=>r.json());expect(after.recommendations.map(r=>[r.method,r.predicted,r.amount])).toEqual(before.recommendations.map(r=>[r.method,r.predicted,r.amount]));expect(after.stock).toEqual(before.stock);expect(after.transactions).toEqual(before.transactions);
});
