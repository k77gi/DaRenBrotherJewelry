const express = require('express');
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

function findByAccount(db, account) {
  const text = String(account || '').trim();
  const phone = text.replace(/[\s()-]/g, '');
  return db.prepare(`
    SELECT id, name, email, phone, line_id, password_hash, created_at
    FROM members
    WHERE lower(email) = lower(?)
       OR (phone != '' AND phone = ?)
       OR (line_id != '' AND lower(line_id) = lower(?))
  `).get(text, phone, text);
}

router.post('/register', route((req, res) => {
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
  if (db.prepare('SELECT id FROM members WHERE lower(email) = lower(?)').get(email)) {
    throw new HttpError(409, '這個電子郵件已經註冊');
  }
  if (phone && db.prepare('SELECT id FROM members WHERE phone = ?').get(phone)) {
    throw new HttpError(409, '這個電話號碼已經註冊');
  }
  if (line && db.prepare('SELECT id FROM members WHERE lower(line_id) = lower(?)').get(line)) {
    throw new HttpError(409, '這個 LINE ID 已經註冊');
  }
  const info = db.prepare(
    'INSERT INTO members (name, email, password_hash, phone, line_id) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email, hashPassword(password), phone, line);
  const member = db.prepare(
    'SELECT id, name, email, phone, line_id, created_at FROM members WHERE id = ?'
  ).get(Number(info.lastInsertRowid));
  res.status(201).json({
    token: signToken({ typ: 'member', id: member.id }),
    member: publicMember(member)
  });
}));

router.post('/login', route((req, res) => {
  const account = String(req.body?.account || req.body?.email || '').trim();
  if (!account) throw new HttpError(400, '請填寫電子郵件、電話或 LINE ID');
  const password = String(req.body?.password || '');
  const member = findByAccount(getDb(), account);
  const hash = member ? member.password_hash : dummyHash;
  const matched = verifyPassword(password, hash);
  if (!member || !matched) throw new HttpError(401, '帳號或密碼不正確');
  res.json({
    token: signToken({ typ: 'member', id: member.id }),
    member: publicMember(member)
  });
}));

router.get('/me', requireMember, route((req, res) => {
  const member = getDb().prepare(
    'SELECT id, name, email, phone, line_id, created_at FROM members WHERE id = ?'
  ).get(req.auth.id);
  if (!member) throw new HttpError(401, '請先登入會員');
  res.json(publicMember(member));
}));

router.get('/orders', requireMember, route((req, res) => {
  res.json(listOrders(getDb(), { memberId: req.auth.id }));
}));

module.exports = router;
