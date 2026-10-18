import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStore} from '../server/store.mjs';
import {createIdentity} from '../server/identity.mjs';
import {createService} from '../server/service.mjs';

const password = 'A-long-password-for-tests-773';
const registration = name => ({ businessName: name, communityName: 'Kelompok pengujian terisolasi', email: randomUUID() + '@example.test', password });

function setup() {
  const store = createStore(':memory:'), identity = createIdentity(store), service = createService(store);
  const s = identity.register(registration('Usaha bayar'));
  const flour = service.saveIngredient(s, null, { name: 'Tepung', unit: 'gram', min: 10, storageNote: '', catalogRevision: 1 });
  service.receive(s, { productId: flour.id, qty: 10, inputUnit: 'kg', unitPrice: 1000, supplier: '', idempotencyKey: randomUUID() });
  const menu = service.saveMenu(s, null, { name: 'Nasi goreng', price: 12000, aliases: ['nasgor'], recipe: { [flour.id]: 50 }, catalogRevision: service.bootstrap(s).catalogRevision, preparation: { minutes: 5, passiveMinutes: 0, station: 'dapur' } });
  return { store, service, s, menu, rev: () => service.bootstrap(s).catalogRevision };
}

test('each sale keeps the 10% application fee and credits net to the owner balance', () => {
  const { service, s, menu, rev } = setup();
  const sale = service.transaction(s, { items: [{ id: menu.id, qty: 2 }], catalogRevision: rev(), paymentMethod: 'qris', idempotencyKey: randomUUID() });
  assert.equal(sale.total, 24000); assert.equal(sale.fee, 2400); assert.equal(sale.net, 21600); assert.equal(sale.paymentMethod, 'qris');
  const f = service.finance(s);
  assert.equal(f.balance, 21600); assert.equal(f.today.gross, 24000); assert.equal(f.today.fee, 2400); assert.equal(f.today.net, 21600); assert.equal(f.today.byMethod.qris, 24000);
});

test('an unknown payment method is rejected', () => {
  const { service, s, menu, rev } = setup();
  assert.throws(() => service.transaction(s, { items: [{ id: menu.id, qty: 1 }], catalogRevision: rev(), paymentMethod: 'kartu', idempotencyKey: randomUUID() }), /Metode pembayaran/);
});

test('owner withdrawal reduces the balance; over-withdraw, bad destination and empty detail are rejected; the key is idempotent', () => {
  const { service, s, menu, rev } = setup();
  service.transaction(s, { items: [{ id: menu.id, qty: 5 }], catalogRevision: rev(), paymentMethod: 'tunai', idempotencyKey: randomUUID() });
  assert.equal(service.finance(s).balance, 54000);
  assert.throws(() => service.withdraw(s, { destinationType: 'bank', destinationDetail: '1234567', amount: 54001, idempotencyKey: randomUUID() }), /melebihi saldo/);
  assert.throws(() => service.withdraw(s, { destinationType: 'kartu', destinationDetail: '1234567', amount: 1000, idempotencyKey: randomUUID() }), /bank atau e-wallet/);
  assert.throws(() => service.withdraw(s, { destinationType: 'bank', destinationDetail: 'x', amount: 1000, idempotencyKey: randomUUID() }), /rekening/);
  const w = service.withdraw(s, { destinationType: 'ewallet', destinationDetail: '0812-3456-7890', amount: 20000, idempotencyKey: 'wd-key-123456' });
  assert.equal(w.amount, 20000);
  const f = service.finance(s);
  assert.equal(f.balance, 34000); assert.equal(f.withdrawn, 20000); assert.equal(f.withdrawals.length, 1); assert.equal(f.withdrawals[0].status, 'completed');
  assert.equal(service.withdraw(s, { destinationType: 'ewallet', destinationDetail: '0812-3456-7890', amount: 20000, idempotencyKey: 'wd-key-123456' }).duplicate, true);
  assert.equal(service.finance(s).balance, 34000);
});

test('bootstrap exposes finance to the owner and a cancelled sale leaves the balance', () => {
  const { service, s, menu, rev } = setup();
  const sale = service.transaction(s, { items: [{ id: menu.id, qty: 1 }], catalogRevision: rev(), paymentMethod: 'transfer', idempotencyKey: randomUUID() });
  assert.equal(service.bootstrap(s).finance.balance, 10800);
  service.cancelSale(s, sale.id);
  assert.equal(service.finance(s).balance, 0);
});
