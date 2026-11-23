const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const mysql = require('mysql2/promise');
const config = require('./config');
const { seed } = require('./seed');
const { backfillVisuals } = require('./visuals');
const { PERMISSIONS, ROLES, codesFor } = require('./permissions');
const { timestamp } = require('./util');
const { isBcryptHash } = require('./security');

const tx = new AsyncLocalStorage();
let database;

function translate(sql) {
  return sql
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT IGNORE INTO')
    .replace(/datetime\(\s*'now'\s*,\s*'localtime'\s*,\s*'\+(\d+)\s+minutes'\s*\)/gi, (_, minutes) => {
      return `DATE_ADD(NOW(), INTERVAL ${Number(minutes)} MINUTE)`;
    })
    .replace(/datetime\(\s*'now'\s*,\s*'localtime'\s*\)/gi, 'NOW()')
    .replace(/\bBEGIN\s+IMMEDIATE\b/gi, 'BEGIN')
    .replace(
      /ON\s+CONFLICT\s*\(\s*username\s*\)\s*DO\s+UPDATE\s+SET\s+fail_count\s*=\s*excluded\.fail_count\s*,\s*locked_until\s*=\s*excluded\.locked_until/gi,
      'ON DUPLICATE KEY UPDATE fail_count = VALUES(fail_count), locked_until = VALUES(locked_until)'
    )
    .replace(/INSERT\s+INTO\s+schema_meta\s*\(\s*key\s*,/gi, 'INSERT INTO schema_meta (meta_key,')
    .replace(/WHERE\s+key\s*=/gi, 'WHERE meta_key =');
}

function bind(params) {
  return params.map((value) => (value === undefined ? null : value));
}

class Database {
  constructor(pool) {
    this.pool = pool;
  }

  runner() {
    return tx.getStore() || this.pool;
  }

  prepare(sql) {
    const text = translate(sql);
    const query = async (params) => {
      const [rows] = await this.runner().query(text, bind(params));
      return rows;
    };
    return {
      get: (...params) => query(params).then((rows) => rows[0]),
      all: (...params) => query(params),
      run: async (...params) => {
        const [result] = await this.runner().query(text, bind(params));
        return {
          lastInsertRowid: Number(result.insertId || 0),
          changes: Number(result.affectedRows || 0)
        };
      }
    };
  }

  async exec(sql) {
    const text = translate(sql).trim().replace(/;+\s*$/, '');
    if (!text) return;
    if (/^BEGIN$/i.test(text)) {
      if (tx.getStore()) throw new Error('交易已在進行');
      const conn = await this.pool.getConnection();
      try {
        await conn.beginTransaction();
      } catch (error) {
        conn.release();
        throw error;
      }
      tx.enterWith(conn);
      return;
    }
    if (/^COMMIT$/i.test(text)) {
      const conn = tx.getStore();
      if (!conn) return;
      try {
        await conn.commit();
      } catch (error) {
        try { await conn.rollback(); } catch (rollbackError) { /* 提交失敗時改為撤回 */ }
        throw error;
      } finally {
        conn.release();
        tx.enterWith(null);
      }
      return;
    }
    if (/^ROLLBACK$/i.test(text)) {
      const conn = tx.getStore();
      if (!conn) return;
      try {
        await conn.rollback();
      } finally {
        conn.release();
        tx.enterWith(null);
      }
      return;
    }
    await this.runner().query(text);
  }
}

function splitSql(sql) {
  const withoutComments = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  return withoutComments
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function explainDbError(error) {
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return '無法連上 MySQL。請確認資料庫已啟動，以及 .env 的 MYSQL_HOST、MYSQL_PORT。';
  }
  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    return 'MySQL 帳號或密碼不正確。請檢查 .env 的 MYSQL_USER、MYSQL_PASSWORD。';
  }
  if (error.code === 'ER_BAD_DB_ERROR') {
    return `找不到資料庫「${config.mysql.database}」。請先在 phpMyAdmin 建立這個空資料庫，再重新啟動。`;
  }
  if (error.code === 'ER_DBACCESS_DENIED_ERROR') {
    return '這個 MySQL 帳號沒有使用該資料庫的權限。請在 cPanel 把帳號加入資料庫。';
  }
  return error.message;
}

async function openDatabase() {
  const pool = mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    timezone: '+08:00',
    dateStrings: true,
    supportBigNumbers: true,
    connectTimeout: 10000,
    typeCast(field, next) {
      if (field.type === 'LONGLONG') {
        const value = field.string();
        return value == null ? null : Number(value);
      }
      return next();
    }
  });
  pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+08:00'");
  });
  const db = new Database(pool);
  try {
    await db.exec('SELECT 1');
  } catch (error) {
    await pool.end();
    const wrapped = new Error(explainDbError(error));
    wrapped.cause = error;
    throw wrapped;
  }
  return db;
}

async function initDb() {
  if (database) return { seeded: false };
  database = await openDatabase();

  const exists = await database.prepare(
    `SELECT TABLE_NAME AS name
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'schema_meta'`
  ).get(config.mysql.database);
  if (!exists) {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    for (const statement of splitSql(schema)) {
      await database.exec(statement);
    }
  }
  await migrate(database);

  const seededRow = await database.prepare(
    "SELECT value FROM schema_meta WHERE key = 'seeded_at'"
  ).get();
  let seeded = false;
  if (!seededRow) {
    await seed(database);
    seeded = true;
  }
  await alignRoles(database);
  await grantInquiryAccess(database);
  await assertPasswordHashes(database);
  await backfillVisuals(database);
  return { seeded };
}

async function columnNames(db, table) {
  const allowed = new Set(['products', 'articles', 'orders', 'members', 'banners']);
  if (!allowed.has(table)) throw new Error('未知資料表');
  const rows = await db.prepare(
    `SELECT COLUMN_NAME AS name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`
  ).all(config.mysql.database, table);
  return rows.map((column) => column.name);
}

async function migrate(db) {
  const products = await columnNames(db, 'products');
  if (products.length && !products.includes('colors')) await db.exec("ALTER TABLE products ADD COLUMN colors VARCHAR(80) NOT NULL DEFAULT ''");
  if (products.length && !products.includes('care')) await db.exec("ALTER TABLE products ADD COLUMN care TEXT NOT NULL");
  if (products.length && !products.includes('main_image')) await db.exec("ALTER TABLE products ADD COLUMN main_image VARCHAR(255) NOT NULL DEFAULT ''");
  if (products.length && !products.includes('detail_images')) await db.exec("ALTER TABLE products ADD COLUMN detail_images TEXT NOT NULL");
  if (products.length && !products.includes('extra_fields')) await db.exec("ALTER TABLE products ADD COLUMN extra_fields TEXT NOT NULL");
  const articles = await columnNames(db, 'articles');
  if (articles.length && !articles.includes('cover_image')) {
    await db.exec("ALTER TABLE articles ADD COLUMN cover_image VARCHAR(255) NOT NULL DEFAULT ''");
  }
  const orders = await columnNames(db, 'orders');
  if (orders.length && !orders.includes('payment_method')) {
    await db.exec("ALTER TABLE orders ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT ''");
  }
  if (orders.length && !orders.includes('tracking_no')) await db.exec("ALTER TABLE orders ADD COLUMN tracking_no VARCHAR(40) NOT NULL DEFAULT ''");
  if (orders.length && !orders.includes('cvs_store_id')) await db.exec("ALTER TABLE orders ADD COLUMN cvs_store_id VARCHAR(20) NOT NULL DEFAULT ''");
  if (orders.length && !orders.includes('cvs_store_name')) await db.exec("ALTER TABLE orders ADD COLUMN cvs_store_name VARCHAR(40) NOT NULL DEFAULT ''");
  if (orders.length && !orders.includes('cvs_address')) await db.exec("ALTER TABLE orders ADD COLUMN cvs_address VARCHAR(160) NOT NULL DEFAULT ''");
  if (orders.length && !orders.includes('logistics_subtype')) await db.exec("ALTER TABLE orders ADD COLUMN logistics_subtype VARCHAR(20) NOT NULL DEFAULT ''");
  const members = await columnNames(db, 'members');
  if (members.length && !members.includes('line_id')) await db.exec("ALTER TABLE members ADD COLUMN line_id VARCHAR(40) NOT NULL DEFAULT ''");
  const banners = await columnNames(db, 'banners');
  if (banners.length && !banners.includes('image_width')) await db.exec('ALTER TABLE banners ADD COLUMN image_width INT NOT NULL DEFAULT 480');
  if (banners.length && !banners.includes('image_height')) await db.exec('ALTER TABLE banners ADD COLUMN image_height INT NOT NULL DEFAULT 240');
  await seedBanners(db);
  await convertBannerWidths(db);
}

async function convertBannerWidths(db) {
  const done = await db.prepare("SELECT value FROM schema_meta WHERE key = 'banner_width_px'").get();
  if (done) return;
  await db.prepare(`
    UPDATE banners
    SET image_width = image_width * 480 / 100
    WHERE image_width BETWEEN 40 AND 200
  `).run();
  await db.prepare("INSERT INTO schema_meta (key, value) VALUES ('banner_width_px', ?)").run(timestamp());
}

async function alignRoles(db) {
  const done = await db.prepare("SELECT value FROM schema_meta WHERE key = 'roles_v2'").get();
  if (done) return;
  const roleCount = (await db.prepare('SELECT COUNT(*) AS n FROM roles').get()).n;
  if (!roleCount) return;

  const findPermission = db.prepare('SELECT id FROM permissions WHERE code = ?');
  const insertPermission = db.prepare(
    'INSERT INTO permissions (code, name, description) VALUES (?, ?, ?)'
  );
  const updatePermission = db.prepare(
    'UPDATE permissions SET name = ?, description = ? WHERE code = ?'
  );
  for (const [code, name, description] of PERMISSIONS) {
    if (await findPermission.get(code)) await updatePermission.run(name, description, code);
    else await insertPermission.run(code, name, description);
  }

  const permissionIds = Object.fromEntries(
    (await db.prepare('SELECT id, code FROM permissions').all()).map((row) => [row.code, row.id])
  );
  const updateRole = db.prepare(
    'UPDATE roles SET name = ?, description = ?, role_level = ? WHERE code = ?'
  );
  const clearRole = db.prepare('DELETE FROM role_permissions WHERE role_id = ?');
  const insertRolePermission = db.prepare(
    'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)'
  );
  await db.exec('BEGIN IMMEDIATE');
  try {
    for (const role of ROLES) {
      const row = await db.prepare('SELECT id FROM roles WHERE code = ?').get(role.code);
      if (!row) continue;
      await updateRole.run(role.name, role.description, role.level, role.code);
      await clearRole.run(row.id);
      for (const code of codesFor(role)) {
        await insertRolePermission.run(row.id, permissionIds[code]);
      }
    }
    await db.prepare("UPDATE admins SET name = '主要管理者' WHERE username = 'merch' AND name = '商品管理員'").run();
    await db.prepare("UPDATE admins SET name = '助理管理者' WHERE username = 'editor' AND name = '內容編輯'").run();
    await db.prepare("INSERT INTO schema_meta (key, value) VALUES ('roles_v2', ?)").run(timestamp());
    await db.exec('COMMIT');
  } catch (error) {
    try { await db.exec('ROLLBACK'); } catch (rollbackError) { /* 沒有進行中的交易時略過 */ }
    throw error;
  }
}

async function grantInquiryAccess(db) {
  const done = await db.prepare("SELECT value FROM schema_meta WHERE key = 'inquiries_admin'").get();
  if (done) return;
  const findPermission = db.prepare('SELECT id FROM permissions WHERE code = ?');
  const insertPermission = db.prepare(
    'INSERT INTO permissions (code, name, description) VALUES (?, ?, ?)'
  );
  for (const [code, name, description] of PERMISSIONS) {
    if (!code.startsWith('inquiries.')) continue;
    if (!(await findPermission.get(code))) await insertPermission.run(code, name, description);
  }
  const insertLink = db.prepare(
    'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)'
  );
  for (const role of ROLES) {
    if (!role.modules.includes('*') && !role.modules.includes('inquiries')) continue;
    const row = await db.prepare('SELECT id FROM roles WHERE code = ?').get(role.code);
    if (!row) continue;
    for (const code of ['inquiries.read', 'inquiries.write']) {
      const permission = await findPermission.get(code);
      if (permission) await insertLink.run(row.id, permission.id);
    }
  }
  await db.prepare("INSERT INTO schema_meta (key, value) VALUES ('inquiries_admin', ?)").run(timestamp());
}

async function seedBanners(db) {
  const done = await db.prepare("SELECT value FROM schema_meta WHERE key = 'banners_seeded'").get();
  if (done) return;
  const count = (await db.prepare('SELECT COUNT(*) AS n FROM banners').get()).n;
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
    for (const row of rows) await insert.run(...row);
  }
  await db.prepare("INSERT INTO schema_meta (key, value) VALUES ('banners_seeded', ?)").run(timestamp());
}

async function assertPasswordHashes(db) {
  const members = await db.prepare('SELECT id, password_hash FROM members').all();
  const admins = await db.prepare('SELECT id, password_hash FROM admins').all();
  const plain = [
    ...members.filter((row) => !isBcryptHash(row.password_hash)).map((row) => `members:${row.id}`),
    ...admins.filter((row) => !isBcryptHash(row.password_hash)).map((row) => `admins:${row.id}`)
  ];
  if (plain.length) {
    throw new Error(`發現未使用 bcrypt 雜湊的密碼：${plain.join(', ')}`);
  }
}

function getDb() {
  if (!database) throw new Error('資料庫尚未就緒');
  return database;
}

module.exports = { initDb, getDb, explainDbError };
