const express = require('express');
const { getDb } = require('../db');
const { route, requiredText, requiredEmail, requiredPhone } = require('../util');

const router = express.Router();

router.post('/', route((req, res) => {
  const body = req.body || {};
  const info = getDb().prepare(`
    INSERT INTO inquiries (name, phone, email, message)
    VALUES (?, ?, ?, ?)
  `).run(
    requiredText(body.name, 40, '姓名'),
    requiredPhone(body.phone),
    requiredEmail(body.email),
    requiredText(body.message, 1000, '諮詢內容')
  );
  res.status(201).json({ id: Number(info.lastInsertRowid) });
}));

module.exports = router;
