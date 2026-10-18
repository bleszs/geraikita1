import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
test.afterEach(async({page})=>{if(!page.isClosed())await page.goto('about:blank');});
async function owner(page){
 await page.goto('/#pengaturan');const response=await page.request.post('/api/auth/register',{data:{email:randomUUID()+'@example.test',password:'DisplayTest2026!',businessName:'Usaha uji layar',communityName:'Kelompok uji'}});expect(response.status()).toBe(201);const s=await response.json();await page.reload();await expect(page.locator('.display-management')).toBeVisible();
 const post=async(path,body)=>{const r=await page.request.post('/api'+path,{data:{...body,csrf:s.csrf}});expect(r.ok()).toBe(true);return r.json();};
 const p=await post('/ingredients',{name:'Bahan rahasia',unit:'gram',min:0,storageNote:'Catatan gudang rahasia',catalogRevision:1});await post('/stock-receipts',{productId:p.id,qty:1000,unitPrice:100,supplier:'Pemasok rahasia',idempotencyKey:randomUUID()});
 const m=await post('/menus',{name:'Menu rahasia',price:37000,aliases:[],recipe:{[p.id]:25},catalogRevision:2,preparation:{minutes:5,passiveMinutes:1,station:'dapur'}});
 const o=await post('/kitchen/orders',{label:'Nama pelanggan pribadi',channel:'dine_in',items:[{id:m.id,qty:1,note:'Catatan alergi pribadi'}],catalogRevision:3,idempotencyKey:randomUUID()});
 return {s,post,order:o.id};
}
async function link(page){
 await page.getByLabel('Nama layar',{exact:true}).fill('TV ruang tunggu');await page.locator('[data-form="display-create"] [name="confirmed"]').check();await page.getByRole('button',{name:'Buat tautan layar',exact:true}).click();await expect(page.locator('.display-link-result')).toBeFocused();return page.getByLabel('Tautan layar yang baru dibuat',{exact:true}).inputValue();
}
async function capture(page,name){await mkdir('data/display-captures',{recursive:true});await page.evaluate(async()=>{document.activeElement?.blur();scrollTo(0,0);await document.fonts.ready;});await page.screenshot({path:`data/display-captures/${name}.png`,fullPage:true});}
test('owner creates access; anonymous customer sees only codes, follows ready, and revocation clears screen',async({page,browser})=>{
 const {post,order}=await owner(page),url=await link(page),token=new URL(url).hash.slice(1),customer=await browser.newContext(),screen=await customer.newPage();
 const requests=[];screen.on('request',r=>requests.push(new URL(r.url()).pathname));await screen.goto(url);const code=order.slice(0,8).toUpperCase();await expect(screen.locator('#customer-main')).toContainText(code);
 expect(await customer.cookies()).toHaveLength(0);expect(await screen.locator('body').innerText()).not.toMatch(/Nama pelanggan|Menu rahasia|Bahan rahasia|Pemasok|37000|alergi/);expect(requests).not.toContain('/api/bootstrap');expect(requests).not.toContain('/api/kitchen');
 const denied=await screen.evaluate(async token=>{const r=await fetch('/api/kitchen/orders',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({})});return r.status;},token);expect(denied).toBe(401);
 const k=await(await page.request.get('/api/kitchen')).json(),task=k.orders.find(o=>o.id===order).tasks[0];await post(`/kitchen/orders/${order}/actions`,{action:'start',taskId:task.id,revision:1,idempotencyKey:randomUUID()});await post(`/kitchen/orders/${order}/actions`,{action:'ready',taskId:task.id,revision:2,idempotencyKey:randomUUID()});await expect(screen.locator('.ready-label')).toHaveText('Silakan ke petugas');
 await page.setViewportSize({width:1440,height:1000});await capture(page,'management-desktop');
 for(const [name,width,theme]of[['customer-desktop',1440,'light'],['customer-mobile',390,'light'],['customer-dark',1440,'dark']]){await screen.setViewportSize({width,height:1000});await screen.evaluate(t=>document.documentElement.dataset.theme=t,theme);await capture(screen,name);expect(await screen.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 const state=await(await page.request.get('/api/bootstrap')).json();expect(JSON.stringify(state)).not.toContain(token);
 const stored=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('gerai-kita-device-v2');r.onsuccess=()=>{const db=r.result,q=db.transaction('snapshots').objectStore('snapshots').getAll();q.onsuccess=()=>{resolve(JSON.stringify(q.result));db.close();};};}));expect(stored).not.toContain(token);
 await page.reload();await expect(page.locator('.display-link-result')).toHaveCount(0);await page.locator('[data-action="display-revoke"]').click();await expect(page.locator('[data-action="display-confirm-revoke"]')).toBeFocused();await page.locator('[data-action="display-confirm-revoke"]').click();await expect(page.locator('#display-management-title')).toBeFocused();await expect(screen.locator('#customer-main')).toContainText('Akses layar sudah berakhir');await expect(screen.locator('#customer-main')).not.toContainText(code);await capture(screen,'customer-revoked');await customer.close();
});
test('customer hides stale orders offline, reconnects, and missing or expired access never exposes an owner page',async({page,browser})=>{
 const {order}=await owner(page),url=await link(page),customer=await browser.newContext(),screen=await customer.newPage();await screen.goto(url);await expect(screen.locator('#customer-main')).toContainText(order.slice(0,8).toUpperCase());
 await customer.setOffline(true);await expect(screen.locator('#screen-status')).toContainText('offline');await expect(screen.locator('.customer-code')).toHaveCount(0);await capture(screen,'customer-offline');await customer.setOffline(false);await expect(screen.locator('.customer-code')).toHaveCount(1);
 await screen.route('**/api/display/events',route=>route.fulfill({status:401,json:{error:'expired'}}));await screen.reload();await expect(screen.locator('#customer-main')).toContainText('Akses layar sudah berakhir');await screen.goto(new URL('/api/display/screen',url).href);await expect(screen.locator('#customer-main')).toContainText('Buka tautan layar dari pemilik');await expect(screen.locator('[name="password"]')).toHaveCount(0);await customer.close();
});
test('screen bypasses legacy PWA navigation cache and transient links disappear on leaving settings',async({page})=>{
 await owner(page);const url=await link(page);await page.evaluate(async()=>{await navigator.serviceWorker.ready;const cache=await caches.open((await caches.keys()).find(n=>n.startsWith('gerai-kita-shell-')));await cache.put('/index.html',new Response('<h1>Old cached owner shell</h1>',{headers:{'content-type':'text/html'}}));});
 await page.goto('/#stok');await expect(page.locator('.display-link-result')).toHaveCount(0);await page.goto(url);await expect(page.locator('.customer-header h1')).toHaveText('Status pesanan.');await expect(page.locator('.customer-code')).toHaveCount(1);expect(await page.locator('body').innerText()).not.toContain('Old cached owner shell');
});
test('lost create response retries with the same in-memory key and token without creating duplicate access',async({page})=>{
 await owner(page);let lost=false,firstToken;
 await page.route('**/api/displays',async route=>{if(!lost){lost=true;firstToken=route.request().postDataJSON().token;await route.fetch();await route.abort('failed');}else await route.continue();});
 await page.getByLabel('Nama layar',{exact:true}).fill('Layar respons hilang');await page.locator('[data-form="display-create"] [name="confirmed"]').check();await page.getByRole('button',{name:'Buat tautan layar',exact:true}).click();await expect(page.locator('.display-management')).toContainText('Status pembuatan belum pasti');await expect(page.locator('.display-link-result')).toHaveCount(0);
 await page.getByRole('button',{name:'Perbarui data',exact:true}).click();await expect(page.getByRole('button',{name:'Buat tautan layar',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Buat tautan layar',exact:true}).click();await expect(page.locator('.display-link-result')).toBeVisible();expect(new URL(await page.getByLabel('Tautan layar yang baru dibuat',{exact:true}).inputValue()).hash.slice(1)).toBe(firstToken);
 const state=await(await page.request.get('/api/bootstrap')).json();expect(state.displays).toHaveLength(1);expect(JSON.stringify(state)).not.toContain(firstToken);
});
test('authentication loss clears the old display link before another account signs in',async({page})=>{
 const {s}=await owner(page);const url=await link(page),token=new URL(url).hash.slice(1);
 await page.route('**/api/bootstrap',route=>route.fulfill({status:401,json:{error:'Sesi berakhir'}}));await page.getByRole('button',{name:'Perbarui data',exact:true}).click();await expect(page.getByRole('button',{name:'Masuk',exact:true})).toBeVisible();
 await page.unroute('**/api/bootstrap');await page.request.post('/api/auth/logout',{data:{csrf:s.csrf}});await page.locator('[data-action=show-register]').click();
 await page.getByLabel('Nama usaha',{exact:true}).fill('Usaha baru');await page.getByLabel('Email',{exact:true}).fill(randomUUID()+'@example.test');await page.getByLabel('Kata sandi',{exact:true}).fill('DisplayOther2026!');await page.getByRole('button',{name:'Daftarkan usaha',exact:true}).click();
 await expect(page.locator('.display-management')).toBeVisible();await expect(page.locator('.display-link-result')).toHaveCount(0);expect(await page.locator('body').innerHTML()).not.toContain(token);
});
test('a hidden customer tab clears codes and waits for fresh authorization before showing them again',async({page,browser})=>{
 const {post}=await owner(page),url=await link(page),customer=await browser.newContext(),screen=await customer.newPage();try{
 await screen.goto(url);await expect(screen.locator('.customer-code')).toHaveCount(1);
 await screen.evaluate(()=>{window.screenHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.screenHidden});document.dispatchEvent(new Event('visibilitychange'));});await expect(screen.locator('.customer-code')).toHaveCount(0);
 const data=await(await page.request.get('/api/bootstrap')).json();await post(`/displays/${data.displays[0].id}/revoke`,{});
 await screen.evaluate(()=>{window.screenHidden=false;document.dispatchEvent(new Event('visibilitychange'));});await expect(screen.locator('#customer-main')).toContainText('Akses layar sudah berakhir');await expect(screen.locator('.customer-code')).toHaveCount(0);
 }finally{await customer.close();}
});
