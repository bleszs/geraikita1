// Explicit opt-in presentation data. Never imported by the production server.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';
import { createService } from '../server/service.mjs';
import { createIdentity } from '../server/identity.mjs';
import { addDays, dayAt, units, quantity } from '../server/common.mjs';
import { usage } from '../public/catalog.js';

export const DEMO_ACCOUNT = Object.freeze({ email: 'demo@geraikita.test', password: 'GeraiKitaDemo2026!', businessName: '[DEMO] Kedai Bu Sari' });
export const demoDirectory = () => path.resolve('data/demo/presentation-' + dayAt());
const RealDate = Date;
function at(date, hour, operation) {
  const stamp = RealDate.parse(date + 'T' + String(hour).padStart(2, '0') + ':00:00+07:00');
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [stamp])); } static now() { return stamp; } };
  try { return operation(); } finally { globalThis.Date = RealDate; }
}
function simulatedMember(store, workspaceId, name) {
  const id = randomUUID();
  store.atomic(() => {
    store.run('INSERT INTO businesses VALUES(?,?,?,?,?)', workspaceId, id, name, name, 'D');
    store.run('INSERT INTO business_state VALUES(?,?,1,0)', workspaceId, id);
    store.run("INSERT INTO demands(workspace_id,business_id,qty,active,budget,expires_at,approved_version,decision,stock_revision) VALUES(?,?,0,0,NULL,0,NULL,'pending',0)", workspaceId, id);
    store.log(workspaceId, id, 'DEMO: anggota simulasi untuk presentasi, tanpa akun login atau izin usaha nyata.');
  });
  return { workspace_id: workspaceId, business_id: id };
}

export function inspectDemo(store, owner) {
  const state = createService(store).bootstrap(owner);
  assert.equal(store.get('SELECT COUNT(*) AS n FROM accounts').n, 1, 'Demo hanya boleh mempunyai satu akun login.');
  assert.equal(store.get('PRAGMA integrity_check').integrity_check, 'ok');
  assert.deepEqual(store.all('PRAGMA foreign_key_check'), []);
  for (const item of store.all('SELECT * FROM inventory')) {
    const ledger = store.get('SELECT COALESCE(SUM(delta),0) AS qty FROM movements WHERE workspace_id=? AND business_id=? AND product_id=?', item.workspace_id, item.business_id, item.product_id).qty;
    assert.equal(item.quantity, ledger, 'Saldo harus cocok dengan ledger pergerakan.');
  }
  for (const row of store.all('SELECT * FROM daily_usage WHERE business_id=?', owner.business_id)) {
    const sales = store.all('SELECT usage_snapshot FROM sales WHERE workspace_id=? AND business_id=? AND date=? AND cancelled_at IS NULL', owner.workspace_id, owner.business_id, row.date);
    const consumed = sales.reduce((sum, sale) => sum + units(JSON.parse(sale.usage_snapshot)[row.product_id] || 0), 0);
    assert.equal(row.quantity, consumed, 'Histori bahan harus berasal dari resep penjualan aktif.');
  }
  return { accounts: 1, simulatedMembersWithoutLogin: 2, ingredients: state.catalog.length, menus: state.menu.length,
    sales: store.get('SELECT COUNT(*) AS n FROM sales WHERE business_id=?', owner.business_id).n,
    historicalCompleteDays: 84, todayTransactions: state.transactions.filter(row => row.date === dayAt() && !row.cancelled_at).length,
    receipts: state.stockReceipts.length, reviewDecisions: store.get('SELECT COUNT(*) AS n FROM usage_review_decisions').n,
    reviewCandidates: state.recommendations.reduce((sum, row) => sum + row.usageScreening.summary.reviewCandidates, 0),
    groupParticipants: state.group.count, groupVisible: state.group.visible, groupEligible: state.group.eligible,
    completedCollectiveCycles: state.collectiveHistory.filter(row => row.status === 'completed').length,
    activeSurplusOffers: state.offers.filter(row => row.available > 0).length,
    completedSurplusTransfers: state.transfers.filter(row => row.status === 'completed').length,
    pendingSurplusTransfers: state.transfers.filter(row => row.status === 'pending').length,
    ledgerConsistent: true, foreignKeysValid: true, trainedModelActivated: state.recommendations.some(row => row.trainedModel?.status === 'active') };
}

export function buildPresentationDemo(directory) {
  const folder = path.resolve(directory), filename = path.join(folder, 'gerai-kita-demo.sqlite'), manifestFile = path.join(folder, 'account.json');
  if (existsSync(filename) || existsSync(manifestFile)) throw new Error('Folder demo sudah berisi data. Pilih folder baru; data yang sudah dipakai tidak ditimpa.');
  mkdirSync(folder, { recursive: true }); closeSync(openSync(filename, 'wx', 0o600));
  const store = createStore(filename), service = createService(store), identity = createIdentity(store), asOf = dayAt(), start = addDays(asOf, -84);
  try {
    const owner = at(start, 7, () => identity.register({ ...DEMO_ACCOUNT, communityName: '[DEMO] Kelompok Kulakan Dapur' }));
    store.run("UPDATE workspaces SET settings=json_set(settings,'$.forecastDataSource','synthetic_demo') WHERE id=?",owner.workspace_id);
    const peers = [simulatedMember(store, owner.workspace_id, '[SIMULASI] Warung Pak Budi'), simulatedMember(store, owner.workspace_id, '[SIMULASI] Dapur Mbak Rina')];
    const actors = [owner, ...peers], ingredients = {};
    const definitions = [
      ['rice', 'Beras', 'kg', 6, 12000, 12], ['chicken', 'Ayam', 'kg', 3, 36000, 1], ['eggs', 'Telur', 'butir', 24, 2200, 12],
      ['oil', 'Minyak goreng', 'liter', 2, 18000, 1.3], ['flour', 'Tepung terigu', 'kg', 2, 13000, 2.7],
      ['sugar', 'Gula pasir', 'kg', 2, 17000, 3], ['coffee', 'Kopi bubuk', 'kg', .5, 95000, .8], ['milk', 'Susu UHT', 'liter', 3, 20000, 4.5]
    ];
    at(start, 7, () => {
      for (const [key, name, unit, min] of definitions) ingredients[key] = service.saveIngredient(owner, null, { name, unit, min,
        storageNote: 'SIMULASI DEMO: simpan sesuai kondisi kemasan dan periksa sebelum dipakai.', catalogRevision: store.get('SELECT catalog_revision FROM business_state WHERE workspace_id=? AND business_id=?', owner.workspace_id, owner.business_id).catalog_revision }).id;
    });
    const quote = () => service.saveQuote(owner, { supplier: '[SIMULASI] Grosir Pangan Sejahtera', productName: 'Beras', unit: 'kg', unitPrice: 12000,
      shipping: 18000, minimum: 10, individualPrice: 14000, individualShipping: 10000, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() });
    at(start, 7, quote);
    const recipes = [
      ['nasiAyam', 'Nasi ayam', 18000, ['nasiayam'], { rice: .12, chicken: .1, oil: .015 }],
      ['nasiTelur', 'Nasi telur', 14000, ['nastel'], { rice: .12, eggs: 1, oil: .01 }],
      ['ayamKrispi', 'Ayam krispi', 16000, ['ayam crispy'], { chicken: .15, flour: .04, oil: .025 }],
      ['kopiSusu', 'Kopi susu', 12000, ['kopsu'], { coffee: .012, sugar: .015, milk: .12 }],
      ['telurDadar', 'Telur dadar', 10000, ['dadar'], { eggs: 2, oil: .01 }],
      ['kopiHitam', 'Kopi hitam', 8000, ['kopi tubruk'], { coffee: .01, sugar: .01 }]
    ], menuIds = {};
    at(start, 7, () => {
      for (const [key, name, price, aliases, recipe] of recipes) menuIds[key] = service.saveMenu(owner, null, { name, price, aliases,
        recipe: Object.fromEntries(Object.entries(recipe).map(([key, qty]) => [ingredients[key], qty])),
        catalogRevision: store.get('SELECT catalog_revision FROM business_state WHERE workspace_id=? AND business_id=?', owner.workspace_id, owner.business_id).catalog_revision }).id;
    });
    const menu = store.menus(owner), revision = store.get('SELECT catalog_revision FROM business_state WHERE workspace_id=? AND business_id=?', owner.workspace_id, owner.business_id).catalog_revision;
    const item = (key, qty) => ({ id: menuIds[key], qty, note: 'SIMULASI untuk penjelasan aplikasi' });
    const days = Array.from({ length: 85 }, (_, index) => {
      const date = addDays(start, index), yesterday = date === addDays(asOf, -1), coffeeEvent = date === addDays(asOf, -2), closed = date === addDays(asOf, -4);
      let orders = closed ? [] : [
        [item('nasiAyam', yesterday ? 45 : 10 + index % 4), item('nasiTelur', yesterday ? 35 : 6 + index % 3), item('ayamKrispi', 4 + index % 3)],
        [item('kopiSusu', coffeeEvent ? 55 : 12 + index % 5), item('telurDadar', 3 + index % 2), item('kopiHitam', 6 + index % 4)]
      ];
      if (date === asOf) orders = [[item('nasiAyam', 3), item('kopiSusu', 2)], [item('nasiTelur', 4)], [item('ayamKrispi', 2), item('kopiHitam', 3)],
        [item('nasiAyam', 2), item('telurDadar', 1)], [item('kopiSusu', 5)], [item('nasiTelur', 2), item('kopiHitam', 2)]];
      return { date, orders };
    });
    for (let first = 0; first < days.length; first += 7) {
      const week = days.slice(first, first + 7), totals = Object.fromEntries(definitions.map(([key]) => [ingredients[key], 0]));
      for (const day of week) for (const order of day.orders) for (const [id, qty] of Object.entries(usage(order, menu))) totals[id] += units(qty);
      at(week[0].date, 8, () => {
        for (const [key, , unit, , unitPrice, closing] of definitions) service.receive(owner, { productId: ingredients[key], inputUnit: unit,
          qty: quantity(totals[ingredients[key]]) + (first + 7 >= days.length ? closing : 0), unitPrice,
          supplier: '[SIMULASI] Belanja bahan mingguan', idempotencyKey: randomUUID() });
      });
      for (const day of week) {
        day.orders.forEach((items, index) => at(day.date, 10 + index, () => service.transaction(owner, { items, catalogRevision: revision, idempotencyKey: randomUUID() })));
        // Explicit closed/unused zero days in this synthetic complete calendar only.
        for (const [key] of definitions) store.run('INSERT OR IGNORE INTO daily_usage VALUES(?,?,?,?,0)', owner.workspace_id, owner.business_id, ingredients[key], day.date);
        if (!day.orders.length) at(day.date, 17, () => store.log(owner.workspace_id, owner.business_id, 'DEMO: hari tutup simulasi; pemakaian semua bahan dicatat nol secara eksplisit.'));
      }
    }
    // Demonstrate a completed first purchasing cycle using normal service guards.
    at(addDays(asOf, -3), 17, () => {
      quote(); actors.forEach((actor, index) => service.demand(actor, { qty: [5, 6, 4][index], active: true, budget: 300000 }));
      const plan = service.group(owner); actors.forEach(actor => service.approval(actor, { version: plan.version, decision: 'accepted' }));
      const order = service.finalizeCollective(owner, { cycle: plan.cycle.id, version: plan.version });
      for (const actor of actors) { const part = service.group(actor).own; service.receiveCollective(actor, order.id, { qty: part.order, idempotencyKey: randomUUID() }); }
      const completed = service.group(owner); service.nextCycle(owner, { cycle: completed.cycle.id, version: completed.version });
    });
    // A few reversible records and current surplus scenarios, all still isolated.
    const cancelled = service.transaction(owner, { items: [item('kopiHitam', 1)], catalogRevision: revision, idempotencyKey: randomUUID() });
    service.cancelSale(owner, cancelled.id);
    const cancelledReceipt = service.receive(owner, { productId: ingredients.sugar, qty: 1, unitPrice: 17000, supplier: '[SIMULASI] Contoh salah catat', idempotencyKey: randomUUID() });
    service.cancelReceipt(owner, cancelledReceipt.id, { reason: 'SIMULASI: jumlah penerimaan salah dan dikoreksi.' });
    quote(); actors.forEach((actor, index) => service.demand(actor, { qty: [8, 5, 7][index], active: true, budget: 300000 }));
    const peerOffer = service.createOffer(peers[0], { productId: ingredients.rice, qty: 4, unitPrice: 10500, condition: 'SIMULASI: kemasan utuh, disimpan kering, ambil sebelum batas waktu.', expiresInHours: 24, cycle: 2, idempotencyKey: randomUUID() });
    const transfer = service.requestTransfer(owner, peerOffer.id, { qty: 1 }); service.transferDecision(peers[0], transfer.id, true);
    const myOffer = service.createOffer(owner, { productId: ingredients.rice, qty: 2, unitPrice: 11000, condition: 'SIMULASI: kelebihan beras dalam wadah tertutup dan kering.', expiresInHours: 24, cycle: 2, idempotencyKey: randomUUID() });
    service.requestTransfer(peers[1], myOffer.id, { qty: 1 });
    actors.forEach((actor, index) => service.demand(actor, { qty: [8, 5, 7][index], active: true, budget: 300000 }));
    const current = service.group(owner); peers.forEach(actor => service.approval(actor, { version: current.version, decision: 'accepted' }));
    const recommendations = service.bootstrap(owner).recommendations;
    const riceDate = recommendations.find(row => row.productId === ingredients.rice).usageScreening.results.find(row => row.date === addDays(asOf, -1));
    for (const [id, date, decision, note] of [
      [ingredients.rice, riceDate.date, 'follow_up', 'SIMULASI: cocokkan lonjakan dengan pesanan katering dan bukti pemakaian.'],
      [ingredients.milk, addDays(asOf, -2), 'checked', 'SIMULASI: pesanan kopi dalam jumlah besar sudah dicocokkan.']
    ]) {
      const row = service.bootstrap(owner).usageReviews.find(row => row.productId === id).dates.find(row => row.date === date);
      service.saveUsageReview(owner, { productId: id, date, decision, note, confirmed: true, snapshotHash: row.snapshotHash, expectedReviewId: null, idempotencyKey: randomUUID() });
    }
    store.log(owner.workspace_id, owner.business_id, 'DEMO PRESENTASI: semua harga, penjualan, anggota dan persetujuan adalah simulasi atas permintaan pengguna; bukan data atau hasil evaluasi lapangan.');
    const counts = inspectDemo(store, owner);
    assert.equal(counts.trainedModelActivated, false); assert.equal(counts.groupVisible, true); assert.equal(counts.groupEligible, true);
    const manifest = { kind: 'user-requested-synthetic-presentation-demo-v1', createdAt: new Date().toISOString(), asOf, filename,
      account: DEMO_ACCOUNT, owner: { workspaceId: owner.workspace_id, businessId: owner.business_id }, counts,
      trainingAllowed: false, fieldAccuracyClaim: false, productionDataTouched: false,
      note: 'Exactly one login account and two clearly labelled simulated businesses without login. This database is presentation-only; do not use its records or operational reviews as real training/evaluation evidence.' };
    writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return manifest;
  } finally { store.close(); }
}

export function preparePresentationDemo(directory = demoDirectory()) {
  const folder = path.resolve(directory), manifestFile = path.join(folder, 'account.json');
  if (!existsSync(manifestFile)) return buildPresentationDemo(folder);
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  assert.equal(manifest.kind, 'user-requested-synthetic-presentation-demo-v1');
  assert.equal(path.resolve(manifest.filename), path.join(folder, 'gerai-kita-demo.sqlite'));
  assert(existsSync(manifest.filename), 'Database demo hilang. Manifest yang ada tidak dipakai untuk membuat ulang data secara diam-diam.');
  const store = createStore(manifest.filename);
  try {
    const owner = createIdentity(store).login(manifest.account);
    store.run('DELETE FROM sessions WHERE id=?', owner.id);
    assert.equal(store.get('SELECT COUNT(*) AS n FROM accounts').n, 1);
  } finally { store.close(); }
  return manifest;
}
