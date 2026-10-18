import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

test('recovery bypasses a stale cached startup error and preserves device drafts',async({page,context})=>{
  await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
  await page.evaluate(async()=>{
    const names=await caches.keys(),name=names.find(n=>n.startsWith('gerai-kita-shell-'));const cache=await caches.open(name);
    await cache.put('/index.html',new Response('<!doctype html><title>Versi lama</title><h1>Aplikasi belum terhubung.</h1>',{headers:{'content-type':'text/html'}}));
    const {putDraft}=await import('/offline.js');await putDraft({id:'recovery-preserved-draft',scope:'isolated-recovery-test',status:'draft',payload:{items:[]}});
  });
  await page.reload();await expect(page.getByRole('heading',{name:'Mulai dari usahamu sendiri.'})).toBeVisible();
  await page.evaluate(async()=>{const cache=await caches.open((await caches.keys()).find(n=>n.startsWith('gerai-kita-shell-')));await cache.put('/index.html',new Response('<!doctype html><title>Versi lama</title><h1>Aplikasi belum terhubung.</h1>',{headers:{'content-type':'text/html'}}));});
  await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'Aplikasi belum terhubung.'})).toBeVisible();await context.setOffline(false);
  await page.goto('/api/recovery');await page.getByRole('button',{name:'Perbarui & buka aplikasi'}).click();await expect(page.getByRole('heading',{name:'Mulai dari usahamu sendiri.'})).toBeVisible();
  expect(await page.evaluate(async()=>{const {listDrafts}=await import('/offline.js');return (await listDrafts()).some(d=>d.id==='recovery-preserved-draft');})).toBe(true);
});
const password='Only-for-browser-tests-775';
const uniqueEmail=()=>crypto.randomUUID()+'@example.test';

test('login and registration can switch and remember light or dark mode',async({page})=>{
  await page.goto('/');
  const theme=page.getByRole('button',{name:'Aktifkan mode gelap'});
  await expect(theme).toBeVisible();await theme.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.getByRole('button',{name:'Aktifkan mode terang'})).toBeVisible();
  await page.locator('[data-action=show-login]').click();
  await expect(page.getByRole('button',{name:'Aktifkan mode terang'})).toBeVisible();
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

test('owner creates recovery codes and resets a forgotten password with one unused code',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await register(page);
  const email=(await state(page)).account.email;
  await page.goto('/#pengaturan');
  const section=page.locator('#recovery-section');
  await expect(section).toContainText('Sisa kode belum terpakai: 0');
  await section.getByRole('checkbox').check();
  await section.getByRole('button',{name:'Buat kode pemulihan',exact:true}).click();
  const codes=section.locator('.recovery-code-list code');
  await expect(codes).toHaveCount(10);
  const code=(await codes.first().innerText()).trim();
  await capture(page,'recovery-codes-desktop');
  expect((await state(page)).account.recoveryCodes).toBe(10);
  await section.getByRole('button',{name:'Sembunyikan kode',exact:true}).click();
  await expect(section.locator('.recovery-code-list')).toHaveCount(0);
  await expect(section).toContainText('Sisa kode belum terpakai: 10');
  await page.getByRole('button',{name:'Keluar akun',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Kembali ke catatan usahamu.'})).toBeVisible();
  await page.getByRole('button',{name:'Lupa kata sandi?',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pulihkan akses akunmu.'})).toBeVisible();
  await page.getByLabel('Email akun',{exact:true}).fill(email);
  await page.getByLabel('Kode pemulihan',{exact:true}).fill(code);
  await page.getByLabel('Kata sandi baru',{exact:true}).fill('Fresh-recovered-pass-2026');
  await page.getByLabel('Ulangi kata sandi baru',{exact:true}).fill('Fresh-recovered-pass-2026');
  await capture(page,'recovery-reset-desktop');
  await page.getByRole('button',{name:'Pulihkan & masuk',exact:true}).click();
  await page.goto('/#ringkasan');await expect(page.getByRole('heading',{name:'Catatan nyata, keputusan lebih jelas.'})).toBeVisible();
  expect((await state(page)).account.recoveryCodes).toBe(9);
  await page.getByRole('button',{name:'Keluar akun',exact:true}).click();
  await page.getByRole('button',{name:'Lupa kata sandi?',exact:true}).click();
  await page.getByLabel('Email akun',{exact:true}).fill(email);
  await page.getByLabel('Kode pemulihan',{exact:true}).fill(code);
  await page.getByLabel('Kata sandi baru',{exact:true}).fill('Another-attempt-pass-2026');
  await page.getByLabel('Ulangi kata sandi baru',{exact:true}).fill('Another-attempt-pass-2026');
  await page.getByRole('button',{name:'Pulihkan & masuk',exact:true}).click();
  await expect(page.locator('#auth-form .form-error')).toContainText('tidak sesuai');
  await page.getByRole('button',{name:'Kembali ke halaman masuk',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Kata sandi',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Masuk',exact:true}).click();
  await expect(page.locator('#auth-form .form-error')).toContainText('tidak sesuai');
  await page.getByLabel('Kata sandi',{exact:true}).fill('Fresh-recovered-pass-2026');
  await page.getByRole('button',{name:'Masuk',exact:true}).click();
  await page.goto('/#ringkasan');await expect(page.getByRole('heading',{name:'Catatan nyata, keputusan lebih jelas.'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('restock distinguishes an untrained model from an unavailable estimate without inventing metrics',async({page})=>{
  await register(page);await addIngredient(page);await page.goto('/#restock');await expect(page.locator('.restock-results')).toContainText('Histori kurang');await expect(page.locator('.restock-results')).toContainText('Belum ada prediksi');await page.locator('.restock-calculation>summary').click();await expect(page.locator('.restock-results')).toContainText('Estimasi belum tersedia');expect((await state(page)).recommendations[0].trainedModel.status).toBe('not_trained');
  await page.setViewportSize({width:1440,height:1000});await capture(page,'forecast-status-desktop');await page.setViewportSize({width:320,height:900});await capture(page,'forecast-status-mobile');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
async function state(page){const r=await page.request.get('/api/bootstrap');expect(r.status()).toBe(200);return r.json();}
async function register(page,name='Usaha yang didaftarkan',inviteCode){await page.goto('/');await page.getByLabel('Nama usaha',{exact:true}).fill(name);const email=uniqueEmail();await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Kata sandi',{exact:true}).fill(password);await page.getByRole('button',{name:'Daftarkan usaha',exact:true}).click();await page.goto('/#ringkasan');await expect(page.getByRole('heading',{name:'Catatan nyata, keputusan lebih jelas.'})).toBeVisible();
// These tests exercise bookkeeping. Onboarding itself has its own browser suite.
await page.evaluate(async()=>{const {guideKey,emptyGuideProgress}=await import('/guide-state.js');const {scopeOf}=await import('/offline.js');const account=await fetch('/api/bootstrap').then(r=>r.json());localStorage.setItem(guideKey(scopeOf(account)),JSON.stringify({...emptyGuideProgress(),welcomeSeen:true,autoPageGuides:false}));});await page.reload();await expect(page.getByRole('heading',{name:'Catatan nyata, keputusan lebih jelas.'})).toBeVisible();
await page.goto('/#kelompok');
if(inviteCode){await page.getByLabel('Kode kelompok',{exact:true}).fill(inviteCode);await page.locator('[data-form="community-join"] input[name="confirmed"]').check();await page.getByRole('button',{name:'Gabung kelompok',exact:true}).click();}
else{await page.getByText('Buat kelompok sendiri',{exact:true}).click();await page.getByLabel('Nama kelompok',{exact:true}).fill('Komunitas dari formulir');await page.getByRole('button',{name:'Buat kelompok & kode',exact:true}).click();}
await expect(page.locator('.community-membership')).toBeVisible();await page.goto('/#ringkasan');return {email,password};}
async function capture(page,name){if(!process.env.CAPTURE_REVIEW)return;await fs.mkdir('.impeccable/review',{recursive:true});await page.evaluate(()=>{document.activeElement?.blur();document.querySelector('#toast').hidden=true;scrollTo(0,0);});await page.screenshot({path:`.impeccable/review/${name}.png`,fullPage:false});}
async function addIngredient(page){await page.goto('/#stok');await page.getByRole('button',{name:'Tambah bahan',exact:true}).click();await page.getByLabel('Nama bahan',{exact:true}).fill('Tepung dibuat pengguna');await page.getByLabel('Satuan bahan',{exact:true}).selectOption('gram');await page.getByLabel('Ambang stok menipis',{exact:true}).fill('100');await page.getByLabel('Catatan penyimpanan',{exact:true}).fill('Disimpan dalam wadah tertutup');await page.getByRole('button',{name:'Simpan bahan',exact:true}).click();await expect(page.locator('.inventory-editor')).toHaveCount(0);return (await state(page)).catalog[0];}
async function fillReceipt(page,product){await page.getByRole('button',{name:'Catat barang masuk',exact:true}).click();await page.getByLabel('Bahan',{exact:true}).selectOption(product.id);await page.getByLabel('Satuan diterima',{exact:true}).selectOption('kg');await page.getByLabel('Jumlah diterima',{exact:true}).fill('1.5');await page.getByLabel('Harga per satuan diterima (Rp)',{exact:true}).fill('17000');await page.getByLabel('Pemasok (opsional)',{exact:true}).fill('Pemasok yang dimasukkan pengguna');}

test('first visit has no sample credentials; registration starts empty and every route handles no data',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});await page.goto('/');await expect(page.getByRole('heading',{name:'Mulai dari usahamu sendiri.'})).toBeVisible();await expect(page.getByLabel('Email',{exact:true})).toHaveValue('');await expect(page.getByLabel('Kata sandi',{exact:true})).toHaveValue('');await capture(page,'live-registration-desktop');await register(page);
  const data=await state(page);expect(data.catalog).toEqual([]);expect(data.menu).toEqual([]);expect(data.transactions).toEqual([]);expect(data.offers).toEqual([]);expect(data.group.quote.configured).toBe(false);expect(data.profiles).toBeUndefined();await capture(page,'live-empty-desktop');
  for(const route of ['stok','pesanan','restock','kelompok','riwayat','ringkasan']){await page.goto('/#'+route);await expect(page.locator('#main h1')).toBeVisible();expect(await page.locator('body').innerText()).not.toMatch(/Bu Sari|Pak Budi|UD Pangan|Data contoh|Reset data/);}
  await expect(page.locator('nav[aria-label="Navigasi utama"] a[href="#surplus"]')).toHaveCount(0);await page.goto('/#surplus');await expect(page.locator('#main h1')).not.toHaveText('Manfaatkan surplus yang tersedia.');await expect(page.locator('#offer-form')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('user-created ingredient, metric receipt, menu, chat extraction, sale, reversals and CSV use entered values',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await register(page);const material=await addIngredient(page);await fillReceipt(page,material);await expect(page.locator('#receipt-preview')).toContainText('1.500 gram');await expect(page.locator('#receipt-preview')).toContainText('25.500');await page.getByRole('button',{name:'Simpan barang masuk',exact:true}).click();await expect(page.locator('.inventory-editor')).toHaveCount(0);expect((await state(page)).stock[material.id]).toBe(1500);
  await page.getByRole('button',{name:'Tambah menu',exact:true}).click();await page.getByLabel('Nama menu',{exact:true}).fill('Roti dari resep pengguna');await page.getByLabel('Harga per porsi (Rp)',{exact:true}).fill('23000');await page.getByLabel('Sebutan lain (pisahkan koma)',{exact:true}).fill('roti uji');await page.getByLabel('Tepung dibuat pengguna (gram)',{exact:true}).fill('25');await page.getByLabel('Estimasi total per porsi (menit)',{exact:true}).fill('10');await page.getByLabel('Stasiun pengerjaan',{exact:true}).fill('dapur');await page.getByRole('button',{name:'Simpan menu dan resep',exact:true}).click();await expect(page.locator('.inventory-editor')).toHaveCount(0);
  await page.goto('/#pesanan');await page.getByLabel('Chat atau catatan pelanggan',{exact:true}).fill('roti uji 2');await page.getByRole('button',{name:'Susun rincian pesanan',exact:true}).click();await expect(page.locator('.order-total')).toContainText('46.000');await page.getByLabel('Jumlah item 1',{exact:true}).fill('3');await expect(page.locator('.order-total')).toContainText('69.000');await expect(page.locator('.ingredient-list')).toContainText('75 gram');await page.getByLabel('Jumlah item 1',{exact:true}).fill('2');await expect(page.locator('.order-total')).toContainText('46.000');await page.getByRole('button',{name:'Konfirmasi & catat',exact:true}).click();await expect(page.getByRole('button',{name:'Susun rincian pesanan',exact:true})).toBeVisible();let data=await state(page);expect(data.transactions).toHaveLength(1);expect(data.stock[material.id]).toBe(1450);
  await page.goto('/#riwayat');await page.getByRole('button',{name:'Batalkan pesanan',exact:true}).click();await page.getByLabel('Saya sudah memeriksa dampak koreksi stok ini.').check();await page.getByRole('button',{name:'Konfirmasi pembatalan',exact:true}).click();await expect(page.locator('#cancel-form')).toHaveCount(0);expect((await state(page)).stock[material.id]).toBe(1500);
  await page.getByRole('button',{name:'Batalkan barang masuk',exact:true}).click();await page.getByLabel('Alasan pembatalan',{exact:true}).fill('Salah mencatat penerimaan yang sebenarnya.');await page.getByLabel('Saya sudah memeriksa dampak koreksi stok ini.').check();await page.getByRole('button',{name:'Konfirmasi pembatalan',exact:true}).click();await expect(page.locator('#cancel-form')).toHaveCount(0);expect((await state(page)).stock[material.id]).toBe(0);await expect(page.locator('.receipt-history')).toContainText('1,5 kg');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Ekspor barang masuk CSV',exact:true}).click();const csv=await fs.readFile(await(await download).path(),'utf8');expect(csv).toContain('Tepung dibuat pengguna');expect(csv).toContain('Salah mencatat penerimaan');expect(csv).toContain(';25500;');expect(csv.startsWith('\uFEFFsep=;\r\n')).toBe(true);expect(errors).toEqual([]);
});

test('real membership and owner-entered quote drive approvals, physical receipts and a new cycle without invented prices',async({browser})=>{
  const contexts=await Promise.all([0,1,2].map(()=>browser.newContext()));try{const pages=await Promise.all(contexts.map(c=>c.newPage())),owner=pages[0];await register(owner,'Usaha pemilik kelompok');await owner.goto('/#kelompok');await owner.getByLabel('Nama bahan bersama',{exact:true}).fill('Komoditas pilihan anggota');await owner.getByLabel('Satuan bersama',{exact:true}).selectOption('kg');await owner.getByLabel('Nama pemasok',{exact:true}).fill('Pemasok pilihan pemilik');await owner.getByLabel('Harga pemasok per satuan (Rp)',{exact:true}).fill('7000');await owner.getByLabel('Total ongkir pemasok (Rp)',{exact:true}).fill('11000');await owner.getByLabel('Minimum pembelian (satuan)',{exact:true}).fill('4');const deadline=await owner.evaluate(()=>new Date(Date.now()+7200000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16));await owner.getByLabel('Berlaku sampai',{exact:true}).fill(deadline);await owner.getByRole('button',{name:'Simpan penawaran pemasok',exact:true}).click();await expect(owner.locator('#demand-form')).toBeVisible();const settings=await state(owner);
    await register(pages[1],'Usaha anggota satu',settings.community.inviteCode);await register(pages[2],'Usaha anggota dua',settings.community.inviteCode);
    for(let i=0;i<3;i++){await pages[i].goto('/#restock');await pages[i].getByLabel('Jumlah yang ingin dibagikan (kg)',{exact:true}).fill(String(i+2));await pages[i].getByLabel('Saya mengizinkan jumlah kebutuhan ini dibagikan selama 24 jam.').check();await pages[i].getByRole('button',{name:'Bagikan / perbarui kebutuhan',exact:true}).click();await expect(pages[i].locator('#main h1')).toHaveText('Beli bersama, periksa bagianmu.');}
    for(const p of pages){await p.getByRole('button',{name:'Perbarui data',exact:true}).click();await expect(p.getByRole('button',{name:'Setujui bagianku',exact:true})).toBeEnabled();await p.getByRole('button',{name:'Setujui bagianku',exact:true}).click();await expect(p.getByRole('button',{name:'Perbarui data',exact:true})).toBeEnabled();}
    await owner.getByRole('button',{name:'Perbarui data',exact:true}).click();await owner.getByRole('button',{name:'Simpan rencana penerimaan',exact:true}).click();await expect(owner.locator('#collective-receipt-form')).toBeVisible();expect((await state(owner)).stock[settings.sharedProduct.id]).toBe(0);expect((await state(owner)).group.totalCost).toBe(74000);
    for(let i=0;i<3;i++){await pages[i].getByRole('button',{name:'Perbarui data',exact:true}).click();await pages[i].getByLabel('Jumlah diterima sekarang (kg)',{exact:true}).fill(String(i+2));await pages[i].getByRole('button',{name:'Catat penerimaan bagianku',exact:true}).click();await expect(pages[i].locator('#collective-receipt-form')).toHaveCount(0);}
    await owner.getByRole('button',{name:'Perbarui data',exact:true}).click();await owner.getByRole('button',{name:'Mulai siklus baru',exact:true}).click();await expect(owner.getByRole('button',{name:'Simpan penawaran pemasok',exact:true})).toBeVisible();const final=await state(owner);expect(final.group.cycle.id).toBe(2);expect(final.group.quote.configured).toBe(false);expect(final.stock[settings.sharedProduct.id]).toBe(2);await expect(owner.getByLabel('Harga pemasok per satuan (Rp)',{exact:true})).toHaveValue('');
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});

test('lost live receipt response survives offline reload and reconciles once without sending automatically',async({page,context})=>{
  await register(page);const p=await addIngredient(page);await fillReceipt(page,p);await page.evaluate(()=>navigator.serviceWorker.ready);let posts=0;await page.route('**/api/stock-receipts',async route=>{posts++;await route.fetch();await route.abort('failed');});await page.getByRole('button',{name:'Simpan barang masuk',exact:true}).click();await expect(page.locator('.pending-action')).toContainText('1.5 kg');await expect(page.getByRole('button',{name:'Hubungkan & muat ulang',exact:true})).toBeVisible();await context.setOffline(true);await page.reload();await expect(page.locator('.pending-action')).toBeVisible();await expect(page.getByRole('button',{name:'Periksa status & ulangi',exact:true})).toBeDisabled();await context.setOffline(false);await page.unroute('**/api/stock-receipts');expect(posts).toBe(1);await page.getByRole('button',{name:'Hubungkan & muat ulang',exact:true}).click();await expect(page.locator('.pending-action')).toHaveCount(0);const s=await state(page);expect(s.stock[p.id]).toBe(1500);expect(s.stockReceipts).toHaveLength(1);expect(posts).toBe(1);
});

test('pending storage failure prevents receipt POST and preserves user-entered fields',async({page})=>{
  await page.addInitScript(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(typeof key==='string'&&key.startsWith('action:'))throw new Error('Penyimpanan penuh untuk pengujian');return put.call(this,value,key);};});await register(page);const p=await addIngredient(page);await fillReceipt(page,p);let posts=0;page.on('request',r=>{if(r.url().endsWith('/api/stock-receipts')&&r.method()==='POST')posts++;});await page.getByRole('button',{name:'Simpan barang masuk',exact:true}).click();await expect(page.locator('#receipt-form .form-error')).toContainText('Penyimpanan penuh');await expect(page.getByLabel('Jumlah diterima',{exact:true})).toHaveValue('1.5');expect(posts).toBe(0);expect((await state(page)).stock[p.id]).toBe(0);
});

test('mobile empty states stay usable, custom text is escaped and logout never exposes an offline account snapshot',async({page,context})=>{
  await page.setViewportSize({width:320,height:900});const name='Usaha <img src=x onerror=alert(1)>';await register(page,name);await capture(page,'live-empty-mobile');for(const r of ['stok','pesanan','restock','kelompok','riwayat']){await page.goto('/#'+r);await expect(page.locator('#main h1')).toBeVisible();expect(await page.locator('img[src=x]').count()).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.getByRole('button',{name:'Buka navigasi',exact:true}).click();await page.getByRole('button',{name:'Keluar akun',exact:true}).click();await expect(page.getByRole('button',{name:'Masuk',exact:true})).toBeVisible();await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.reload();await expect(page.locator('.auth-layout')).toBeVisible();expect(await page.locator('.active-business').count()).toBe(0);
});

test('offline manual draft uses the actual catalog and waits for explicit confirmation after reconnect',async({page,context})=>{
  await register(page);const p=await addIngredient(page);await fillReceipt(page,p);await page.getByRole('button',{name:'Simpan barang masuk',exact:true}).click();await expect(page.locator('.inventory-editor')).toHaveCount(0);
  await page.getByRole('button',{name:'Tambah menu',exact:true}).click();await page.getByLabel('Nama menu',{exact:true}).fill('Menu khusus draft');await page.getByLabel('Harga per porsi (Rp)',{exact:true}).fill('13700');await page.getByLabel('Tepung dibuat pengguna (gram)',{exact:true}).fill('40');await page.getByLabel('Estimasi total per porsi (menit)',{exact:true}).fill('10');await page.getByLabel('Stasiun pengerjaan',{exact:true}).fill('dapur');await page.getByRole('button',{name:'Simpan menu dan resep',exact:true}).click();await expect(page.locator('.inventory-editor')).toHaveCount(0);await page.goto('/#pesanan');await page.evaluate(()=>navigator.serviceWorker.ready);
  await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Isi menu secara manual',exact:true}).click();await page.getByLabel('Jumlah item 1',{exact:true}).fill('3');await expect(page.locator('.order-total')).toContainText('41.100');await page.getByRole('button',{name:'Simpan draft di perangkat',exact:true}).click();await expect(page.getByRole('button',{name:'Tinjau draft',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'Tinjau draft',exact:true})).toBeVisible();
  await context.setOffline(false);await page.getByRole('button',{name:'Hubungkan & muat ulang',exact:true}).click();await expect(page.getByRole('button',{name:'Hubungkan & muat ulang',exact:true})).toHaveCount(0);let s=await state(page);expect(s.stock[p.id]).toBe(1500);expect(s.transactions).toHaveLength(0);await page.getByRole('button',{name:'Tinjau draft',exact:true}).click();await expect(page.getByLabel('Jumlah item 1',{exact:true})).toHaveValue('3');await page.getByRole('button',{name:'Konfirmasi & catat',exact:true}).click();await expect(page.getByRole('button',{name:'Tinjau draft',exact:true})).toHaveCount(0);s=await state(page);expect(s.stock[p.id]).toBe(1380);expect(s.transactions).toHaveLength(1);expect(s.transactions[0].total).toBe(41100);
});

test('settings update entered names and invitation; members keep their own account settings on mobile',async({page,browser})=>{
  await page.setViewportSize({width:1440,height:1000});await register(page,'Nama usaha sebelum diubah');await page.goto('/#pengaturan');const before=await state(page);await expect(page.getByText('Email akun: '+before.account.email,{exact:true})).toBeVisible();await page.getByLabel('Nama usaha',{exact:true}).fill('Kedai dari isian pemilik');await page.getByRole('button',{name:'Simpan nama usaha',exact:true}).click();await expect(page.locator('.active-business')).toContainText('Kedai dari isian pemilik');await page.goto('/#kelompok');await page.getByText('Atur nama dan kode kelompok',{exact:true}).click();await page.getByLabel('Nama kelompok',{exact:true}).fill('Kelompok hasil suntingan');await page.getByRole('button',{name:'Simpan nama kelompok',exact:true}).click();await expect(page.locator('.business-block')).toContainText('Kelompok hasil suntingan');
  await page.getByText('Atur nama dan kode kelompok',{exact:true}).click();await page.getByLabel('Saya memahami kode lama tidak dapat dipakai lagi untuk bergabung. Anggota yang sudah masuk tetap bergabung.').check();await page.getByRole('button',{name:'Ganti kode undangan',exact:true}).click();await expect(page.locator('#invite-form input')).not.toBeChecked();const after=await state(page);expect(after.community.inviteCode).not.toBe(before.community.inviteCode);expect(after.catalog).toEqual([]);expect(after.transactions).toEqual([]);await capture(page,'account-settings-desktop');
  const c=await browser.newContext({baseURL:'http://127.0.0.1:4175',viewport:{width:320,height:900}});try{const member=await c.newPage();await register(member,'Anggota dari kode terbaru',after.community.inviteCode);await member.goto('/#pengaturan');await expect(member.getByRole('button',{name:'Simpan nama kelompok',exact:true})).toHaveCount(0);await expect(member.getByRole('button',{name:'Ganti kode undangan',exact:true})).toHaveCount(0);await expect(member.getByLabel('Nama usaha',{exact:true})).toHaveValue('Anggota dari kode terbaru');expect(await member.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await capture(member,'account-settings-mobile');await c.setOffline(true);await member.reload();await expect(member.getByRole('button',{name:'Simpan nama usaha',exact:true})).toBeDisabled();await expect(member.getByRole('button',{name:'Simpan kata sandi baru',exact:true})).toBeDisabled();}finally{await c.close();}
});

test('password form rejects mismatch and old credentials, keeps current login and revokes another browser session',async({page,browser})=>{
  const credentials=await register(page,'Usaha pengganti kata sandi'),c=await browser.newContext({baseURL:'http://127.0.0.1:4175'});
  try{const other=await c.newPage();await other.goto('/');await other.locator('[data-action=show-login]').click();await other.getByLabel('Email',{exact:true}).fill(credentials.email);await other.getByLabel('Kata sandi',{exact:true}).fill(password);await other.getByRole('button',{name:'Masuk',exact:true}).click();await expect(other.locator('.active-business')).toContainText('Usaha pengganti kata sandi');
    await page.goto('/#pengaturan');const next='New-browser-password-991';let posts=0;page.on('request',r=>{if(r.url().endsWith('/api/account/password')&&r.method()==='POST')posts++;});
    async function fill(current,repeat=next){await page.getByLabel('Kata sandi saat ini',{exact:true}).fill(current);await page.getByLabel('Kata sandi baru',{exact:true}).fill(next);await page.getByLabel('Ulangi kata sandi baru',{exact:true}).fill(repeat);await page.getByRole('button',{name:'Simpan kata sandi baru',exact:true}).click();}
    await fill(password,'Mismatch-password-991');await expect(page.locator('#password-form .form-error')).toContainText('belum sama');expect(posts).toBe(0);await fill('Incorrect-password-991');await expect(page.locator('#password-form .form-error')).toContainText('tidak sesuai');await expect(page.getByRole('heading',{name:'Atur akun dan kelompokmu.'})).toBeVisible();await fill(password);await expect(page.locator('#toast')).toContainText('1 sesi lain dikeluarkan');await expect(page.getByLabel('Kata sandi baru',{exact:true})).toHaveValue('');
    await other.getByRole('button',{name:'Perbarui data',exact:true}).click();await expect(other.getByRole('heading',{name:'Kembali ke catatan usahamu.'})).toBeVisible();await other.getByLabel('Email',{exact:true}).fill(credentials.email);await other.getByLabel('Kata sandi',{exact:true}).fill(password);await other.getByRole('button',{name:'Masuk',exact:true}).click();await expect(other.locator('#auth-form .form-error')).toContainText('tidak sesuai');await other.getByLabel('Kata sandi',{exact:true}).fill(next);await other.getByRole('button',{name:'Masuk',exact:true}).click();await expect(other.locator('.active-business')).toContainText('Usaha pengganti kata sandi');
  }finally{await c.close();}
});

test('a waiting app update is offered before login without clearing fields and activates when requested',async({page})=>{
  await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.getByLabel('Nama usaha',{exact:true}).fill('Isian belum dikirim');await page.getByLabel('Kata sandi',{exact:true}).fill(password);
  await page.evaluate(()=>navigator.serviceWorker.register('/sw.js?isolated-upgrade=1'));
  await expect(page.getByRole('button',{name:'Muat ulang aplikasi',exact:true})).toBeVisible();await expect(page.getByLabel('Nama usaha',{exact:true})).toHaveValue('Isian belum dikirim');await expect(page.getByLabel('Kata sandi',{exact:true})).toHaveValue(password);
  await page.getByRole('button',{name:'Muat ulang aplikasi',exact:true}).click();await expect(page.getByLabel('Nama usaha',{exact:true})).toHaveValue('');await expect(page.getByRole('heading',{name:'Mulai dari usahamu sendiri.'})).toBeVisible();
});

test('owner sees takings after the 10% application fee in Keuangan and can withdraw to an e-wallet (demo)',async({page})=>{
  await register(page);
  const product=await addIngredient(page);
  await fillReceipt(page,product);await page.getByRole('button',{name:'Simpan barang masuk',exact:true}).click();await expect(page.locator('.inventory-editor')).toHaveCount(0);
  const s=await state(page);
  const menu=await(await page.request.post('/api/menus',{data:{name:'Nasi goreng',price:12000,aliases:['nasgor'],recipe:{[product.id]:50},catalogRevision:s.catalogRevision,preparation:{minutes:5,passiveMinutes:0,station:'dapur'},csrf:s.csrf}})).json();
  const s2=await state(page);
  const sale=await page.request.post('/api/transactions',{data:{items:[{id:menu.id,qty:5}],catalogRevision:s2.catalogRevision,paymentMethod:'qris',idempotencyKey:crypto.randomUUID(),csrf:s2.csrf}});
  expect(sale.status()).toBe(201);
  await page.goto('/#keuangan');await page.getByRole('button',{name:'Perbarui data',exact:true}).click();
  await expect(page.locator('#main h1')).toHaveText('Keuangan dan penarikan.');
  await expect(page.locator('.metrics')).toContainText('Rp 54.000');
  await page.getByLabel('Tujuan penarikan',{exact:true}).selectOption('ewallet');
  await page.getByLabel('Nomor rekening / e-wallet',{exact:true}).fill('0812-3456-7890');
  await page.getByLabel('Jumlah (Rp)',{exact:true}).fill('20000');
  await page.getByRole('button',{name:'Tarik ke bank / e-wallet',exact:true}).click();
  await expect(page.locator('.transactions')).toContainText('Berhasil (demo)');
  const fin=(await state(page)).finance;expect(fin.balance).toBe(34000);expect(fin.withdrawn).toBe(20000);
});
