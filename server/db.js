const fs = require('fs');
const path = require('path');
const config = require('./config');
const { seed } = require('./seed');
const { backfillVisuals } = require('./visuals');
const { PERMISSIONS, ROLES, codesFor } = require('./permissions');
const { timestamp } = require('./util');
const { isBcryptHash } = require('./security');

let database;

function openDatabase() {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (error) {
    console.error('需要 Node.js 24 或以上，因為要使用內建的 node:sqlite。');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new DatabaseSync(config.dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

function initDb() {
  if (database) return { seeded: false };
  database = openDatabase();

  const exists = database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_meta'"
  ).get();
  if (!exists) {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    database.exec(schema);
  }
  migrate(database);

  const seededRow = database.prepare(
    "SELECT value FROM schema_meta WHERE key = 'seeded_at'"
  ).get();
  let seeded = false;
  if (!seededRow) {
    seed(database);
    seeded = true;
  }
  alignRoles(database);
  assertPasswordHashes(database);
  backfillVisuals(database);
  return { seeded };
}

function columnNames(db, table) {
  const allowed = new Set(['products', 'articles', 'orders', 'members', 'banners']);
  if (!allowed.has(table)) throw new Error('未知資料表');
  return db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}

function migrate(db) {
  const products = columnNames(db, 'products');
  if (!products.includes('colors')) db.exec("ALTER TABLE products ADD COLUMN colors TEXT NOT NULL DEFAULT ''");
  if (!products.includes('care')) db.exec("ALTER TABLE products ADD COLUMN care TEXT NOT NULL DEFAULT ''");
  if (!products.includes('main_image')) db.exec("ALTER TABLE products ADD COLUMN main_image TEXT NOT NULL DEFAULT ''");
  if (!products.includes('detail_images')) db.exec("ALTER TABLE products ADD COLUMN detail_images TEXT NOT NULL DEFAULT '[]'");
  const articles = columnNames(db, 'articles');
  if (!articles.includes('cover_image')) db.exec("ALTER TABLE articles ADD COLUMN cover_image TEXT NOT NULL DEFAULT ''");
  const orders = columnNames(db, 'orders');
  if (!orders.includes('payment_method')) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT ''");
  }
  if (!orders.includes('tracking_no')) db.exec("ALTER TABLE orders ADD COLUMN tracking_no TEXT NOT NULL DEFAULT ''");
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_login_locks (
      username TEXT PRIMARY KEY,
      fail_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eyebrow TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      link_href TEXT NOT NULL DEFAULT '/shop.html',
      link_label TEXT NOT NULL DEFAULT '查看',
      image TEXT NOT NULL DEFAULT '',
      alt_text TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      image_width INTEGER NOT NULL DEFAULT 480,
      image_height INTEGER NOT NULL DEFAULT 240,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);
  const members = columnNames(db, 'members');
  if (!members.includes('line_id')) db.exec("ALTER TABLE members ADD COLUMN line_id TEXT NOT NULL DEFAULT ''");
  const banners = columnNames(db, 'banners');
  if (!banners.includes('image_width')) db.exec('ALTER TABLE banners ADD COLUMN image_width INTEGER NOT NULL DEFAULT 480');
  if (!banners.includes('image_height')) db.exec('ALTER TABLE banners ADD COLUMN image_height INTEGER NOT NULL DEFAULT 240');
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_tickets (
      id TEXT PRIMARY KEY,
      secret_hash TEXT NOT NULL,
      member_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'used')),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);
  seedBanners(db);
  convertBannerWidths(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);
}

function convertBannerWidths(db) {
  const done = db.prepare("SELECT value FROM schema_meta WHERE key = 'banner_width_px'").get();
  if (done) return;
  db.prepare(`
    UPDATE banners
    SET image_width = image_width * 480 / 100
    WHERE image_width BETWEEN 40 AND 200
  `).run();
  db.prepare("INSERT INTO schema_meta (key, value) VALUES ('banner_width_px', ?)").run(timestamp());
}

function alignRoles(db) {
  const done = db.prepare("SELECT value FROM schema_meta WHERE key = 'roles_v2'").get();
  if (done) return;
  const roleCount = db.prepare('SELECT COUNT(*) AS n FROM roles').get().n;
  if (!roleCount) return;

  const findPermission = db.prepare('SELECT id FROM permissions WHERE code = ?');
  const insertPermission = db.prepare(
    'INSERT INTO permissions (code, name, description) VALUES (?, ?, ?)'
  );
  const updatePermission = db.prepare(
    'UPDATE permissions SET name = ?, description = ? WHERE code = ?'
  );
  for (const [code, name, description] of PERMISSIONS) {
    if (findPermission.get(code)) updatePermission.run(name, description, code);
    else insertPermission.run(code, name, description);
  }

  const permissionIds = Object.fromEntries(
    db.prepare('SELECT id, code FROM permissions').all().map((row) => [row.code, row.id])
  );
  const updateRole = db.prepare(
    'UPDATE roles SET name = ?, description = ?, role_level = ? WHERE code = ?'
  );
  const clearRole = db.prepare('DELETE FROM role_permissions WHERE role_id = ?');
  const insertRolePermission = db.prepare(
    'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)'
  );
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const role of ROLES) {
      const row = db.prepare('SELECT id FROM roles WHERE code = ?').get(role.code);
      if (!row) continue;
      updateRole.run(role.name, role.description, role.level, role.code);
      clearRole.run(row.id);
      for (const code of codesFor(role)) {
        insertRolePermission.run(row.id, permissionIds[code]);
      }
    }
    db.prepare("UPDATE admins SET name = '主要管理者' WHERE username = 'merch' AND name = '商品管理員'").run();
    db.prepare("UPDATE admins SET name = '助理管理者' WHERE username = 'editor' AND name = '內容編輯'").run();
    db.prepare("INSERT INTO schema_meta (key, value) VALUES ('roles_v2', ?)").run(timestamp());
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (rollbackError) { /* 沒有進行中的交易時略過 */ }
    throw error;
  }
}

function seedBanners(db) {
  const done = db.prepare("SELECT value FROM schema_meta WHERE key = 'banners_seeded'").get();
  if (done) return;
  const count = db.prepare('SELECT COUNT(*) AS n FROM banners').get().n;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO banners (eyebrow, title, body, link_href, link_label, image, alt_text, sort_order, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const rows = [
      ['現貨飾品', '把日常戴得剛剛好', '珍珠、金飾與玉石，價格、材質和庫存都寫在商品頁。', '/shop.html', '進入珠寶小舖', '/images/banners/banner-1.svg', '珍珠項鍊', 1],
      ['小白教室', '第一次買，先看再決定', '珍珠怎麼看光澤，金飾怎麼保養，兩篇就夠入門。', '/blog.html', '去小白教室', '/images/banners/banner-2.svg', '金飾保養', 2],
      ['門市與配送', '滿 3,000 元免運', '未滿收取 80 元。也可以到大安區門市看看實品。', '/contact.html', '與我聯絡', '/images/banners/banner-3.svg', '門市', 3]
    ];
    for (const row of rows) insert.run(...row);
  }
  db.prepare("INSERT INTO schema_meta (key, value) VALUES ('banners_seeded', ?)").run(timestamp());
}

function assertPasswordHashes(db) {
  const members = db.prepare('SELECT id, password_hash FROM members').all();
  const admins = db.prepare('SELECT id, password_hash FROM admins').all();
  const plain = [
    ...members.filter((row) => !isBcryptHash(row.password_hash)).map((row) => `members:${row.id}`),
    ...admins.filter((row) => !isBcryptHash(row.password_hash)).map((row) => `admins:${row.id}`)
  ];
  if (plain.length) {
    throw new Error(`發現未使用 bcrypt 雜湊的密碼：${plain.join(', ')}`);
  }
}

function getDb() {
  if (!database) initDb();
  return database;
}

module.exports = { initDb, getDb };
