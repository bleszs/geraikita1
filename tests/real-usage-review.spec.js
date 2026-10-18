import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {createApp} from '../server/http.mjs';
import {createExtractor} from '../server/extractor.mjs';
import {addDays,dayAt,units} from '../server/common.mjs';

// This server and every ledger fixture exist only in this worker's memory.
let app,base;
test.beforeAll(async()=>{
  app=createApp({filename:':memory:',extractor:createExtractor({provider:'rules'}),transcriber:{status:async()=>({available:false,model:'whisper-tiny'})}});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;
});
test.afterEach(async({page})=>{if(!page.isClosed())await page.goto('about:blank');});
test.afterAll(async()=>{if(app){const closing=app.close();app.server.closeAllConnections();await closing;}});
async function setup(page,{history=false,gap=false}={}){
  const response=await page.request.post(base+'/api/auth/register',{data:{businessName:'Pemeriksaan terisolasi',communityName:'Kelompok uji browser',email:crypto.randomUUID()+'@example.test',password:'Browser-review-only-456'}});
  expect(response.status()).toBe(201);const owner=await response.json();
  const response2=await page.request.post(base+'/api/ingredients',{data:{name:'Tepung <img src=x onerror=alert(1)>',unit:'kg',min:0,storageNote:'',catalogRevision:1,csrf:owner.csrf}});
  expect(response2.status()).toBe(201);const ingredient=await response2.json();
  // Mutation endpoint returns the saved ingredient, not an invented bootstrap response.
  const id=ingredient.id;
  if(history)for(let i=0;i<84;i++){
    if(gap&&i===82)continue;
    app.store.run('INSERT INTO daily_usage VALUES(?,?,?,?,?)',owner.workspaceId,owner.business.id,id,addDays(dayAt(),i-84),units(i===83?60:i===82?0:10));
  }
  await page.goto(base+'/#restock');await expect(page.getByRole('heading',{name:'Periksa pemakaian bahan',exact:true})).toBeVisible();await page.locator('.usage-review>summary').click();
  return {owner,id};
}
const panel=page=>page.locator('.usage-review');
async function capture(page,name){
  if(!process.env.CAPTURE_REVIEW)return;
  await mkdir('.impeccable/review',{recursive:true});await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();scrollTo(0,0);});
  await page.screenshot({path:'.impeccable/review/'+name+'.png',fullPage:true,animations:'disabled'});
}

test('usage panel keeps an empty ledger unknown and escapes ingredient names',async({page})=>{
  await setup(page);
  await expect(panel(page)).toContainText('Belum ada histori');await expect(panel(page)).toContainText('Belum ada catatan pemakaian sebelum hari ini');
  await expect(panel(page).locator('img')).toHaveCount(0);await expect(panel(page).locator('.usage-review-detail')).toHaveCount(0);
  await expect(panel(page)).not.toContainText('Tidak ada tanda pada hari yang diperiksa');
  await page.setViewportSize({width:1440,height:1050});await capture(page,'usage-empty-desktop');
  await page.setViewportSize({width:320,height:950});await capture(page,'usage-empty-mobile');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('actual isolated ledger renders two review dates and eight earlier references, with keyboard disclosure',async({page})=>{
  const {id,owner}=await setup(page,{history:true});
  const before=app.store.get('SELECT COUNT(*) AS n,SUM(quantity) AS total FROM daily_usage WHERE workspace_id=? AND business_id=? AND product_id=?',owner.workspaceId,owner.business.id,id);
  await expect(panel(page)).toContainText('2 tanggal perlu ditinjau');
  const disclosure=panel(page).locator('.usage-review-detail>summary');
  await expect(panel(page).locator('.usage-review-detail')).not.toHaveAttribute('open','');
  await disclosure.focus();await page.keyboard.press('Enter');await expect(panel(page).locator('.usage-review-detail')).toHaveAttribute('open','');
  await expect(panel(page)).toContainText('Perlu ditinjau · lebih rendah');await expect(panel(page)).toContainText('Perlu ditinjau · lebih tinggi');
  const reference=panel(page).getByText('Delapan pembanding untuk '+addDays(dayAt(),-1),{exact:true});
  await reference.click();await expect(panel(page).locator('.usage-reference[open] li')).toHaveCount(8);
  await expect(panel(page)).toContainText('Pemakaian 60 kg; biasanya 10 kg');
  await page.setViewportSize({width:1440,height:1050});await capture(page,'usage-review-desktop');
  await page.setViewportSize({width:320,height:950});await capture(page,'usage-review-mobile');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await panel(page).locator('.usage-all-days>summary').click();
  await capture(page,'usage-review-mobile-all-dates');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await panel(page).locator('.usage-all-days>summary').click();
  await page.getByRole('button',{name:'Ubah tema'}).click();await capture(page,'usage-review-mobile-dark');
  await expect(panel(page).getByRole('link',{name:'Buka riwayat pencatatan'})).toHaveAttribute('href','#riwayat');
  expect(app.store.get('SELECT COUNT(*) AS n,SUM(quantity) AS total FROM daily_usage WHERE workspace_id=? AND business_id=? AND product_id=?',owner.workspaceId,owner.business.id,id)).toEqual(before);
});

test('stock-days column shows the estimated days left and daily rate for an ingredient with recorded usage',async({page})=>{
  const {id,owner}=await setup(page,{history:true});
  const receipt=await page.request.post(base+'/api/stock-receipts',{data:{productId:id,qty:40,unitPrice:1000,supplier:'',idempotencyKey:crypto.randomUUID(),csrf:owner.csrf}});
  expect(receipt.status()).toBe(201);
  await page.reload();
  const r=(await (await page.request.get(base+'/api/bootstrap')).json()).recommendations.find(x=>x.productId===id);
  expect(Number.isInteger(r.daysRemaining)).toBe(true);expect(r.dailyUsage).toBeGreaterThan(0);
  await page.locator('.restock-calculation>summary').click();
  await expect(page.locator('.restock-results .stock-days')).toContainText(r.daysRemaining+' hari');
  await expect(page.locator('.restock-results')).toContainText('kg/hari');
  if(r.daysRemaining<=2)await expect(page.locator('.restock-results .stock-days')).toHaveClass(/is-low/);
  await page.setViewportSize({width:1440,height:1050});await capture(page,'stock-days-desktop');
  await page.setViewportSize({width:320,height:950});await capture(page,'stock-days-mobile');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('a sustained usage level shift surfaces a pattern-change signal in the usage panel',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const {id,owner}=await setup(page);
  for(let i=0;i<42;i++)app.store.run('INSERT INTO daily_usage VALUES(?,?,?,?,?)',owner.workspaceId,owner.business.id,id,addDays(dayAt(),i-42),units(i<28?10:25));
  await page.reload();
  await panel(page).locator(':scope>summary').click();
  await expect(panel(page)).toContainText('menunjukkan perubahan pola pemakaian');
  await expect(panel(page).locator('.usage-drift')).toContainText('Pola pemakaian naik');
  await expect(panel(page).locator('.usage-review-item').getByText('Perubahan pola',{exact:true})).toBeVisible();
  const drift=(await (await page.request.get(base+'/api/bootstrap')).json()).recommendations.find(r=>r.productId===id).driftScreening;
  expect(drift.changed).toBe(true);expect(drift.direction).toBe('higher');
  await page.setViewportSize({width:320,height:950});await capture(page,'usage-drift-mobile');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('gaps remain unavailable and offline results are explicitly marked as stored',async({page,context})=>{
  await setup(page,{history:true,gap:true});
  await panel(page).locator('.usage-review-detail>summary').click();
  await panel(page).locator('.usage-all-days>summary').click();
  await expect(panel(page)).toContainText('Tanggal pembanding belum lengkap');await expect(panel(page)).toContainText('Tidak ada catatan');
  await context.setOffline(true);await expect(panel(page)).toContainText('Hasil dari data tersimpan');await expect(panel(page)).toContainText('hasil tersimpan');
  await context.setOffline(false);await page.getByRole('button',{name:'Hubungkan & muat ulang'}).click();
  await expect(panel(page)).not.toContainText('Hasil dari data tersimpan');
});

test('a legacy snapshot without screening never masquerades as a successful check',async({page})=>{
  await setup(page);
  await page.route('**/api/bootstrap',async route=>{
    const response=await route.fetch(),data=await response.json();
    for(const recommendation of data.recommendations)delete recommendation.usageScreening;
    await route.fulfill({response,json:data});
  });
  await page.getByRole('button',{name:'Perbarui data',exact:true}).click();
  await expect(panel(page)).toContainText('Pemeriksaan belum tersedia pada data ini');
  await expect(panel(page)).not.toContainText('Tidak ada tanda pada hari yang diperiksa');
  await page.unroute('**/api/bootstrap');await page.getByRole('button',{name:'Perbarui data',exact:true}).click();
  await expect(panel(page)).toContainText('Belum ada histori');
});
