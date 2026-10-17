import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';

async function setup(page){
  await page.goto('/');
  const s=await page.evaluate(async email=>{
    const post=async(path,body,csrf)=>{const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,csrf})});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
    const a=await post('auth/register',{email,password:'KitchenAI2026!',businessName:'Usaha pengujian',communityName:'Kelompok pengujian'});
    const p=await post('ingredients',{name:'Tepung pengujian',unit:'gram',min:0,storageNote:'',catalogRevision:1},a.csrf);
    await post('stock-receipts',{productId:p.id,qty:1000,unitPrice:1,supplier:'',idempotencyKey:crypto.randomUUID()},a.csrf);
    const m=await post('menus',{name:'Roti pengujian',price:5000,aliases:[],recipe:{[p.id]:10},catalogRevision:2,preparation:{minutes:2,passiveMinutes:0,station:'pemanggang'}},a.csrf);
    return {csrf:a.csrf,menu:m.id,product:p.id};
  },randomUUID()+'@example.test');
  await page.reload();await expect(page.locator('#main h1')).toBeVisible();const skip=page.locator('.guide-welcome [data-guide-action="dismiss"]');if(await skip.count())await skip.click();return s;
}
async function capture(page,prefix){
  if(!process.env.CAPTURE_REVIEW)return;
  await expect(page.locator('#toast')).toBeHidden({timeout:10000});
  await mkdir('.impeccable/review/v47',{recursive:true});
  for(const [name,width,theme] of [['desktop',1440,'light'],['mobile',390,'light'],['dark',1440,'dark']]){
    await page.setViewportSize({width,height:1000});await page.evaluate(async theme=>{document.documentElement.dataset.theme=theme;document.activeElement?.blur();scrollTo(0,0);await document.fonts.ready;},theme);
    await page.waitForTimeout(250); // Capture final theme colors after the incumbent 150 ms transition.
    if(theme==='dark'){const colors=await page.locator('[data-form="kitchen-extract"] button[type="submit"],[data-form="plan-interest"] button[type="submit"]').first().evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,foreground:s.color,disabled:el.disabled};});expect(colors.disabled).toBe(false);await writeFile('.impeccable/review/v47/'+prefix+'dark-colors.json',JSON.stringify(colors,null,2));}
    await page.screenshot({path:`.impeccable/review/v47/${prefix}${name}.png`,fullPage:true,animations:'disabled'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
}

test('chat fills an editable kitchen review, rejects unknown text, and reserves only after explicit submission',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));const s=await setup(page);
  await page.getByLabel('Label pesanan / meja').fill('Meja pengujian');
  await page.getByLabel('Teks pesanan',{exact:true}).fill('dua roti pengujian tanpa sambal');
  await page.getByRole('button',{name:'Bantu isi pesanan',exact:true}).click();
  await expect(page.getByLabel('Menu item 1',{exact:true})).toHaveValue(s.menu);await expect(page.getByLabel('Porsi item 1',{exact:true})).toHaveValue('2');
  await expect(page.getByLabel('Catatan item 1',{exact:true})).toHaveValue('dua roti pengujian tanpa sambal');
  await expect(page.locator('.voice-entry [role="status"]')).toContainText('Parser lokal');
  let state=await(await page.request.get('/api/bootstrap')).json();expect(state.kitchen.orders).toHaveLength(0);expect(state.availableStock[s.product]).toBe(1000);expect(state.plan.usage.text.used).toBe(0);
  await page.getByLabel('Teks pesanan',{exact:true}).fill('dua menu yang tidak dikenal');await page.getByRole('button',{name:'Bantu isi pesanan',exact:true}).click();await expect(page.locator('[data-form="kitchen-extract"] .form-error')).not.toBeEmpty();await expect(page.getByLabel('Porsi item 1',{exact:true})).toHaveValue('2');
  await page.getByLabel('Porsi item 1',{exact:true}).fill('3');
  await capture(page,'');
  await page.getByRole('button',{name:'Masukkan ke antrean',exact:true}).click();await expect(page.locator('.kitchen-order')).toHaveCount(1);
  state=await(await page.request.get('/api/bootstrap')).json();expect(state.stock[s.product]).toBe(1000);expect(state.availableStock[s.product]).toBe(970);expect(state.transactions).toHaveLength(0);expect(errors).toEqual([]);
});

test('switching accounts in the same running page discards previous recovery codes',async({page})=>{
  const s=await setup(page);await page.goto('/#pengaturan');
  await page.locator('[data-form="recovery-codes"] input[name="confirmed"]').check();await page.locator('[data-form="recovery-codes"] button[type="submit"]').click();await expect(page.locator('.recovery-code-list li')).toHaveCount(10);
  await page.evaluate(async({csrf,email})=>{
    const post=(path,body)=>fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    await post('auth/logout',{csrf});const response=await post('auth/register',{email,password:'RecoveryOther2026!',businessName:'Usaha kedua',communityName:'Kelompok kedua'});if(!response.ok)throw Error('registration failed');
  },{csrf:s.csrf,email:randomUUID()+'@example.test'});
  await page.getByRole('button',{name:'Perbarui data',exact:true}).click();await expect(page.locator('.active-business')).toContainText('Usaha kedua');await expect(page.locator('.recovery-code-list')).toHaveCount(0);
});

test('package screen shows real usage and persists a need without activating a paid subscription',async({page})=>{
  await setup(page);await page.goto('/#pengaturan');const section=page.locator('section',{has:page.locator('#plan-title')});
  await expect(section).toContainText('Jumlah menu tidak dibatasi');await expect(section).toContainText('0 dari 100');
  await section.getByLabel('Kebutuhan tambahan',{exact:true}).selectOption('network');await section.getByLabel('Catatan kebutuhan (opsional)',{exact:true}).fill('Koordinasi pesanan anggota');await section.getByRole('checkbox').check();
  await section.getByRole('button',{name:'Simpan kebutuhan paket',exact:true}).click();await expect(section).toContainText('Kebutuhan tercatat:');await page.reload();await expect(section).toContainText('Koordinasi pesanan anggota');
  const s=await(await page.request.get('/api/bootstrap')).json();expect(s.plan.id).toBe('basic');expect(s.plan.paidAvailable).toBe(false);expect(s.plan.interest.need).toBe('network');
  await capture(page,'plan-');
});

test('cashier can review extracted orders without accessing owner billing or recipes',async({page})=>{
  const s=await setup(page),email=randomUUID()+'@example.test';
  await page.evaluate(async({csrf,email})=>{
    const post=(path,body)=>fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,csrf})});
    await post('staff',{email,password:'CashierAI2026!',name:'Kasir pengujian',role:'cashier',confirmed:true,idempotencyKey:crypto.randomUUID()});await post('auth/logout',{});
    await post('auth/login',{email,password:'CashierAI2026!'});
  },{csrf:s.csrf,email});
  await page.reload();await page.getByLabel('Pesanan pelanggan',{exact:true}).fill('dua roti pengujian');await page.getByRole('button',{name:'Baca pesanan',exact:true}).click();await expect(page.getByLabel('Porsi item 1',{exact:true})).toHaveValue('2');
  await expect(page.locator('#plan-title')).toHaveCount(0);expect((await page.request.get('/api/account/plan')).status()).toBe(403);
  const data=await(await page.request.get('/api/bootstrap')).json();expect(data.menu[0].recipe).toBeUndefined();
  await capture(page,'cashier-');
  await page.getByLabel('Label pesanan / meja').fill('Kasir AI');await page.getByRole('button',{name:'Masukkan ke antrean dapur',exact:true}).click();await expect(page.locator('.kitchen-order')).toHaveCount(1);
});

test('slow kitchen extraction outlasts the old timeout, keeps reviewed fields on invalid numbers and permits manual correction',async({page})=>{
  const s=await setup(page);let delayed=false;
  await page.route('**/api/kitchen/extractions',async route=>{
    if(!delayed){delayed=true;await new Promise(resolve=>setTimeout(resolve,16000));}
    await route.continue();
  });
  await page.getByLabel('Label pesanan / meja').fill('Pesanan diperiksa');
  await page.getByLabel('Teks pesanan',{exact:true}).fill('roti pengujian 2 hangat');
  await page.getByRole('button',{name:'Bantu isi pesanan',exact:true}).click();
  await expect(page.getByLabel('Porsi item 1',{exact:true})).toHaveValue('2',{timeout:22000});
  await expect(page.getByRole('button',{name:'Bantu isi pesanan',exact:true})).toBeEnabled();
  await page.getByLabel('Teks pesanan',{exact:true}).fill('roti pengujian 2 pedas 1 burger');
  await page.getByRole('button',{name:'Bantu isi pesanan',exact:true}).click();
  await expect(page.locator('[data-form="kitchen-extract"] .form-error')).toContainText('angka');
  await expect(page.getByLabel('Label pesanan / meja')).toHaveValue('Pesanan diperiksa');await expect(page.getByLabel('Porsi item 1',{exact:true})).toHaveValue('2');
  const before=await(await page.request.get('/api/bootstrap')).json();expect(before.kitchen.orders).toHaveLength(0);expect(before.availableStock[s.product]).toBe(1000);expect(before.plan.usage.text.used).toBe(0);
  await page.getByRole('button',{name:'Lanjutkan isi manual',exact:true}).click();await page.getByLabel('Catatan item 1',{exact:true}).fill('Pedas tingkat 3; sudah diperiksa');
  await page.getByRole('button',{name:'Masukkan ke antrean',exact:true}).click();await expect(page.locator('.kitchen-order')).toHaveCount(1);
  const after=await(await page.request.get('/api/bootstrap')).json();expect(after.availableStock[s.product]).toBe(980);expect(after.transactions).toHaveLength(0);
});
