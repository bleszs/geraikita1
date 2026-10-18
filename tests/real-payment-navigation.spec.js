import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

async function capture(page,name){if(!process.env.CAPTURE_PAYMENT_REVIEW)return;await mkdir('.impeccable/review/payments-v54',{recursive:true});await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();document.querySelector('#toast').hidden=true;});await page.screenshot({path:'.impeccable/review/payments-v54/'+name+'.png',fullPage:true,animations:'disabled'});}
async function register(page){const r=await page.request.post('/api/auth/register',{data:{businessName:'Usaha uji pembayaran',email:crypto.randomUUID()+'@example.test',password:'Payment-nav-password'}});expect(r.status()).toBe(201);return r.json();}

test('owner navigation starts at Dasbor and places both kitchen pages after staff; withdrawal remains discoverable at zero balance',async({page})=>{
  await register(page);await page.goto('/#ringkasan');await expect(page.locator('.topbar-title')).toHaveText('Dasbor');
  expect(await page.locator('.sidebar nav a:visible').allTextContents()).toEqual(['Dasbor','Catat pesanan','Keuangan','Produk & stok','Saran kulakan','Beli bersama','Daftar staf','Operasional dapur','Layar layanan','Riwayat','Pengaturan akun']);
  await expect(page.locator('.topbar-title')).toHaveText('Dasbor');await page.setViewportSize({width:1440,height:1000});await capture(page,'navigation-desktop');
  await page.locator('.sidebar nav a[href="#keuangan"]').click();await expect(page.getByRole('heading',{name:'Tarik saldo pemilik',exact:true})).toBeVisible();await expect(page.getByLabel('Tujuan penarikan',{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Tarik ke bank / e-wallet',exact:true})).toBeDisabled();await expect(page.locator('#withdrawal-section')).toContainText('Tidak ada potongan 10% kedua');await capture(page,'withdraw-empty-desktop');
  await page.setViewportSize({width:360,height:900});await page.getByRole('button',{name:'Ubah tema',exact:true}).click();await expect(page.locator('.finance-totals>div').nth(2)).toBeVisible();await capture(page,'withdraw-empty-mobile-dark');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('cashier records all four payment methods once and owner can withdraw net after the 10% fee',async({page,browser})=>{
  const owner=await register(page),post=async(path,data)=>{const r=await page.request.post('/api'+path,{data:{...data,csrf:owner.csrf}});expect(r.ok()).toBe(true);return r.json();};
  const ingredient=await post('/ingredients',{name:'Bahan pembayaran',unit:'gram',min:0,storageNote:'',catalogRevision:1});
  await post('/stock-receipts',{productId:ingredient.id,qty:1000,unitPrice:10,supplier:'',idempotencyKey:crypto.randomUUID()});
  const menu=await post('/menus',{name:'Menu pembayaran',price:10000,aliases:[],recipe:{[ingredient.id]:20},catalogRevision:2,preparation:{minutes:1,passiveMinutes:0,station:'dapur'}});
  const email=crypto.randomUUID()+'@example.test',password='Payment-cashier-password';await post('/staff',{email,password,name:'Kasir pembayaran',role:'cashier',confirmed:true,idempotencyKey:crypto.randomUUID()});
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4175'});
  try{
    expect((await context.request.post('/api/auth/login',{data:{email,password}})).status()).toBe(200);const cashier=await context.newPage();await cashier.goto('/api/staff/screen#dapur');
    await expect(cashier.locator('.staff-intake-shortcut')).toContainText('Tunai, QRIS, Transfer Bank, dan E-Wallet');
    for(const [method,label] of [['tunai','Tunai'],['qris','QRIS'],['transfer','Transfer Bank'],['ewallet','E-Wallet']]){
      await cashier.getByRole('button',{name:'Pesanan baru',exact:true}).click();await cashier.getByRole('button',{name:'Susun manual',exact:true}).click();await expect(cashier.getByLabel('Menu item 1',{exact:true})).toHaveValue(menu.id);await cashier.getByRole('button',{name:'Bayar langsung & catat',exact:true}).click();
      for(const name of ['Tunai','QRIS','Transfer Bank','E-Wallet'])await expect(cashier.locator('.pay-card').getByRole('button',{name,exact:true})).toBeVisible();
      await cashier.locator('.pay-card').getByRole('button',{name:label,exact:true}).click();
      if(method==='qris'){await expect(cashier.locator('.pay-detail')).toContainText('QRIS resmi');await expect(cashier.locator('.qris-box')).toHaveCount(0);await cashier.setViewportSize({width:1440,height:1000});await capture(cashier,'cashier-qris-desktop');await cashier.setViewportSize({width:360,height:900});await capture(cashier,'cashier-qris-mobile');expect(await cashier.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
      await cashier.getByRole('button',{name:'Bayar & selesaikan',exact:true}).click();await expect(cashier.locator('.receipt-pay')).toContainText(label);
      if(method==='tunai'){await cashier.emulateMedia({media:'print'});await expect(cashier.locator('.receipt-card')).toHaveCSS('max-height','none');await expect(cashier.locator('.receipt-card')).toHaveCSS('overflow','visible');await cashier.emulateMedia({media:'screen'});}
      await cashier.getByRole('button',{name:'Selesai',exact:true}).click();
      const data=await page.request.get('/api/bootstrap').then(r=>r.json());const found=data.transactions.filter(t=>t.payment_method===method);expect(found).toHaveLength(1);expect(found[0].fee).toBe(1000);expect(found[0].net).toBe(9000);
    }
    await page.goto('/#keuangan');await expect(page.locator('.metrics')).toContainText('36.000');await page.getByLabel('Tujuan penarikan',{exact:true}).selectOption('ewallet');await page.getByLabel('Nomor rekening / e-wallet',{exact:true}).fill('081234567890');await page.getByLabel('Jumlah (Rp)',{exact:true}).fill('20000');await capture(page,'withdraw-funded-desktop');const boxes=await page.locator('.finance-flow>div').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right};}));expect(boxes[0].right).toBeLessThanOrEqual(boxes[1].left);expect(boxes[1].right).toBeLessThanOrEqual(boxes[2].left);await page.getByRole('button',{name:'Tarik ke bank / e-wallet',exact:true}).click();
    const data=await page.request.get('/api/bootstrap').then(r=>r.json());expect(data.transactions).toHaveLength(4);expect(data.finance.balance).toBe(16000);expect(data.finance.withdrawn).toBe(20000);expect(data.stock[ingredient.id]).toBe(920);
  }finally{await context.close();}
});
