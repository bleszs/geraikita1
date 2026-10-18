import {test,expect} from '@playwright/test';

test('logout reopens a closing IndexedDB connection and never restores the signed-out snapshot',async({page,context})=>{
  await page.addInitScript(()=>{
    const native=indexedDB.open.bind(indexedDB);window.deviceConnections=[];
    indexedDB.open=(...args)=>{const r=native(...args);r.addEventListener('success',()=>window.deviceConnections.push(r.result));return r;};
  });
  await page.goto('/');
  const response=await page.request.post('/api/auth/register',{data:{email:crypto.randomUUID()+'@example.test',password:'Storage-recovery-password',businessName:'Usaha penyimpanan',communityName:'Kelompok penyimpanan'}});
  expect(response.status()).toBe(201);await page.reload();await expect(page.locator('.active-business')).toBeVisible();
  await page.evaluate(async()=>{const {readSnapshot}=await import('/offline.js');await readSnapshot();deviceConnections.forEach(db=>db.close());});
  await page.locator('[data-action="logout"]').click();
  await expect(page.getByRole('heading',{name:'Kembali ke catatan usahamu.'})).toBeVisible();
  await expect(page.locator('#toast')).toBeHidden();await expect(page.locator('.guide-welcome')).toHaveCount(0);
  expect(await page.evaluate(async()=>{const {readSnapshot}=await import('/offline.js');return (await readSnapshot())===undefined;})).toBe(true);
  expect((await page.request.get('/api/bootstrap')).status()).toBe(401);
  await context.setOffline(true);await page.reload();await expect(page.locator('.active-business')).toHaveCount(0);
});

test('a failed device database open can recover without reloading the page',async({page})=>{
  await page.goto('/');
  expect(await page.evaluate(async()=>{
    const native=indexedDB.open.bind(indexedDB);let first=true;
    indexedDB.open=(...args)=>{if(first){first=false;throw new DOMException('blocked','SecurityError');}return native(...args);};
    const {readAction}=await import('/offline.js?retry-open-test');
    let safe=false;try{await readAction('isolated-test');}catch(error){safe=error.message.includes('Penyimpanan perangkat');}
    const recovered=await readAction('isolated-test');return safe&&recovered===undefined;
  })).toBe(true);
});
