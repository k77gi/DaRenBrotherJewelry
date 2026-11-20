const fs = require('fs');
const config = require('./config');

for (const suffix of ['', '-wal', '-shm']) {
  const file = config.dbPath + suffix;
  try {
    fs.unlinkSync(file);
    console.log(`已刪除 ${file}`);
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    console.error(`無法刪除 ${file}。請先停止 npm start，再執行 npm run reset。`);
    process.exit(1);
  }
}

console.log('資料庫已清除。請重新執行 npm start，就會再寫入測試資料。');
