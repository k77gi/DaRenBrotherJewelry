const mysql = require('mysql2/promise');
const config = require('./config');
const { explainDbError } = require('./db');

const TABLES = [
  'order_items',
  'orders',
  'audit_logs',
  'articles',
  'products',
  'categories',
  'role_permissions',
  'admins',
  'permissions',
  'roles',
  'members',
  'cvs_map_sessions',
  'admin_login_locks',
  'banners',
  'login_tickets',
  'inquiries',
  'schema_meta'
];

async function main() {
  const connection = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    charset: 'utf8mb4'
  });
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of TABLES) {
      await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
      console.log(`已刪除資料表 ${table}`);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await connection.end();
  }
  console.log('資料庫已清除。請重新執行 npm start，就會再建立資料表並寫入測試資料。');
}

main().catch((error) => {
  console.error(explainDbError(error));
  process.exit(1);
});
