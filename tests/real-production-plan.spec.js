import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {createApp} from '../server/http.mjs';
import {createExtractor} from '../server/extractor.mjs';
let app,base;
test.beforeAll(async()=>{app=createApp({filename:':memory:',extractor:createExtractor({provider:'rules'}),transcriber:{status:async()=>({available:false})}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;});
test.afterAll(async()=>{const closing=app.close();app.server.closeAllConnections();await closing;});
test.afterEach(async({page})=>{await page.goto('about:blank');});
test('new business plans actual portions without creating sales or changing stock, invalidates edited results',async({page})=>{
 const reg=await page.request.post(base+'/api/auth/register',{data:{businessName:'Kedai uji target',email:crypto.randomUUID()+'@example.test',password:'Production-test-password'}}),s=await reg.json();expect(reg.status()).toBe(201);
 const post=async(path,data)=>{const r=await page.request.post(base+'/api'+path,{data:{...data,csrf:s.csrf}});expect(r.ok()).toBe(true);return r.json();};
 const rice=await post('/ingredients',{name:'Beras',unit:'kg',min:0,storageNote:'',catalogRevision:1});
 const menu=await post('/menus',{name:'Nasi telur',price:12000,aliases:[],recipe:{[rice.id]:.1},catalogRevision:2});
 await post('/stock-receipts',{productId:rice.id,qty:1.2,unitPrice:10000,supplier:'',idempotencyKey:crypto.randomUUID()});
 const before=await page.request.get(base+'/api/bootstrap').then(r=>r.json());await page.goto(base+'/#restock');
 const planner=page.locator('.production-planner');await expect(planner).not.toHaveAttribute('open','');await planner.locator('summary').focus();await page.keyboard.press('Enter');
 await planner.locator('[name="target-'+menu.id+'"]').fill('15');await planner.getByRole('button',{name:'Hitung kebutuhan belanja'}).click();
 await expect(planner.locator('.production-result')).toContainText('Beli 0,3 kg');await expect(planner).toContainText('bukan prediksi AI');
 for(const [width,theme] of [[1440,'light'],[360,'light'],[360,'dark']]){await page.setViewportSize({width,height:1000});await page.evaluate(async theme=>{document.documentElement.dataset.theme=theme;await document.fonts.ready;},theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(process.env.CAPTURE_AI_REVIEW){await mkdir('.impeccable/review/ai-v57',{recursive:true});await page.screenshot({path:`.impeccable/review/ai-v57/production-${width}-${theme}.png`,fullPage:true});}}
 await planner.locator('[name="target-'+menu.id+'"]').fill('5');await expect(planner.locator('.production-result')).toHaveCount(0);await planner.getByRole('button',{name:'Hitung kebutuhan belanja'}).click();await expect(planner.locator('.production-result')).toContainText('Stok cukup');
 const after=await page.request.get(base+'/api/bootstrap').then(r=>r.json());expect(after.stock).toEqual(before.stock);expect(after.transactions).toEqual(before.transactions);expect(after.recommendations).toEqual(before.recommendations);
 await page.getByRole('button',{name:'Perbarui prediksi',exact:true}).click();await expect(planner.locator('.production-result')).toHaveCount(0);await expect(planner.locator('input')).toHaveValue('5');
});
