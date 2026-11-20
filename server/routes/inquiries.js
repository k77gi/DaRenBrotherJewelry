const express = require('express');
const { getDb } = require('../db');
const { route, requiredEmail, requiredPhone } = require('../util');
const { sanitizePlain } = require('../security');

const router = express.Router();

router.post('/', route((req, res) => {
  const body = req.body || {};
  const info = getDb().prepare(`
    INSERT INTO inquiries (name, phone, email, message)
    VALUES (?, ?, ?, ?)
  `).run(
    sanitizePlain(body.name, 40, '姓名', { required: true }),
    requiredPhone(sanitizePlain(body.phone, 20, '電話', { required: true })),
    requiredEmail(sanitizePlain(body.email, 120, '電子郵件', { required: true })),
    sanitizePlain(body.message, 1000, '諮詢內容', { required: true })
  );
  res.status(201).json({ id: Number(info.lastInsertRowid) });
}));

module.exports = router;
