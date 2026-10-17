import {migrateKitchen} from './kitchen.mjs';
import {migrateDisplayAccess} from './display-access.mjs';
import {migrateOrderRequests} from './order-requests.mjs';
import {migrateRoles} from './roles.mjs';
import {migrateActivity,createActivity} from './activity.mjs';
import {accountTableSQL,migrateAccountCredentials,migrateStaffInvites} from './staff-invites.mjs';
import {migrateRecoveryCodes} from './account-recovery.mjs';
import {migratePlans} from './plans.mjs';
import {migrateStaffAccess} from './staff-access.mjs';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { usage } from '../public/catalog.js';
import { dayAt, addDays, units, quantity } from './common.mjs';

export function createStore(filename = 'data/gerai-kita-live.sqlite') {
  if (filename !== ':memory:') mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 1, quote_expires INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS businesses(workspace_id TEXT, id TEXT, name TEXT NOT NULL, short_name TEXT NOT NULL, letter TEXT NOT NULL,
      PRIMARY KEY(workspace_id,id), FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS inventory(workspace_id TEXT,business_id TEXT,product_id TEXT,quantity INTEGER NOT NULL CHECK(quantity>=0),expires_at TEXT,
      PRIMARY KEY(workspace_id,business_id,product_id),FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS sales(id TEXT PRIMARY KEY,workspace_id TEXT,business_id TEXT,idem TEXT NOT NULL,fingerprint TEXT NOT NULL,items TEXT NOT NULL,total INTEGER NOT NULL,
      date TEXT NOT NULL,created_at TEXT NOT NULL,cancelled_at TEXT,UNIQUE(workspace_id,business_id,idem),FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS movements(id TEXT PRIMARY KEY,workspace_id TEXT,business_id TEXT,product_id TEXT,delta INTEGER NOT NULL,reason TEXT NOT NULL,ref TEXT,created_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS daily_usage(workspace_id TEXT,business_id TEXT,product_id TEXT,date TEXT,quantity INTEGER NOT NULL CHECK(quantity>=0),
      PRIMARY KEY(workspace_id,business_id,product_id,date),FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS demands(workspace_id TEXT,business_id TEXT,qty INTEGER NOT NULL CHECK(qty>=0),active INTEGER NOT NULL,budget INTEGER,expires_at INTEGER NOT NULL,
      approved_version INTEGER,decision TEXT NOT NULL DEFAULT 'pending',PRIMARY KEY(workspace_id,business_id),FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS offers(id TEXT PRIMARY KEY,workspace_id TEXT,owner_id TEXT,product_id TEXT NOT NULL,qty INTEGER NOT NULL CHECK(qty>0),unit_price INTEGER NOT NULL CHECK(unit_price>=0),
      expires_at INTEGER NOT NULL,condition TEXT NOT NULL,FOREIGN KEY(workspace_id,owner_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS transfers(id TEXT PRIMARY KEY,workspace_id TEXT,offer_id TEXT,receiver_id TEXT,qty INTEGER NOT NULL CHECK(qty>0),status TEXT NOT NULL,
      created_at TEXT NOT NULL,completed_at TEXT,FOREIGN KEY(offer_id) REFERENCES offers(id) ON DELETE CASCADE,FOREIGN KEY(workspace_id,receiver_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS usage_review_decisions(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,business_id TEXT NOT NULL,product_id TEXT NOT NULL,date TEXT NOT NULL,
      snapshot_hash TEXT NOT NULL,decision TEXT NOT NULL CHECK(decision IN ('checked','follow_up')),note TEXT NOT NULL,created_at TEXT NOT NULL,
      idem TEXT NOT NULL,fingerprint TEXT NOT NULL,previous_id TEXT,
      UNIQUE(workspace_id,business_id,idem),FOREIGN KEY(workspace_id,business_id,product_id) REFERENCES ingredients(workspace_id,business_id,id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS usage_reviews_scope ON usage_review_decisions(workspace_id,business_id,product_id,date);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,workspace_id TEXT,business_id TEXT,message TEXT NOT NULL,created_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,workspace_id TEXT,business_id TEXT,csrf TEXT NOT NULL,expires_at INTEGER NOT NULL,
      FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS sales_tenant ON sales(workspace_id,business_id,date);
    CREATE INDEX IF NOT EXISTS audit_tenant ON audit(workspace_id,business_id,created_at);
    CREATE TABLE IF NOT EXISTS business_state(workspace_id TEXT,business_id TEXT,catalog_revision INTEGER NOT NULL DEFAULT 1,stock_revision INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(workspace_id,business_id),FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS menus(workspace_id TEXT,business_id TEXT,id TEXT,name TEXT NOT NULL,aliases TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0),recipe TEXT NOT NULL,
      PRIMARY KEY(workspace_id,business_id,id),FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS ingredients(workspace_id TEXT,business_id TEXT,id TEXT,name TEXT NOT NULL,normalized_name TEXT NOT NULL,unit TEXT NOT NULL CHECK(unit IN ('kg','gram','liter','ml','butir','buah')),min_quantity INTEGER NOT NULL CHECK(min_quantity>=0),storage_note TEXT NOT NULL,shared INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(workspace_id,business_id,id),UNIQUE(workspace_id,business_id,normalized_name),FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS stock_receipts(id TEXT PRIMARY KEY,workspace_id TEXT,business_id TEXT,idem TEXT NOT NULL,fingerprint TEXT NOT NULL,product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity>0),unit_price INTEGER NOT NULL CHECK(unit_price>=0),total INTEGER NOT NULL,supplier TEXT NOT NULL,created_at TEXT NOT NULL,cancelled_at TEXT,
      UNIQUE(workspace_id,business_id,idem),FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS collective_cycles(workspace_id TEXT,cycle INTEGER,status TEXT NOT NULL,created_at TEXT NOT NULL,closed_at TEXT,
      PRIMARY KEY(workspace_id,cycle),FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS collective_orders(id TEXT PRIMARY KEY,workspace_id TEXT,cycle INTEGER,approved_version INTEGER NOT NULL,status TEXT NOT NULL,snapshot TEXT NOT NULL,created_at TEXT NOT NULL,cancelled_at TEXT,
      FOREIGN KEY(workspace_id,cycle) REFERENCES collective_cycles(workspace_id,cycle) ON DELETE CASCADE);
    CREATE UNIQUE INDEX IF NOT EXISTS collective_active ON collective_orders(workspace_id,cycle) WHERE status<>'cancelled';
  `);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const activity=createActivity({get});
  // Nested calls join the outer transaction through a savepoint so composite actions commit together.
  let depth = 0;
  function atomic(fn) {
    if (depth) { db.exec('SAVEPOINT nested'); depth++; try { const result = fn(); db.exec('RELEASE nested'); return result; } catch (error) { db.exec('ROLLBACK TO nested'); db.exec('RELEASE nested'); throw error; } finally { depth--; } }
    db.exec('BEGIN IMMEDIATE'); depth = 1; try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } finally { depth = 0; }
  }
  function log(workspace, business, message) { const a=activity.current(workspace,business);run('INSERT INTO audit(id,workspace_id,business_id,message,created_at,actor_id,actor_name,actor_role,actor_revision) VALUES(?,?,?,?,?,?,?,?,?)', randomUUID(), workspace, business, message, new Date().toISOString(),a?.id??null,a?.name??null,a?.role??null,a?.revision??null); }
  function movement(workspace, business, product, delta, reason, ref) { run('INSERT INTO movements VALUES(?,?,?,?,?,?,?,?)', randomUUID(), workspace, business, product, units(delta), reason, ref, new Date().toISOString()); }
  db.exec(`${accountTableSQL().replace('CREATE TABLE accounts','CREATE TABLE IF NOT EXISTS accounts')};
    CREATE TABLE IF NOT EXISTS account_sessions(session_id TEXT PRIMARY KEY,account_id TEXT NOT NULL,FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE,FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE);`);
  migrateAccountCredentials(db);
  // Additive migration: keep the existing namespaces, balances, and sessions.
  atomic(() => {
    for(const [column,type] of [['name','TEXT'],['join_code','TEXT'],['owner_business_id','TEXT'],['settings','TEXT'],['quote_json','TEXT']])if(!all('PRAGMA table_info(workspaces)').some(c=>c.name===column))db.exec('ALTER TABLE workspaces ADD COLUMN '+column+' '+type);
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS workspace_invite ON workspaces(join_code) WHERE join_code IS NOT NULL');
    if (!all('PRAGMA table_info(sales)').some(c => c.name === 'usage_snapshot')) db.exec('ALTER TABLE sales ADD COLUMN usage_snapshot TEXT');
    if (!all('PRAGMA table_info(demands)').some(c => c.name === 'stock_revision')) db.exec('ALTER TABLE demands ADD COLUMN stock_revision INTEGER NOT NULL DEFAULT 0');
    if (!all('PRAGMA table_info(workspaces)').some(c => c.name === 'active_cycle')) db.exec('ALTER TABLE workspaces ADD COLUMN active_cycle INTEGER NOT NULL DEFAULT 1');
    if (!all('PRAGMA table_info(transfers)').some(c => c.name === 'cycle')) db.exec('ALTER TABLE transfers ADD COLUMN cycle INTEGER NOT NULL DEFAULT 1');
    if (!all('PRAGMA table_info(stock_receipts)').some(c => c.name === 'collective_order_id')) db.exec('ALTER TABLE stock_receipts ADD COLUMN collective_order_id TEXT');
    if (!all('PRAGMA table_info(stock_receipts)').some(c => c.name === 'shipping')) db.exec('ALTER TABLE stock_receipts ADD COLUMN shipping INTEGER NOT NULL DEFAULT 0');
    if (!all('PRAGMA table_info(stock_receipts)').some(c => c.name === 'product_name')) db.exec('ALTER TABLE stock_receipts ADD COLUMN product_name TEXT');
    if (!all('PRAGMA table_info(stock_receipts)').some(c => c.name === 'product_unit')) db.exec('ALTER TABLE stock_receipts ADD COLUMN product_unit TEXT');
    if (!all('PRAGMA table_info(stock_receipts)').some(c => c.name === 'cancel_reason')) db.exec('ALTER TABLE stock_receipts ADD COLUMN cancel_reason TEXT');
    for (const [column,type] of [['input_quantity','INTEGER'],['input_unit','TEXT'],['input_unit_price','REAL']]) {
      if (!all('PRAGMA table_info(stock_receipts)').some(c => c.name === column)) db.exec(`ALTER TABLE stock_receipts ADD COLUMN ${column} ${type}`);
    }
    const offerColumns = new Set(all('PRAGMA table_info(offers)').map(c=>c.name));
    for (const [column,type] of [['cycle','INTEGER NOT NULL DEFAULT 1'],['created_at','TEXT'],['cancelled_at','TEXT'],['idem','TEXT'],['fingerprint','TEXT']]) if(!offerColumns.has(column)) db.exec(`ALTER TABLE offers ADD COLUMN ${column} ${type}`);
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS offers_idem ON offers(workspace_id,owner_id,idem) WHERE idem IS NOT NULL');
    for (const w of all('SELECT * FROM workspaces')) run('INSERT OR IGNORE INTO collective_cycles VALUES(?,?,?, ?,NULL)', w.id, w.active_cycle, 'planning', w.created_at);

    run('UPDATE stock_receipts SET product_name=(SELECT name FROM ingredients i WHERE i.workspace_id=stock_receipts.workspace_id AND i.business_id=stock_receipts.business_id AND i.id=stock_receipts.product_id),product_unit=(SELECT unit FROM ingredients i WHERE i.workspace_id=stock_receipts.workspace_id AND i.business_id=stock_receipts.business_id AND i.id=stock_receipts.product_id) WHERE product_name IS NULL OR product_unit IS NULL');
    for (const sale of all('SELECT * FROM sales WHERE usage_snapshot IS NULL')) {
      const items = JSON.parse(sale.items);
      const consumed = all("SELECT product_id,SUM(-delta) AS amount FROM movements WHERE workspace_id=? AND business_id=? AND ref=? AND reason='sale' GROUP BY product_id", sale.workspace_id, sale.business_id, sale.id);
      const existingMenus=menus({workspace_id:sale.workspace_id,business_id:sale.business_id});
      const snapshot = consumed.length ? Object.fromEntries(consumed.map(p => [p.product_id, p.amount / 10000])) : items.every(i=>existingMenus.some(m=>m.id===i.id)) ? usage(items,existingMenus) : {};
      const catalog=menus({workspace_id:sale.workspace_id,business_id:sale.business_id});
      const decorated = items.map(i => ({ ...i, name: i.name || catalog.find(m=>m.id===i.id)?.name || 'Menu tidak tersedia', unitPrice: i.unitPrice ?? catalog.find(m=>m.id===i.id)?.price ?? null }));
      run('UPDATE sales SET items=?,usage_snapshot=? WHERE id=?', JSON.stringify(decorated), JSON.stringify(snapshot), sale.id);
    }
  });
  migrateKitchen(db);
  migrateDisplayAccess(db);
  migrateOrderRequests(db);
  migrateRoles(db);
  atomic(()=>migrateActivity(db));
  migrateStaffInvites(db);
  migrateStaffAccess(db);
  migrateRecoveryCodes(db);
  migratePlans(db);
  function menus(s) { return all('SELECT id,name,aliases,price,recipe FROM menus WHERE workspace_id=? AND business_id=? ORDER BY rowid', s.workspace_id, s.business_id).map(m => ({ ...m, aliases: JSON.parse(m.aliases), recipe: JSON.parse(m.recipe) })); }
  function ingredients(s) { return all('SELECT id,name,unit,min_quantity,storage_note,shared FROM ingredients WHERE workspace_id=? AND business_id=? ORDER BY rowid',s.workspace_id,s.business_id).map(p=>({id:p.id,name:p.name,unit:p.unit,min:quantity(p.min_quantity),shelf:p.storage_note || 'Belum ada catatan',storageNote:p.storage_note,shared:!!p.shared})); }
  function session(business,workspace) {
    if(!workspace || !get('SELECT id FROM businesses WHERE workspace_id=? AND id=?',workspace,business))throw new Error('Usaha belum terdaftar.');
    const value={id:randomBytes(32).toString('hex'),workspace_id:workspace,business_id:business,csrf:randomBytes(24).toString('hex'),expires_at:Date.now()+30*86400000};
    run('INSERT INTO sessions VALUES(?,?,?,?,?)',value.id,workspace,business,value.csrf,value.expires_at);return value;
  }
  return {db,run,get,all,atomic,log,movement,session,menus,ingredients,actorOf:activity.resolve,withActor:activity.run,attribute:activity.wrap,close:()=>db.close()};
}
