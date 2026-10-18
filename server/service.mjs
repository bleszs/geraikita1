import {createKitchen} from './kitchen.mjs';
import {createOrderRequests} from './order-requests.mjs';
import { randomUUID, createHash } from 'node:crypto';
import { total, usage } from '../public/catalog.js';
import { createOperations } from './operations.mjs';
import { createCollective } from './collective.mjs';
import { createSurplus } from './surplus.mjs';
import {createConfiguration} from './configuration.mjs';
import { requireValue, dayAt, units, quantity, PAYMENT_METHODS, applicationFee } from './common.mjs';
import { forecast } from './forecast.mjs';
import { optimize } from './optimizer.mjs';
import {createForecastRegistry} from './forecast-registry.mjs';
import {screenUsage} from './ml/usage-anomalies.mjs';
import {screenDrift} from './ml/usage-drift.mjs';
import {createUsageDecisions} from './usage-decisions.mjs';

export function createService(store) {
  const usageDecisions=createUsageDecisions(store);
  const models=createForecastRegistry();
  const { run, get, all, atomic, log, movement } = store;
  const scope = s => [s.workspace_id, s.business_id];
  function bump(s) { run('UPDATE workspaces SET version=version+1 WHERE id=?', s.workspace_id); run("UPDATE demands SET approved_version=NULL,decision='pending' WHERE workspace_id=?", s.workspace_id); }
  function stockChanged(s) {
    run('UPDATE business_state SET stock_revision=stock_revision+1 WHERE workspace_id=? AND business_id=?', ...scope(s));
    const demand = get('SELECT * FROM demands WHERE workspace_id=? AND business_id=?', ...scope(s));
    if (!cycles.locked(s) && demand.active && demand.expires_at > Date.now()) bump(s);
  }
  const operations = createOperations(store, stockChanged);
  const cycles = createCollective(store, { group, bump, stockChanged, available:operations.available });
  const configuration=createConfiguration(store,{cycles,bump});
  const surplus = createSurplus(store, {cycles,available:operations.available});
  const kitchen=store.attribute(createKitchen(store,{available:operations.available,stockChanged}));
  const requests=store.attribute(createOrderRequests(store,{kitchen}));
  function receipts(s) {
    return all(`SELECT t.*,o.unit_price FROM transfers t JOIN offers o ON t.offer_id=o.id WHERE t.workspace_id=? AND t.receiver_id=? AND t.status='completed' AND t.cycle=?`, ...scope(s), cycles.context(s).id);
  }
  function group(s) {
    const frozen = cycles.frozenGroup(s); if (frozen) return frozen;
    const workspace = get('SELECT * FROM workspaces WHERE id=?', s.workspace_id);
    const members = all('SELECT d.*,b.name,st.stock_revision AS current_stock_revision FROM demands d JOIN businesses b ON b.workspace_id=d.workspace_id AND b.id=d.business_id JOIN business_state st ON st.workspace_id=d.workspace_id AND st.business_id=d.business_id WHERE d.workspace_id=? ORDER BY b.id', s.workspace_id).map(d => {
      const transfers = receipts({ ...s, business_id: d.business_id });
      return { businessId: d.business_id, name: d.name, qty: d.qty, active: !!d.active, budget: d.budget, expiresAt: d.expires_at, approvedVersion: d.approved_version, decision: d.decision,
        needsReview: d.stock_revision !== d.current_stock_revision, received: transfers.reduce((sum, t) => sum + t.qty, 0), surplusCost: transfers.reduce((sum, t) => sum + t.qty * t.unit_price, 0) };
    });
    return {...optimize(members, s.business_id, workspace.version, workspace.quote_expires,Date.now(),workspace.quote_json ? JSON.parse(workspace.quote_json) : null), frozen:false, cycle:{id:workspace.active_cycle,status:'planning',canAdvance:!!workspace.quote_json && Date.now() >= workspace.quote_expires && !cycles.pending(s)},pendingTransfers:cycles.pending(s)};
  }
  function bootstrap(s) {
    const catalog=store.ingredients(s);
    const row=get('SELECT * FROM businesses WHERE workspace_id=? AND id=?',...scope(s));
    const business={id:row.id,name:row.name,shortName:row.short_name,letter:row.letter};
    const businessState = get('SELECT * FROM business_state WHERE workspace_id=? AND business_id=?', ...scope(s));
    const stock = Object.fromEntries(all('SELECT * FROM inventory WHERE workspace_id=? AND business_id=?', ...scope(s)).map(i => [i.product_id, quantity(i.quantity)]));
    const availableStock = Object.fromEntries(catalog.map(p => [p.id, quantity(operations.available(s, p.id))]));
    const transactions = all('SELECT * FROM sales WHERE workspace_id=? AND business_id=? ORDER BY created_at DESC,id DESC', ...scope(s)).map(t => ({ ...t, items: JSON.parse(t.items), time: new Date(t.created_at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }), label: t.cancelled_at ? 'Transaksi dibatalkan' : 'Pesanan terkonfirmasi' }));
    const asOf = dayAt();
    const recommendations = catalog.map(p => {
      const history = all('SELECT date,quantity FROM daily_usage WHERE workspace_id=? AND business_id=? AND product_id=? ORDER BY date', ...scope(s), p.id)
        .map(i => ({ date: i.date, qty: quantity(i.quantity) }));
      return { productId: p.id, ...forecast(history, availableStock[p.id], asOf, 2, p.unit,
        models.get({workspaceId:s.workspace_id,businessId:s.business_id,productId:p.id,unit:p.unit})),
        usageScreening: screenUsage(history, {asOf, unit:p.unit}),
        driftScreening: screenDrift(history, {asOf, unit:p.unit}) };
    });
    const ownDemand = get('SELECT * FROM demands WHERE workspace_id=? AND business_id=?', ...scope(s));
    const offers = surplus.offers(s);
    const transfers = all('SELECT t.*,o.owner_id,o.unit_price,b.name AS receiver_name FROM transfers t JOIN offers o ON t.offer_id=o.id JOIN businesses b ON b.workspace_id=t.workspace_id AND b.id=t.receiver_id WHERE t.workspace_id=? AND (t.receiver_id=? OR o.owner_id=?) ORDER BY t.created_at DESC', ...scope(s), s.business_id);
    const audit = all('SELECT message,created_at,actor_id,actor_name,actor_role,actor_revision FROM audit WHERE workspace_id=? AND business_id=? ORDER BY rowid DESC LIMIT 100', ...scope(s)).map(a => ({ ...a, actor:a.actor_id?{id:a.actor_id,name:a.actor_name,role:a.actor_role,revision:a.actor_revision}:null, time: new Date(a.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) }));
    const stockReceipts = all('SELECT * FROM stock_receipts WHERE workspace_id=? AND business_id=? ORDER BY created_at DESC', ...scope(s)).map(r => ({ ...r, qty: quantity(r.quantity) }));
    const movements = all('SELECT product_id,delta,reason,ref,created_at FROM movements WHERE workspace_id=? AND business_id=? ORDER BY rowid DESC LIMIT 100', ...scope(s)).map(m => ({ ...m, qty: quantity(m.delta) }));
    const workspace = get('SELECT * FROM workspaces WHERE id=?', s.workspace_id);
    const sharedProduct=JSON.parse(workspace.settings || '{}').product || null;
    return { kitchen:kitchen.snapshot(s), mode: 'live', workspaceId: s.workspace_id, workspaceEpoch: workspace.created_at, business, community:{name:workspace.name,canManage:workspace.owner_business_id===s.business_id,inviteCode:workspace.owner_business_id===s.business_id ? workspace.join_code : null}, sharedProduct, catalog, menu: store.menus(s), catalogRevision: businessState.catalog_revision, stock, availableStock, stockReceipts, movements, transactions, recommendations, usageReviews:usageDecisions.list(s,recommendations), demand: ownDemand.qty || recommendations.find(r=>r.productId===sharedProduct?.id)?.amount || null, shared: !!ownDemand.active && ownDemand.expires_at > Date.now(), needsReview: !cycles.locked(s) && ownDemand.stock_revision !== businessState.stock_revision, budget: ownDemand.budget, group: group(s), collectiveHistory:cycles.history(s), offers, transfers, audit, finance: finance(s), date: dayAt(), csrf: s.csrf };
  }
  function transaction(s, body) {
    requireValue(typeof body.idempotencyKey === 'string' && body.idempotencyKey.length >= 8 && body.idempotencyKey.length <= 100, 'Kunci transaksi tidak valid.');
    requireValue(Array.isArray(body.items) && body.items.length >= 1 && body.items.length <= 20, 'Isi minimal satu menu.');
    const paymentMethod = body.paymentMethod ?? 'tunai';
    requireValue(PAYMENT_METHODS.includes(paymentMethod), 'Metode pembayaran tidak dikenal.');
    const items = body.items.map(i => {
      requireValue(i && typeof i === 'object' && !Array.isArray(i), 'Item menu tidak valid.');
      requireValue(typeof i.id === 'string' && Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 99, 'Menu atau jumlah tidak valid.');
      requireValue(!i.note || (typeof i.note === 'string' && i.note.length <= 500), 'Catatan maksimal 500 karakter.');
      return { id: i.id, qty: i.qty, note: i.note || '' };
    });
    const fingerprint = createHash('sha256').update(JSON.stringify(items)).digest('hex');
    return atomic(() => {
      const previous = get('SELECT * FROM sales WHERE workspace_id=? AND business_id=? AND idem=?', ...scope(s), body.idempotencyKey);
      if (previous) { requireValue(previous.fingerprint === fingerprint, 'Kunci transaksi sudah dipakai untuk pesanan berbeda.', 409); return { id: previous.id, items: JSON.parse(previous.items), total: previous.total, duplicate: true }; }
      const menus = store.menus(s);
      const catalog=store.ingredients(s);
      requireValue(items.every(i => menus.some(m => m.id === i.id)), 'Menu atau jumlah tidak valid.');
      const currentRevision = get('SELECT catalog_revision FROM business_state WHERE workspace_id=? AND business_id=?', ...scope(s)).catalog_revision;
      requireValue(body.catalogRevision === currentRevision, 'Katalog menu berubah. Muat ulang dan periksa harga serta resep terbaru sebelum konfirmasi.', 409);
      const used = usage(items, menus); const id = randomUUID(); const date = dayAt(); const now = new Date().toISOString();
      for (const [product, qty] of Object.entries(used)) {
        const stock = get('SELECT quantity FROM inventory WHERE workspace_id=? AND business_id=? AND product_id=?', ...scope(s), product);
        const reserved = get("SELECT COALESCE(SUM(t.qty),0) AS qty FROM transfers t JOIN offers o ON o.id=t.offer_id WHERE o.workspace_id=? AND o.owner_id=? AND o.product_id=? AND t.status='pending' AND o.expires_at>?", ...scope(s), product, Date.now()).qty;
        requireValue(operations.available(s,product) >= units(qty), `Stok ${catalog.find(p => p.id === product).name.toLowerCase()} tidak cukup atau sedang dicadangkan untuk surplus.`, 409);
        run('UPDATE inventory SET quantity=quantity-? WHERE workspace_id=? AND business_id=? AND product_id=?', units(qty), ...scope(s), product);
        run('INSERT INTO daily_usage VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,business_id,product_id,date) DO UPDATE SET quantity=quantity+excluded.quantity', ...scope(s), product, date, units(qty));
        movement(...scope(s), product, -qty, 'sale', id);
      }
      const snapshots = items.map(i => { const m = menus.find(m => m.id === i.id); return { ...i, name: m.name, unitPrice: m.price }; });
      const gross = total(snapshots, menus), fee = applicationFee(gross), net = gross - fee;
      run('INSERT INTO sales(id,workspace_id,business_id,idem,fingerprint,items,total,date,created_at,cancelled_at,usage_snapshot,payment_method,fee,net) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', id, ...scope(s), body.idempotencyKey, fingerprint, JSON.stringify(snapshots), gross, date, now, null, JSON.stringify(used), paymentMethod, fee, net);
      stockChanged(s);
      log(...scope(s), `Transaksi ${id.slice(0, 8)} dikonfirmasi; stok berkurang sesuai resep.`);
      return { id, items: snapshots, total: gross, fee, net, paymentMethod, duplicate: false };
    });
  }
  function cancelSale(s, id) {
    return atomic(() => {
      const sale = get('SELECT * FROM sales WHERE id=? AND workspace_id=? AND business_id=?', id, ...scope(s));
      requireValue(sale, 'Transaksi tidak ditemukan.', 404);
      requireValue(!get('SELECT id FROM kitchen_orders WHERE workspace_id=? AND business_id=? AND sale_id=?',...scope(s),id),'Pesanan dapur sudah selesai; bahan terpakai tidak dapat dikembalikan lewat pembatalan penjualan lama.',409);
      if (sale.cancelled_at) return { duplicate: true };
      requireValue(sale.fingerprint !== 'seed', 'Transaksi histori sintetis tidak dapat dibatalkan.');
      for (const [product, qty] of Object.entries(JSON.parse(sale.usage_snapshot))) {
        run('UPDATE inventory SET quantity=quantity+? WHERE workspace_id=? AND business_id=? AND product_id=?', units(qty), ...scope(s), product);
        run('UPDATE daily_usage SET quantity=quantity-? WHERE workspace_id=? AND business_id=? AND product_id=? AND date=?', units(qty), ...scope(s), product, sale.date);
        movement(...scope(s), product, qty, 'reversal', id);
      }
      run('UPDATE sales SET cancelled_at=? WHERE id=?', new Date().toISOString(), id);
      stockChanged(s);
      log(...scope(s), `Transaksi ${id.slice(0, 8)} dibatalkan; stok dikembalikan.`); return { duplicate: false };
    });
  }
  function demand(s, body) {
    requireValue(typeof body.active === 'boolean', 'Pilih persetujuan berbagi kebutuhan.');
    requireValue(Number.isInteger(body.qty) && body.qty >= 1 && body.qty <= 100,'Jumlah kebutuhan harus 1–100 satuan.');
    requireValue(body.budget == null || (Number.isInteger(body.budget) && body.budget >= 1 && body.budget <= 10000000), 'Anggaran harus berupa rupiah positif.');
    return atomic(() => {
      requireValue(!cycles.locked(s),'Rencana penerimaan sudah disimpan. Kebutuhan dapat dibagikan lagi pada siklus berikutnya.',409);
      const received = receipts(s).reduce((sum, t) => sum + t.qty, 0);
      requireValue(body.qty >= received, `Sudah menerima ${received} satuan surplus. Kebutuhan minimal ${received} satuan.`);
      const old = get('SELECT * FROM demands WHERE workspace_id=? AND business_id=?', ...scope(s));
      const stockRevision = get('SELECT stock_revision FROM business_state WHERE workspace_id=? AND business_id=?', ...scope(s)).stock_revision;
      if (old.qty !== body.qty || !!old.active !== body.active || old.budget !== (body.budget ?? null) || old.expires_at <= Date.now() || old.stock_revision !== stockRevision) {
        run('UPDATE demands SET qty=?,active=?,budget=?,expires_at=?,stock_revision=? WHERE workspace_id=? AND business_id=?', body.qty, Number(body.active), body.budget ?? null, Date.now() + 86400000, stockRevision, ...scope(s)); bump(s);
        log(...scope(s), body.active ? `Kebutuhan ${body.qty} satuan dibagikan selama 24 jam. Persetujuan proposal diperbarui.` : 'Persetujuan berbagi kebutuhan ditarik.');
      }
      return group(s);
    });
  }
  function approval(s, body) {
    return atomic(() => {
      requireValue(!cycles.locked(s),'Rencana penerimaan sudah disimpan. Persetujuan tidak diubah saat barang diterima.',409);
      const current = group(s); requireValue(current.version === body.version, 'Proposal sudah berubah. Muat ulang dan periksa biayanya.', 409);
      requireValue(current.own, 'Bagikan kebutuhan sebelum memberi persetujuan.', 409);
      requireValue(['accepted', 'declined'].includes(body.decision), 'Keputusan tidak valid.');
      if (body.decision === 'accepted') requireValue(current.eligible, current.conflicts.join(' '), 409);
      run('UPDATE demands SET approved_version=?,decision=? WHERE workspace_id=? AND business_id=?', body.version, body.decision, ...scope(s));
      log(...scope(s), `Bagian proposal versi ${body.version} ${body.decision === 'accepted' ? 'disetujui' : 'ditolak'}.`); return group(s);
    });
  }
  function requestTransfer(s, offerId, body) {
    return atomic(() => {
      requireValue(!cycles.locked(s),'Rencana penerimaan sudah disimpan. Permintaan surplus baru menunggu siklus berikutnya.',409);
      const offer = get('SELECT * FROM offers WHERE id=? AND workspace_id=?', offerId, s.workspace_id);
      requireValue(offer, 'Tawaran tidak ditemukan.', 404); requireValue(offer.owner_id !== s.business_id, 'Pemilik tidak dapat meminta tawarannya sendiri.');
      requireValue(!offer.cancelled_at && offer.cycle===cycles.context(s).id,'Tawaran sudah ditarik atau berasal dari siklus sebelumnya.',409);
      requireValue(offer.expires_at > Date.now(), 'Tawaran kedaluwarsa.', 409);
      requireValue(cycles.context(s).expiresAt>Date.now(),'Siklus kulakan kedaluwarsa. Mulai siklus baru sebelum meminta surplus.',409);
      requireValue(!get("SELECT id FROM transfers WHERE offer_id=? AND receiver_id=? AND status='pending'",offerId,s.business_id),'Permintaanmu masih menunggu pemilik. Selesaikan sebelum meminta lagi.',409);
      requireValue(Number.isInteger(body.qty) && body.qty > 0 && body.qty <= offer.qty, 'Jumlah transfer tidak valid.');
      const used = get("SELECT COALESCE(SUM(qty),0) AS qty FROM transfers WHERE offer_id=? AND status IN ('pending','completed')", offerId).qty;
      requireValue(used + body.qty <= offer.qty, 'Surplus sudah diminta anggota lain.', 409);
      requireValue(operations.available({...s,business_id:offer.owner_id},offer.product_id) >= units(body.qty), 'Stok pemilik tidak cukup atau sudah dicadangkan pada tawaran lain.', 409);
      const own = get('SELECT * FROM demands WHERE workspace_id=? AND business_id=?', ...scope(s));
      const received = receipts(s).reduce((sum, t) => sum + t.qty, 0);
      const waiting=get("SELECT COALESCE(SUM(qty),0) AS qty FROM transfers WHERE workspace_id=? AND receiver_id=? AND cycle=? AND status='pending'",...scope(s),cycles.context(s).id).qty;
      requireValue(!own.active || own.qty >= received + waiting + body.qty, 'Perbarui kebutuhan sebelum meminta jumlah surplus ini.', 409);
      const id = randomUUID(); run('INSERT INTO transfers(id,workspace_id,offer_id,receiver_id,qty,status,created_at,completed_at,cycle) VALUES(?,?,?,?,?,?,?,?,?)', id, s.workspace_id, offerId, s.business_id, body.qty, 'pending', new Date().toISOString(), null, cycles.context(s).id);
      log(...scope(s), `Meminta ${body.qty} satuan surplus; menunggu pemilik.`); log(s.workspace_id, offer.owner_id, `Permintaan ${body.qty} satuan surplus dari ${get('SELECT name FROM businesses WHERE workspace_id=? AND id=?',...scope(s)).name}.`);
      return { id };
    });
  }
  function transferDecision(s, id, accepted) {
    return atomic(() => {
      const transfer = get('SELECT t.*,o.owner_id,o.product_id,o.expires_at,o.cancelled_at AS offer_cancelled_at,o.cycle AS offer_cycle FROM transfers t JOIN offers o ON o.id=t.offer_id WHERE t.id=? AND t.workspace_id=?', id, s.workspace_id);
      requireValue(transfer && (transfer.owner_id === s.business_id || transfer.receiver_id === s.business_id), 'Transfer tidak ditemukan.', 404);
      if (accepted) requireValue(transfer.owner_id === s.business_id, 'Hanya pemilik surplus dapat menyetujui.', 403);
      if (transfer.status === (accepted ? 'completed' : 'cancelled')) return { duplicate: true };
      requireValue(transfer.status === 'pending', 'Transfer sudah selesai atau dibatalkan.', 409);
      if (accepted) {
        requireValue(transfer.cycle === cycles.context(s).id && !cycles.locked(s),'Siklus transfer sudah berubah atau rencana penerimaan sudah disimpan.',409);
        requireValue(transfer.expires_at > Date.now(), 'Tawaran kedaluwarsa. Batalkan permintaan.', 409);
        requireValue(!transfer.offer_cancelled_at && transfer.offer_cycle===cycles.context(s).id,'Tawaran ditarik atau siklus sudah berubah. Batalkan permintaan.',409);
        const receiver = { ...s, business_id: transfer.receiver_id };
        const own = get('SELECT * FROM demands WHERE workspace_id=? AND business_id=?', ...scope(receiver));
        requireValue(!own.active || own.qty >= receipts(receiver).reduce((sum, t) => sum + t.qty, 0) + transfer.qty, 'Kebutuhan penerima berubah. Minta penerima memperbaruinya.', 409);
        const stock = get('SELECT quantity FROM inventory WHERE workspace_id=? AND business_id=? AND product_id=?', s.workspace_id, transfer.owner_id, transfer.product_id);
        requireValue(stock.quantity >= units(transfer.qty) && operations.available({...s,business_id:transfer.owner_id},transfer.product_id)>=0, 'Stok pemilik tidak cukup atau dicadangkan untuk permintaan lain.', 409);
        for (const [business, delta] of [[transfer.owner_id, -transfer.qty], [transfer.receiver_id, transfer.qty]]) {
          run('UPDATE inventory SET quantity=quantity+? WHERE workspace_id=? AND business_id=? AND product_id=?', units(delta), s.workspace_id, business, transfer.product_id);
          movement(s.workspace_id, business, transfer.product_id, delta, 'surplus', id);
        }
        bump(s);
      }
      run('UPDATE transfers SET status=?,completed_at=? WHERE id=?', accepted ? 'completed' : 'cancelled', accepted ? new Date().toISOString() : null, id);
      for (const business of [transfer.owner_id, transfer.receiver_id]) log(s.workspace_id, business, `Transfer ${transfer.qty} satuan ${accepted ? 'disetujui kedua pihak dan dicatat' : 'dibatalkan'}.`);
      return { duplicate: false };
    });
  }
  // Demo wallet: net takings (total - 10% fee) on non-cancelled sales, less
  // completed withdrawals. Cashier may view it; only the owner withdraws.
  function finance(s) {
    const sales = all('SELECT total,fee,net,payment_method,date,cancelled_at FROM sales WHERE workspace_id=? AND business_id=?', ...scope(s));
    const active = sales.filter(x => !x.cancelled_at), today = dayAt();
    const netOf = x => x.net ?? (x.total - (x.fee || 0)), sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
    const todays = active.filter(x => x.date === today);
    const withdrawals = all('SELECT id,amount,destination_type,destination_detail,status,created_at FROM withdrawals WHERE workspace_id=? AND business_id=? ORDER BY created_at DESC', ...scope(s));
    const withdrawn = sum(withdrawals.filter(w => w.status === 'completed'), w => w.amount);
    const byMethod = {}; for (const x of todays) { const k = x.payment_method || 'tunai'; byMethod[k] = (byMethod[k] || 0) + x.total; }
    return { balance: sum(active, netOf) - withdrawn, withdrawn, lifetimeNet: sum(active, netOf),
      today: { gross: sum(todays, x => x.total), fee: sum(todays, x => x.fee || 0), net: sum(todays, netOf), count: todays.length, byMethod },
      withdrawals: withdrawals.slice(0, 20) };
  }
  function withdraw(s, body) {
    requireValue(typeof body.idempotencyKey === 'string' && body.idempotencyKey.length >= 8 && body.idempotencyKey.length <= 100, 'Kunci penarikan tidak valid.');
    requireValue(['bank', 'ewallet'].includes(body.destinationType), 'Pilih tujuan bank atau e-wallet.');
    const detail = String(body.destinationDetail ?? '').trim();
    requireValue(detail.length >= 2 && detail.length <= 120, 'Isi nomor rekening atau e-wallet tujuan (2–120 karakter).');
    requireValue(Number.isInteger(body.amount) && body.amount > 0, 'Jumlah penarikan tidak valid.');
    return atomic(() => {
      const previous = get('SELECT * FROM withdrawals WHERE workspace_id=? AND business_id=? AND idem=?', ...scope(s), body.idempotencyKey);
      if (previous) return { id: previous.id, amount: previous.amount, duplicate: true };
      requireValue(body.amount <= finance(s).balance, 'Jumlah melebihi saldo yang tersedia.', 409);
      const id = randomUUID(), now = new Date().toISOString();
      run('INSERT INTO withdrawals(id,workspace_id,business_id,idem,amount,destination_type,destination_detail,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)', id, ...scope(s), body.idempotencyKey, body.amount, body.destinationType, detail, 'completed', now);
      log(...scope(s), `Penarikan saldo ${body.amount} ke ${body.destinationType} berhasil (demo).`);
      return { id, amount: body.amount, duplicate: false };
    });
  }
  return store.attribute({ kitchen, requests, bootstrap, finance, withdraw, saveUsageReview:usageDecisions.save, transaction, cancelSale, demand, group, approval, requestTransfer, transferDecision, ...operations, ...configuration, createOffer:surplus.create, withdrawOffer:surplus.withdraw, finalizeCollective:cycles.finalize, receiveCollective:cycles.receive, cancelCollectiveReceipt:cycles.cancelReceipt, cancelCollective:cycles.cancel, nextCycle:cycles.next });
}
