import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
const password='FnbBrowserTesting2026!';
async function quietGuide(page){await page.evaluate(async()=>{const {emptyGuideProgress,guideKey}=await import('/guide-state.js'),{scopeOf}=await import('/offline.js'),s=await fetch('/api/bootstrap').then(r=>r.json());localStorage.setItem(guideKey(scopeOf(s)),JSON.stringify({...emptyGuideProgress(),welcomeSeen:true,autoPageGuides:false}));});await page.reload();}
async function owner(page){await page.goto('/');const r=await page.request.post('/api/auth/register',{data:{email:randomUUID()+'@example.test',password,businessName:'Kedai uji F&B',communityName:'Kelompok uji'}});expect(r.ok()).toBe(true);const state=await r.json();await quietGuide(page);return {state,post:async(path,body)=>{const r=await page.request.post('/api'+path,{data:{...body,csrf:state.csrf}});expect(r.ok()).toBe(true);return r.json();}};}
async function capture(page,name,width,theme='light'){
 if(!process.env.CAPTURE_REVIEW)return;
 await page.setViewportSize({width,height:1000});await expect(page.locator('#toast')).toBeHidden({timeout:10000});await page.evaluate(async theme=>{document.documentElement.dataset.theme=theme;document.activeElement?.blur();scrollTo(0,0);await document.fonts.ready;},theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await mkdir('.impeccable/review/fnb',{recursive:true});await page.screenshot({path:'.impeccable/review/fnb/'+name+'.png',fullPage:true});
}
test('cashier availability stays private, explains selected low menus and owner sees actors after handover',async({page,browser})=>{
 test.setTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const f=await owner(page);let revision=1;const menus=[];
 for(const [name,qty,min] of [['Menu hampir habis',3,3],['Menu tersedia',20,0],['Menu habis',0,0]]){
  const p=await f.post('/ingredients',{name:'Bahan rahasia '+name,unit:'butir',min,storageNote:'Hanya pemilik',catalogRevision:revision++});if(qty)await f.post('/stock-receipts',{productId:p.id,qty,unitPrice:1000,supplier:'Pemasok rahasia',idempotencyKey:randomUUID()});
  menus.push(await f.post('/menus',{name,price:15000,aliases:[],recipe:{[p.id]:1},catalogRevision:revision++,preparation:{minutes:3,passiveMinutes:0,station:'kompor'}}));
 }
 const users={};for(const role of ['cashier','kitchen']){const account={name:role==='cashier'?'Kasir pengujian':'Koki pengujian',email:randomUUID()+'@example.test',password,role,confirmed:true,idempotencyKey:randomUUID()};await f.post('/staff',account);users[role]=account;}
 const cc=await browser.newContext(),kc=await browser.newContext(),cashier=await cc.newPage(),kitchen=await kc.newPage();try{
  for(const [p,user] of [[cashier,users.cashier],[kitchen,users.kitchen]]){await p.goto('http://127.0.0.1:4175/api/staff/screen#dapur');const r=await p.request.post('http://127.0.0.1:4175/api/auth/login',{data:user});expect(r.ok()).toBe(true);await quietGuide(p);await expect(p.locator('.staff-shell')).toBeVisible();}
  await cashier.getByRole('button',{name:'Susun manual',exact:true}).click();const select=cashier.getByLabel('Menu item 1',{exact:true});await expect(select.locator('option').filter({hasText:'Menu habis'})).toHaveJSProperty('disabled',true);await expect(select.locator('option').filter({hasText:'Menu tersedia'})).toContainText('Tersedia');await select.focus();await select.selectOption(menus[0].id);
  await expect(cashier.locator('[data-menu-note="0"]')).toContainText('Konfirmasikan ketersediaan ke dapur');await expect(select).toBeFocused();
  const state=await cashier.request.get('http://127.0.0.1:4175/api/bootstrap');expect(JSON.stringify(await state.json())).not.toMatch(/portions|Pemasok rahasia|min_quantity/);expect(await cashier.locator('body').innerText()).not.toContain('porsi tersedia');
  await capture(cashier,'cashier-desktop',1440);await capture(cashier,'cashier-mobile-dark',390,'dark');
  await cashier.getByLabel('Label pesanan / meja').fill('Meja F&B');await cashier.getByRole('button',{name:'Masukkan ke antrean dapur',exact:true}).click();await expect(kitchen.locator('.kitchen-order')).toContainText('Meja F&B');await kitchen.getByRole('button',{name:'Mulai giliran ini',exact:true}).click();await kitchen.getByRole('button',{name:'Tandai siap',exact:true}).click();await expect(cashier.getByRole('button',{name:'Terima pembayaran & serahkan',exact:true})).toBeVisible();await cashier.getByRole('button',{name:'Terima pembayaran & serahkan',exact:true}).click();await cashier.getByRole('button',{name:'QRIS',exact:true}).click();await cashier.getByRole('button',{name:'Bayar & selesaikan',exact:true}).click();await expect(cashier.locator('#receipt-print')).toBeVisible();await cashier.getByRole('button',{name:'Selesai',exact:true}).click();
  await page.goto('/#riwayat');await page.getByRole('button',{name:'Perbarui data',exact:true}).click();await expect(page.locator('.audit-list')).toContainText('Kasir pengujian · Kasir');await expect(page.locator('.audit-list')).toContainText('Koki pengujian · Dapur');
  await capture(page,'activity-desktop',1440);await capture(page,'activity-mobile',390);expect(errors).toEqual([]);
 }finally{await cc.close();await kc.close();}
});
test('latest upstream auth and empty-state actions remain usable on desktop and narrow dark screen',async({page})=>{
 await page.goto('/');await capture(page,'auth-desktop',1440);await capture(page,'auth-mobile',320);await page.locator('[data-action=show-login]').click();await expect(page.getByRole('button',{name:'Masuk',exact:true})).toBeVisible();await page.locator('[data-action=show-register]').click();await owner(page);await page.goto('/#stok');
 await expect(page.getByRole('button',{name:'Tambah bahan pertama',exact:true})).toBeVisible();await capture(page,'empty-stock-desktop',1440);await capture(page,'empty-stock-mobile-dark',320,'dark');await page.getByRole('button',{name:'Tambah bahan pertama',exact:true}).click();await expect(page.getByLabel('Nama bahan',{exact:true})).toBeVisible();
});
