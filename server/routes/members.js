const crypto = require('crypto');
const express = require('express');
const QRCode = require('qrcode');
const { getDb } = require('../db');
const { HttpError } = require('../httpError');
const { route, requiredText, requiredEmail, optionalPhone } = require('../util');
const { signToken, requireMember } = require('../middleware/auth');
const { mapMember } = require('../map');
const { listOrders } = require('../orderService');
const { hashPassword, verifyPassword } = require('../security');

const router = express.Router();
const dummyHash = hashPassword('dummy-password');

function publicMember(row) {
  return mapMember(row);
}

function readPassword(value) {
  const password = String(value || '');
  if (password.length < 8 || password.length > 72) {
    throw new HttpError(400, '密碼請設定 8 到 72 個字元');
  }
  return password;
}

function canonicalPhone(value, required) {
  const phone = required ? optionalPhone(value) : optionalPhone(value);
  if (required && !phone) throw new HttpError(400, '請填寫電話');
  return phone.replace(/[\s()-]/g, '');
}

function lineId(value) {
  const text = String(value ?? '').trim();
  if (!/^[A-Za-z][A-Za-z0-9._-]{3,19}$/.test(text)) {
    throw new HttpError(400, 'LINE ID 請使用 4 到 20 個字，以英文開頭，可含數字、點、底線或減號');
  }
  return text;
}

function placeholderEmail() {
  return `m${Date.now()}${Math.floor(Math.random() * 1000)}@members.local`;
}

async function findByAccount(db, account) {
  const text = String(account || '').trim();
  const phone = text.replace(/[\s()-]/g, '');
  return await db.prepare(`
    SELECT id, name, email, phone, line_id, password_hash, created_at
    FROM members
    WHERE lower(email) = lower(?)
       OR (phone != '' AND phone = ?)
       OR (line_id != '' AND lower(line_id) = lower(?))
  `).get(text, phone, text);
}

router.post('/register', route(async (req, res) => {
  const name = requiredText(req.body?.name, 40, '姓名');
  const password = readPassword(req.body?.password);
  const method = String(req.body?.method || 'email');
  if (!['email', 'phone', 'line'].includes(method)) throw new HttpError(400, '請選擇註冊方式');
  const db = getDb();
  let email = '';
  let phone = '';
  let line = '';
  if (method === 'email') {
    email = requiredEmail(req.body?.email);
    phone = canonicalPhone(req.body?.phone, false);
  } else if (method === 'phone') {
    phone = canonicalPhone(req.body?.phone, true);
    email = placeholderEmail();
  } else {
    line = lineId(req.body?.lineId);
    phone = canonicalPhone(req.body?.phone, false);
    email = placeholderEmail();
  }
  if (await db.prepare('SELECT id FROM members WHERE lower(email) = lower(?)').get(email)) {
    throw new HttpError(409, '這個電子郵件已經註冊');
  }
  if (phone && await db.prepare('SELECT id FROM members WHERE phone = ?').get(phone)) {
    throw new HttpError(409, '這個電話號碼已經註冊');
  }
  if (line && await db.prepare('SELECT id FROM members WHERE lower(line_id) = lower(?)').get(line)) {
    throw new HttpError(409, '這個 LINE ID 已經註冊');
  }
  const info = await db.prepare(
    'INSERT INTO members (name, email, password_hash, phone, line_id) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email, hashPassword(password), phone, line);
  const member = await db.prepare(
    'SELECT id, name, email, phone, line_id, created_at FROM members WHERE id = ?'
  ).get(Number(info.lastInsertRowid));
  res.status(201).json({
    token: signToken({ typ: 'member', id: member.id }),
    member: publicMember(member)
  });
}));

router.post('/login', route(async (req, res) => {
  const account = String(req.body?.account || req.body?.email || '').trim();
  if (!account) throw new HttpError(400, '請填寫電子郵件、電話或 LINE ID');
  const password = String(req.body?.password || '');
  const member = await findByAccount(getDb(), account);
  const hash = member ? member.password_hash : dummyHash;
  const matched = verifyPassword(password, hash);
  if (!member || !matched) throw new HttpError(401, '帳號或密碼不正確');
  res.json({
    token: signToken({ typ: 'member', id: member.id }),
    member: publicMember(member)
  });
}));

router.get('/me', requireMember, route(async (req, res) => {
  const member = await getDb().prepare(
    'SELECT id, name, email, phone, line_id, created_at FROM members WHERE id = ?'
  ).get(req.auth.id);
  if (!member) throw new HttpError(401, '請先登入會員');
  res.json(publicMember(member));
}));

router.get('/orders', requireMember, route(async (req, res) => {
  res.json(await listOrders(getDb(), { memberId: req.auth.id }));
}));

function hashSecret(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('hex');
}

function sameSecret(stored, secret) {
  const left = Buffer.from(stored);
  const right = Buffer.from(hashSecret(secret));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function ticketRow(db, ticket) {
  return await db.prepare(`
    SELECT id, secret_hash, member_id, status,
           CASE WHEN expires_at <= datetime('now', 'localtime') THEN 1 ELSE 0 END AS expired
    FROM login_tickets
    WHERE id = ?
  `).get(ticket);
}

router.post('/qr/start', route(async (req, res) => {
  const db = getDb();
  await db.prepare("DELETE FROM login_tickets WHERE expires_at <= datetime('now', 'localtime') OR status = 'used'").run();
  const ticket = crypto.randomBytes(16).toString('hex');
  const secret = crypto.randomBytes(24).toString('hex');
  await db.prepare(`
    INSERT INTO login_tickets (id, secret_hash, expires_at)
    VALUES (?, ?, datetime('now', 'localtime', '+5 minutes'))
  `).run(ticket, hashSecret(secret));
  const url = `${req.protocol}://${req.get('host')}/member.html?login=${ticket}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  res.json({
    ticket,
    secret,
    svg: svg.replace(/<\?xml[^>]*>/, '').trim()
  });
}));

router.post('/qr/poll', route(async (req, res) => {
  const ticket = String(req.body?.ticket || '');
  const secret = String(req.body?.secret || '');
  const db = getDb();
  const row = await ticketRow(db, ticket);
  if (!row || !sameSecret(row.secret_hash, secret)) throw new HttpError(404, '這個登入碼已失效');
  if (row.expired) {
    await db.prepare('DELETE FROM login_tickets WHERE id = ?').run(ticket);
    return res.json({ status: 'expired' });
  }
  if (row.status === 'pending') return res.json({ status: 'pending' });
  if (row.status !== 'confirmed' || !row.member_id) throw new HttpError(410, '這個登入碼已經用過');
  const claimed = await db.prepare(
    "UPDATE login_tickets SET status = 'used' WHERE id = ? AND status = 'confirmed'"
  ).run(ticket);
  if (!claimed.changes) throw new HttpError(410, '這個登入碼已經用過');
  const member = await db.prepare(
    'SELECT id, name, email, phone, line_id, created_at FROM members WHERE id = ?'
  ).get(row.member_id);
  if (!member) throw new HttpError(404, '這個登入碼已失效');
  res.json({
    status: 'confirmed',
    token: signToken({ typ: 'member', id: member.id }),
    member: publicMember(member)
  });
}));

router.post('/qr/confirm', requireMember, route(async (req, res) => {
  const ticket = String(req.body?.ticket || '');
  const db = getDb();
  const row = await ticketRow(db, ticket);
  if (!row || row.expired || row.status === 'used') throw new HttpError(410, '這個登入碼已失效');
  if (row.status === 'confirmed' && row.member_id !== req.auth.id) {
    throw new HttpError(409, '這個登入碼已經被其他會員確認');
  }
  await db.prepare(`
    UPDATE login_tickets
    SET member_id = ?, status = 'confirmed'
    WHERE id = ? AND status IN ('pending', 'confirmed')
  `).run(req.auth.id, ticket);
  res.json({ ok: true });
}));

module.exports = router;
