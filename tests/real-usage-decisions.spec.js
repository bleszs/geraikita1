import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createApp } from '../server/http.mjs';
import { createExtractor } from '../server/extractor.mjs';
import { dayAt, addDays, units } from '../server/common.mjs';

let app, base;
test.beforeAll(async () => {
  app = createApp({ filename: ':memory:', extractor: createExtractor({ provider: 'rules' }), transcriber: { status: async () => ({ available: false }) } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + app.server.address().port;
});
test.afterEach(async ({page}) => { if(!page.isClosed())await page.goto('about:blank'); });
test.afterAll(async () => { if(app){const closing=app.close();app.server.closeAllConnections();await closing;} });
const date = () => addDays(dayAt(), -1);
const panel = page => page.locator('.usage-review');
async function setup(page) {
  const response = await page.request.post(base + '/api/auth/register', { data: { businessName: 'Tinjauan terisolasi', communityName: 'Kelompok browser', email: crypto.randomUUID() + '@example.test', password: 'Review-browser-password-456' } });
  expect(response.status()).toBe(201); const owner = await response.json();
  const saved = await page.request.post(base + '/api/ingredients', { data: { name: 'Tepung', unit: 'kg', min: 0, storageNote: '', catalogRevision: 1, csrf: owner.csrf } });
  const ingredient = await saved.json(); expect(saved.status()).toBe(201);
  for (let i = 0; i < 84; i++) app.store.run('INSERT INTO daily_usage VALUES(?,?,?,?,?)', owner.workspaceId, owner.business.id, ingredient.id, addDays(dayAt(), i - 84), units(i === 83 ? 60 : 10));
  await page.goto(base + '/#restock');await page.locator('.usage-review>summary').click();
  const skip = page.locator('.guide-welcome button').filter({ hasText: /^Lewati$/ }); if (await skip.count()) await skip.click();
  await expect(panel(page)).toContainText('1 tanggal perlu ditinjau');
  return { owner, ingredient, count: () => app.store.get('SELECT COUNT(*) AS n FROM usage_review_decisions WHERE workspace_id=? AND business_id=?', owner.workspaceId, owner.business.id).n };
}
async function open(page, saved = false) {
  await panel(page).locator('.usage-review-detail>summary').click();
  await panel(page).locator('.usage-finding').getByRole('button', { name: (saved ? 'Periksa kembali ' : 'Catat hasil pemeriksaan ') + date() + ' Tepung', exact: true }).click();
  await expect(page.locator('#usage-decision-title')).toBeFocused();
}
async function capture(page, name) {
  if (!process.env.CAPTURE_DECISIONS) return;
  await mkdir('.impeccable/review', { recursive: true });
  await expect(page.locator('#toast')).toBeHidden({timeout:8000});
  await page.evaluate(async () => { await document.fonts.ready; document.activeElement?.blur(); scrollTo(0, 0); });
  await page.screenshot({ path: '.impeccable/review/usage-decision-' + name + '.png', fullPage: true, animations: 'disabled' });
}
test('owner saves a reviewed date with escaped note, reloads it and keeps the statistical finding unchanged', async ({ page }) => {
  const f = await setup(page); await open(page);
  await page.getByLabel('Catatan pemeriksaan (opsional)').fill('Bukti cocok <img src=x onerror=alert(1)>');
  await page.getByLabel('Saya sudah memeriksa catatan tanggal ini.').check();
  await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, 'editor-desktop');
  await page.setViewportSize({ width: 320, height: 950 }); await capture(page, 'editor-mobile');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Ubah tema' }).click(); await capture(page, 'editor-mobile-dark');
  await page.getByRole('button', { name: 'Simpan hasil pemeriksaan', exact: true }).click();
  await expect(page.locator('#usage-decision-form')).toHaveCount(0); expect(f.count()).toBe(1);
  await page.reload(); await expect(panel(page)).toContainText('1 tanggal sudah diperiksa');
  await panel(page).locator(':scope>summary').click();
  await panel(page).locator('.usage-review-detail>summary').click();
  await expect(panel(page).locator('.usage-finding')).toContainText('Bukti cocok <img src=x onerror=alert(1)>');
  await expect(panel(page).locator('img')).toHaveCount(0); await expect(panel(page)).toContainText('1 tanggal perlu ditinjau');
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.getByRole('button', { name: 'Ubah tema' }).click(); await capture(page, 'saved-desktop');
  expect(app.store.get('SELECT quantity FROM daily_usage WHERE workspace_id=? AND business_id=? AND product_id=? AND date=?', f.owner.workspaceId, f.owner.business.id, f.ingredient.id, date()).quantity).toBe(units(60));
});
test('changed references invalidate saved decisions and a stale form preserves the unsaved note on conflict', async ({ page }) => {
  const f = await setup(page); await open(page);
  await page.getByLabel('Catatan pemeriksaan (opsional)').fill('Catatan yang belum dikirim');
  await page.getByLabel('Saya sudah memeriksa catatan tanggal ini.').check();
  app.store.run('UPDATE daily_usage SET quantity=? WHERE workspace_id=? AND business_id=? AND product_id=? AND date=?', units(12), f.owner.workspaceId, f.owner.business.id, f.ingredient.id, addDays(date(), -1));
  await page.getByRole('button', { name: 'Simpan hasil pemeriksaan', exact: true }).click();
  await expect(page.locator('#usage-decision-form [role="alert"]')).toContainText('pemakaian atau pembanding berubah');
  await expect(page.getByLabel('Catatan pemeriksaan (opsional)')).toHaveValue('Catatan yang belum dikirim'); expect(f.count()).toBe(0);
  await page.getByRole('button', { name: 'Tutup tanpa menyimpan', exact: true }).click();
  await page.getByRole('button', { name: 'Perbarui data', exact: true }).click(); await open(page);
  await page.getByLabel('Hasil tinjauan').selectOption('follow_up');
  await page.getByLabel('Catatan pemeriksaan (opsional)').fill('Periksa bukti penerimaan');
  await page.getByLabel('Saya sudah memeriksa catatan tanggal ini.').check(); await page.getByRole('button', { name: 'Simpan hasil pemeriksaan', exact: true }).click();
  await expect(panel(page)).toContainText('1 perlu tindak lanjut');
  app.store.run('UPDATE daily_usage SET quantity=? WHERE workspace_id=? AND business_id=? AND product_id=? AND date=?', units(10), f.owner.workspaceId, f.owner.business.id, f.ingredient.id, addDays(date(), -1));
  await page.getByRole('button', { name: 'Perbarui data', exact: true }).click(); await expect(panel(page)).toContainText('1 hasil perlu diperiksa ulang');
  await panel(page).locator('.usage-review-detail>summary').click(); await expect(panel(page)).toContainText('Data berubah — periksa lagi');
  await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, 'stale-desktop');
  await page.setViewportSize({ width: 320, height: 950 }); await capture(page, 'stale-mobile');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(f.count()).toBe(1);
});
test('offline form never submits automatically, retains its text and can be closed', async ({ page, context }) => {
  const f = await setup(page); await open(page); await page.getByLabel('Catatan pemeriksaan (opsional)').fill('Tetap di formulir');
  await context.setOffline(true); await expect(page.getByRole('button', { name: 'Simpan hasil pemeriksaan', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Catatan pemeriksaan (opsional)')).toHaveValue('Tetap di formulir');
  await page.setViewportSize({ width: 320, height: 950 }); await capture(page, 'offline-mobile');
  await context.setOffline(false); expect(f.count()).toBe(0);
  await page.getByRole('button', { name: 'Hubungkan & muat ulang', exact: true }).click();
  await expect(page.getByLabel('Catatan pemeriksaan (opsional)')).toHaveValue('Tetap di formulir');
  await expect(page.getByRole('button', { name: 'Simpan hasil pemeriksaan', exact: true })).toBeEnabled(); expect(f.count()).toBe(0);
  await page.getByRole('button', { name: 'Tutup tanpa menyimpan', exact: true }).click(); await expect(page.locator('#usage-decision-form')).toHaveCount(0);
});
test('a lost save response is reconciled by explicit retry with the same request key', async ({ page }) => {
  const f = await setup(page); await open(page); await page.getByLabel('Catatan pemeriksaan (opsional)').fill('Respons hilang');
  await page.getByLabel('Saya sudah memeriksa catatan tanggal ini.').check();
  await page.route('**/api/usage-reviews', async route => { await route.fetch(); await route.abort('failed'); });
  await page.getByRole('button', { name: 'Simpan hasil pemeriksaan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hubungkan & muat ulang', exact: true })).toBeVisible(); expect(f.count()).toBe(1);
  await page.unroute('**/api/usage-reviews'); await page.getByRole('button', { name: 'Hubungkan & muat ulang', exact: true }).click();
  await expect(page.getByLabel('Catatan pemeriksaan (opsional)')).toHaveValue('Respons hilang');
  await page.getByRole('button', { name: 'Simpan hasil pemeriksaan', exact: true }).click();
  await expect(page.locator('#usage-decision-form')).toHaveCount(0); expect(f.count()).toBe(1);
});
