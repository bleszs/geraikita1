import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
test('owner can inspect learned model, public heldout prediction and input history without creating business data',async({page})=>{
  const registered=await page.request.post('/api/auth/register',{data:{businessName:'Uji tampilan kulakan',email:crypto.randomUUID()+'@example.test',password:'Kulakan-test-password'}});expect(registered.status()).toBe(201);
  const initial=await registered.json();await page.goto('/#restock');
  const section=page.locator('.kulakan-model');await expect(section.getByRole('heading',{name:'Model prediksi kulakan',exact:true})).toBeVisible();
  await expect(section).not.toHaveAttribute('open','');await section.locator(':scope>summary').click();
  await section.locator('.kulakan-evidence>summary').click();await expect(section).toContainText('bukan kg atau butir');
  const first=section.locator('.kulakan-case').first();await first.locator(':scope>summary').click();
  await expect(first.locator('.kulakan-comparison')).toContainText('Prediksi model');await expect(first.locator('.kulakan-comparison')).toContainText('Aktual dua hari');
  const actual=initial.kulakanModel.demonstration.cases[0];await expect(first.locator('dd').first()).toHaveText(new Intl.NumberFormat('id-ID',{maximumFractionDigits:4}).format(actual.predicted));
  await first.getByText('Periksa 14 hari masukan',{exact:true}).click();await expect(first.locator('tbody tr')).toHaveCount(14);
  await mkdir('.impeccable/review/kulakan-v55',{recursive:true});
  for(const [name,width,dark] of [['desktop',1440,false],['mobile',360,false],['mobile-dark',360,true]]){
    await page.setViewportSize({width,height:1000});if(dark)await page.getByRole('button',{name:'Ubah tema',exact:true}).click();
    await section.scrollIntoViewIfNeeded();await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();document.querySelector('#toast').hidden=true;});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'.impeccable/review/kulakan-v55/'+name+'.png',fullPage:true,animations:'disabled'});
  }
  const after=await page.request.get('/api/bootstrap').then(r=>r.json());expect(after.transactions).toEqual(initial.transactions);expect(after.catalog).toEqual(initial.catalog);expect(after.stock).toEqual(initial.stock);
});
