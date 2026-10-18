import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {createApp} from '../server/http.mjs';
import {createExtractor} from '../server/extractor.mjs';
import {addDays,dayAt} from '../server/common.mjs';
let app,base;
test.beforeAll(async()=>{app=createApp({filename:':memory:',extractor:createExtractor({provider:'rules'}),transcriber:{status:async()=>({available:false})}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;});
test.afterAll(async()=>{const closing=app.close();app.server.closeAllConnections();await closing;});
test.afterEach(async({page})=>{await page.goto('about:blank');});
test('owner confirms an actual zero, refreshes, and retracts it without changing stock or transactions',async({page})=>{
 const reg=await page.request.post(base+'/api/auth/register',{data:{businessName:'Uji tanggal terkonfirmasi',email:crypto.randomUUID()+'@example.test',password:'Zero-browser-password'}}),s=await reg.json();expect(reg.status()).toBe(201);
 const p=await page.request.post(base+'/api/ingredients',{data:{name:'Beras',unit:'kg',min:0,storageNote:'',catalogRevision:1,csrf:s.csrf}}).then(r=>r.json());
 const snapshot=()=>page.request.get(base+'/api/bootstrap').then(r=>r.json());const before=await snapshot();await page.goto(base+'/#restock');
 const panel=page.locator('.usage-zero-panel'),form=panel.locator('[data-form="usage-zero"]');await expect(panel).not.toHaveAttribute('open','');await panel.locator('summary').focus();await page.keyboard.press('Enter');
 await form.getByLabel('Bahan',{exact:true}).selectOption(p.id);await expect(form.getByLabel('Tanggal tanpa pemakaian')).toHaveAttribute('max',addDays(dayAt(),-1));await form.locator('[name=confirmed]').check();await form.getByRole('button',{name:'Simpan pemakaian nol'}).click();await expect(panel.locator('.usage-zero-list li')).toHaveCount(1);await expect(form.locator('[name=confirmed]')).not.toBeChecked();
 const after=await snapshot();expect(after.recommendations[0].historyQuality.explicitZeroDates).toBe(1);expect(after.recommendations[0].predicted).toBeNull();expect(after.stock).toEqual(before.stock);expect(after.transactions).toEqual(before.transactions);await expect(form.getByRole('button',{name:'Simpan pemakaian nol'})).toBeEnabled();
 for(const [width,theme] of [[1440,'light'],[360,'light'],[360,'dark']]){await page.setViewportSize({width,height:900});await panel.scrollIntoViewIfNeeded();await page.evaluate(async theme=>{document.activeElement?.blur();document.documentElement.dataset.theme=theme;await document.fonts.ready;},theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(process.env.CAPTURE_ZERO_REVIEW){await mkdir('.impeccable/review/zero-v58',{recursive:true});await panel.screenshot({path:`.impeccable/review/zero-v58/zero-${width}-${theme}.png`,style:'#toast,.quick-nav{visibility:hidden!important}'});}}
 await page.getByRole('button',{name:'Perbarui prediksi',exact:true}).click();await expect(panel).toHaveAttribute('open','');await expect(form.getByLabel('Bahan',{exact:true})).toHaveValue(p.id);
 await panel.getByRole('button',{name:/Batalkan konfirmasi Beras/}).click();await expect(panel.locator('.usage-zero-list')).toHaveCount(0);expect((await snapshot()).recommendations[0].historyQuality.explicitZeroDates).toBe(0);
 // A stale catalog is a recoverable error; it never creates the requested zero.
 await page.request.post(base+'/api/ingredients',{data:{name:'Telur',unit:'butir',min:0,storageNote:'',catalogRevision:2,csrf:s.csrf}});await form.locator('[name=confirmed]').check();await form.getByRole('button',{name:'Simpan pemakaian nol'}).click();await expect(form.locator('.form-error')).toContainText('Katalog berubah');expect((await snapshot()).usageZeroDays).toEqual([]);
});
