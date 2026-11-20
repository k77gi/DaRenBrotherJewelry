const path = require('path');
const express = require('express');
const config = require('./config');
const { initDb } = require('./db');
const { HttpError } = require('./httpError');
const { uploadDir } = require('./uploads');

const { seeded } = initDb();
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use('/api', require('./routes/catalog'));
app.use('/api/members', require('./routes/members'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/inquiries', require('./routes/inquiries'));
app.use('/api/admin', require('./routes/admin'));

app.use('/api', (req, res) => {
  res.status(404).json({ error: '找不到這個介面' });
});

app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '傳送的資料格式不正確' });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: '伺服器發生錯誤，請稍後再試' });
});

const server = app.listen(config.port, () => {
  console.log(`大仁哥的珠寶小舖已啟動：http://localhost:${config.port}`);
  console.log(`資料庫：${config.dbPath}`);
  if (seeded) console.log('已寫入預設測試資料。管理員帳號請看 README「預設帳號」。');
  if (config.usingDefaultSecret) {
    console.log('目前使用預設 JWT 密鑰，僅適合本機練習。正式使用前請在 .env 設定 JWT_SECRET。');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`埠 ${config.port} 已被占用。請關閉占用的程式，或在 .env 設定其他 PORT。`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
