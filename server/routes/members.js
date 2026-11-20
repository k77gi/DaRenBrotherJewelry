const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { HttpError } = require('../httpError');
const { route, requiredText, requiredEmail, optionalPhone } = require('../util');
const { signToken, requireMember } = require('../middleware/auth');
const { mapMember } = require('../map');
const { listOrders } = require('../orderService');

const router = express.Router();
const dummyHash = bcrypt.hashSync('dummy-password', 10);

function publicMember(row) {
  return mapMember(row);
}

router.post('/register', route((req, res) => {
  const name = requiredText(req.body?.name, 40, '姓名');
  const email = requiredEmail(req.body?.email);
  const password = String(req.body?.password || '');
  if (password.length < 8 || password.length > 72) {
    throw new HttpError(400, '密碼請設定 8 到 72 個字元');
  }
  const phone = optionalPhone(req.body?.phone);
  const db = getDb();
  const exists = db.prepare('SELECT id FROM members WHERE email = ?').get(email);
  if (exists) throw new HttpError(409, '這個電子郵件已經註冊');
  const info = db.prepare(
    'INSERT INTO members (name, email, password_hash, phone) VALUES (?, ?, ?, ?)'
  ).run(name, email, bcrypt.hashSync(password, 10), phone);
  const member = db.prepare(
    'SELECT id, name, email, phone, created_at FROM members WHERE id = ?'
  ).get(Number(info.lastInsertRowid));
  res.status(201).json({
    token: signToken({ typ: 'member', id: member.id }),
    member: publicMember(member)
  });
}));

router.post('/login', route((req, res) => {
  const email = requiredEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const member = getDb().prepare(
    'SELECT id, name, email, phone, password_hash, created_at FROM members WHERE email = ?'
  ).get(email);
  const hash = member ? member.password_hash : dummyHash;
  const matched = bcrypt.compareSync(password, hash);
  if (!member || !matched) throw new HttpError(401, '電子郵件或密碼不正確');
  res.json({
    token: signToken({ typ: 'member', id: member.id }),
    member: publicMember(member)
  });
}));

router.get('/me', requireMember, route((req, res) => {
  const member = getDb().prepare(
    'SELECT id, name, email, phone, created_at FROM members WHERE id = ?'
  ).get(req.auth.id);
  if (!member) throw new HttpError(401, '請先登入會員');
  res.json(publicMember(member));
}));

router.get('/orders', requireMember, route((req, res) => {
  res.json(listOrders(getDb(), { memberId: req.auth.id }));
}));

module.exports = router;
