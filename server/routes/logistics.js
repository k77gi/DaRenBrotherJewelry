const crypto = require('crypto');
const express = require('express');
const config = require('../config');
const { getDb } = require('../db');
const { HttpError } = require('../httpError');
const { route } = require('../util');
const { sanitizePlain } = require('../security');

const router = express.Router();

const SUBTYPES = {
  UNIMART: '7-ELEVEN',
  FAMI: '全家',
  HILIFE: '萊爾富'
};

function replyOrigin(req) {
  if (config.publicOrigin) return config.publicOrigin;
  const host = String(req.get('host') || '');
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) return `${req.protocol}://${host}`;
  throw new HttpError(400, '請在 .env 設定 PUBLIC_ORIGIN，綠界才能把門市資料傳回這個網站');
}

function tradeNo() {
  const stamp = Date.now().toString(36).toUpperCase();
  const extra = crypto.randomBytes(3).toString('hex').toUpperCase();
  return (`C${stamp}${extra}`).slice(0, 20);
}

function storeId(value) {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9]{4,9}$/.test(text)) throw new HttpError(400, '門市代號格式不正確');
  return text;
}

router.post('/cvs-map', route(async (req, res) => {
  const subtype = String(req.body?.subtype || '');
  if (!SUBTYPES[subtype]) throw new HttpError(400, '請選擇 7-ELEVEN、全家或萊爾富');
  const device = String(req.body?.device || '0') === '1' ? '1' : '0';
  const db = getDb();
  await db.prepare("DELETE FROM cvs_map_sessions WHERE expires_at <= datetime('now', 'localtime')").run();
  const trade = tradeNo();
  const token = crypto.randomBytes(16).toString('hex');
  await db.prepare(`
    INSERT INTO cvs_map_sessions (trade_no, token, subtype, expires_at)
    VALUES (?, ?, ?, datetime('now', 'localtime', '+30 minutes'))
  `).run(trade, token, subtype);
  res.json({
    action: config.ecpayMapUrl,
    stage: config.ecpayMapStage,
    fields: {
      MerchantID: config.ecpayMerchantId,
      MerchantTradeNo: trade,
      LogisticsType: 'CVS',
      LogisticsSubType: subtype,
      IsCollection: 'N',
      ServerReplyURL: `${replyOrigin(req)}/api/logistics/cvs-reply`,
      ExtraData: token.slice(0, 20),
      Device: device
    }
  });
}));

router.get('/cvs-map/:token', route(async (req, res) => {
  const token = String(req.params.token || '');
  if (!/^[a-f0-9]{32}$/.test(token)) throw new HttpError(400, '找不到這次的門市選擇');
  const row = await getDb().prepare(`
    SELECT subtype, cvs_store_id, cvs_store_name, cvs_address,
           CASE WHEN expires_at <= datetime('now', 'localtime') THEN 1 ELSE 0 END AS expired
    FROM cvs_map_sessions
    WHERE token = ?
  `).get(token);
  if (!row || row.expired || !row.cvs_store_id) throw new HttpError(404, '找不到這次的門市選擇');
  res.json({
    subtype: row.subtype,
    subtypeName: SUBTYPES[row.subtype] || row.subtype,
    storeId: row.cvs_store_id,
    storeName: row.cvs_store_name,
    address: row.cvs_address
  });
}));

function replyPage(res, token) {
  const next = token ? `/checkout.html?cvs=${encodeURIComponent(token)}` : '/checkout.html';
  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="UTF-8"><title>返回結帳</title></head>
<body><p>正在返回結帳頁…</p><script>location.replace(${JSON.stringify(next)})</script></body></html>`);
}

router.post('/cvs-reply', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const body = req.body || {};
    if (String(body.MerchantID || '') !== config.ecpayMerchantId) {
      throw new HttpError(400, '綠界回傳的商店代號不符');
    }
    const trade = String(body.MerchantTradeNo || '');
    const db = getDb();
    const row = await db.prepare(`
      SELECT token, subtype,
             CASE WHEN expires_at <= datetime('now', 'localtime') THEN 1 ELSE 0 END AS expired
      FROM cvs_map_sessions
      WHERE trade_no = ?
    `).get(trade);
    if (!row || row.expired) throw new HttpError(400, '這次的門市選擇已失效，請回結帳頁重選');
    const id = storeId(body.CVSStoreID);
    const name = sanitizePlain(body.CVSStoreName, 30, '超商名稱', { required: true });
    const address = sanitizePlain(body.CVSAddress, 120, '超商地址', { required: true });
    const subtype = SUBTYPES[body.LogisticsSubType] ? body.LogisticsSubType : row.subtype;
    await db.prepare(`
      UPDATE cvs_map_sessions
      SET cvs_store_id = ?, cvs_store_name = ?, cvs_address = ?, subtype = ?
      WHERE trade_no = ? AND cvs_store_id = ''
    `).run(id, name, address, subtype, trade);
    replyPage(res, row.token);
  } catch (error) {
    const message = error instanceof HttpError ? error.message : '無法讀取門市資料';
    res.status(400).type('html').send(`<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="UTF-8"><title>門市選擇失敗</title></head>
<body><p>${message.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]))}</p>
<p><a href="/checkout.html">回結帳頁</a></p></body></html>`);
  }
});

async function loadCvsSelection(token) {
  const text = String(token || '');
  if (!/^[a-f0-9]{32}$/.test(text)) throw new HttpError(400, '請先用電子地圖選擇超商');
  const row = await getDb().prepare(`
    SELECT subtype, cvs_store_id, cvs_store_name, cvs_address,
           CASE WHEN expires_at <= datetime('now', 'localtime') THEN 1 ELSE 0 END AS expired
    FROM cvs_map_sessions
    WHERE token = ?
  `).get(text);
  if (!row || row.expired || !row.cvs_store_id) throw new HttpError(400, '請先用電子地圖選擇超商');
  return {
    logisticsSubType: row.subtype,
    cvsStoreId: row.cvs_store_id,
    cvsStoreName: row.cvs_store_name,
    cvsAddress: row.cvs_address
  };
}

module.exports = { router, loadCvsSelection, SUBTYPES };
