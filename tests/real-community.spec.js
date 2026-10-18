import {test,expect} from '@playwright/test';

test('register without group, create an invitation and join it from a second independent business',async({page,browser})=>{
  await page.goto('/');await expect(page.getByLabel('Nama kelompok',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Kode kelompok',{exact:true})).toHaveCount(0);
  await page.getByLabel('Nama usaha',{exact:true}).fill('Pemilik kelompok browser');await page.getByLabel('Email',{exact:true}).fill(crypto.randomUUID()+'@example.test');await page.getByLabel('Kata sandi',{exact:true}).fill('Browser-group-password');await page.getByRole('button',{name:'Daftarkan usaha',exact:true}).click();await expect(page.locator('.active-business')).toBeVisible();
  await page.evaluate(async()=>{const data=await fetch('/api/bootstrap').then(r=>r.json()),{guideKey,emptyGuideProgress}=await import('/guide-state.js'),{scopeOf}=await import('/offline.js');localStorage.setItem(guideKey(scopeOf(data)),JSON.stringify({...emptyGuideProgress(),autoPageGuides:false}));});
  await page.goto('/#kelompok');await page.reload();await expect(page.getByRole('heading',{name:'Mulai beli bersama',exact:true})).toBeVisible();
  await page.getByText('Buat kelompok sendiri',{exact:true}).click();await page.getByLabel('Nama kelompok',{exact:true}).fill('Kelompok dari browser');await page.getByRole('button',{name:'Buat kelompok & kode',exact:true}).click();await expect(page.locator('.community-membership')).toBeVisible();
  const code=(await page.locator('.community-invite code').textContent()).trim();expect(code).toMatch(/^[A-F0-9]{10}$/);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4175'});
  try{
    const registration=await context.request.post('/api/auth/register',{data:{businessName:'Anggota browser',email:crypto.randomUUID()+'@example.test',password:'Browser-member-password'}});expect(registration.status()).toBe(201);
    const member=await context.newPage();await member.goto('/#kelompok');await member.getByLabel('Kode kelompok',{exact:true}).fill('WRONGCODE');await member.locator('[data-form="community-join"] input[name="confirmed"]').check();await member.getByRole('button',{name:'Gabung kelompok',exact:true}).click();await expect(member.locator('[data-form="community-join"] .form-error')).toContainText('tidak ditemukan');
    await member.getByLabel('Kode kelompok',{exact:true}).fill(code);await member.getByRole('button',{name:'Gabung kelompok',exact:true}).click();await expect(member.locator('.community-membership')).toContainText('Kamu anggota kelompok');await expect(member.locator('.community-membership')).toContainText('Kelompok dari browser');await expect(member.locator('.community-invite')).toHaveCount(0);
    const data=await member.request.get('/api/bootstrap').then(r=>r.json());expect(data.shared).toBe(false);expect(data.menu).toEqual([]);expect(data.transactions).toEqual([]);await member.reload();await expect(member.locator('.community-membership')).toContainText('Kamu anggota kelompok');
  }finally{await context.close();}
});

test('command submit stays near its input on desktop and phone; logo and Excel export are present',async({page})=>{
  const response=await page.request.post('/api/auth/register',{data:{businessName:'Tata letak browser',email:crypto.randomUUID()+'@example.test',password:'Browser-command-password'}});expect(response.status()).toBe(201);
  await page.goto('/#dapur');
  for(const width of [1440,360]){
    await page.setViewportSize({width,height:900});const form=page.locator('[data-form="kitchen-command"]');await expect(form).toBeVisible();
    const input=await form.locator('input').boundingBox(),button=await form.getByRole('button',{name:'Jalankan perintah',exact:true}).boundingBox();expect(button.y-input.y-input.height).toBeLessThanOrEqual(20);expect(button.y).toBeGreaterThanOrEqual(input.y+input.height);expect(button.height).toBeGreaterThanOrEqual(48);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:1440,height:900});await expect(page.locator('.brand img')).toHaveAttribute('src','/assets/logo.svg');
  await page.goto('/#riwayat');const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Ekspor penjualan CSV',exact:true}).click();const file=await downloaded;const stream=await file.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const text=Buffer.concat(chunks).toString('utf8');expect(text).toMatch(/^\uFEFFsep=;\r\n/);expect(text).toContain('"Tanggal";"Waktu";"Menu dan jumlah"');
});
