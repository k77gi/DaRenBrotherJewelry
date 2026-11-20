const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

module.exports = {
  root,
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'daren-local-dev-secret-change-me',
  usingDefaultSecret: !process.env.JWT_SECRET,
  dbPath: path.resolve(root, process.env.DB_PATH || 'data/shop.sqlite'),
  freeShippingThreshold: 3000,
  shippingFee: 80,
  phone: '02-2345-6789',
  address: '台北市大安區仁愛路四段 100 號 1 樓',
  hours: '週二至週日 12:00–20:00'
};
