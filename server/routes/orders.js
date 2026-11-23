const express = require('express');
const { getDb } = require('../db');
const { HttpError } = require('../httpError');
const {
  route,
  requiredText,
  optionalText,
  requiredEmail,
  requiredPhone,
  requiredInt
} = require('../util');
const { optionalMember, requireMember } = require('../middleware/auth');
const { assertNoCardData, sanitizePlain } = require('../security');
const { createOrder, getOrderByNo, payOrder } = require('../orderService');
const { loadCvsSelection } = require('./logistics');

const router = express.Router();

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, '購物車是空的');
  if (items.length > 50) throw new HttpError(400, '一次結帳的品項過多');
  const merged = new Map();
  for (const item of items) {
    const productId = requiredInt(item?.productId, '商品', { min: 1 });
    const quantity = requiredInt(item?.quantity, '數量', { min: 1, max: 99 });
    const color = optionalText(item?.color, 20, '顏色');
    const key = `${productId}\n${color}`;
    const current = merged.get(key) || { productId, quantity: 0, color };
    current.quantity += quantity;
    merged.set(key, current);
  }
  const totals = new Map();
  for (const item of merged.values()) {
    totals.set(item.productId, (totals.get(item.productId) || 0) + item.quantity);
    if (item.quantity > 99) throw new HttpError(400, '同一商品最多 99 件');
  }
  for (const quantity of totals.values()) {
    if (quantity > 99) throw new HttpError(400, '同一商品最多 99 件');
  }
  return [...merged.values()];
}

router.post('/', optionalMember, route(async (req, res) => {
  const body = req.body || {};
  assertNoCardData(body);
  const delivery = String(body.delivery || 'home');
  if (!['home', 'cvs'].includes(delivery)) throw new HttpError(400, '請選擇收貨方式');
  const cvs = delivery === 'cvs' ? await loadCvsSelection(body.cvsToken) : null;
  const input = {
    buyerName: sanitizePlain(body.buyerName, 40, '收件人', { required: true }),
    buyerEmail: requiredEmail(body.buyerEmail),
    buyerPhone: requiredPhone(body.buyerPhone),
    shippingAddress: cvs
      ? cvs.cvsAddress
      : sanitizePlain(body.shippingAddress, 200, '收件地址', { required: true }),
    note: sanitizePlain(body.note, 300, '備註'),
    items: normalizeItems(body.items),
    memberId: null,
    cvsStoreId: cvs ? cvs.cvsStoreId : '',
    cvsStoreName: cvs ? cvs.cvsStoreName : '',
    cvsAddress: cvs ? cvs.cvsAddress : '',
    logisticsSubType: cvs ? cvs.logisticsSubType : ''
  };
  if (req.auth) {
    const member = await getDb().prepare('SELECT id FROM members WHERE id = ?').get(req.auth.id);
    if (member) input.memberId = member.id;
  }
  const order = await createOrder(getDb(), input);
  res.status(201).json(order);
}));

router.post('/lookup', route(async (req, res) => {
  const orderNo = requiredText(req.body?.orderNo, 40, '訂單編號');
  const email = requiredEmail(req.body?.email);
  const order = await getOrderByNo(getDb(), orderNo);
  if (!order || order.buyerEmail !== email) {
    throw new HttpError(404, '查無相符的訂單，請確認訂單編號與電子郵件');
  }
  res.json(order);
}));

router.post('/:orderNo/pay', optionalMember, route(async (req, res) => {
  assertNoCardData(req.body);
  const email = req.body?.email ? requiredEmail(req.body.email) : '';
  const order = await payOrder(getDb(), {
    orderNo: req.params.orderNo,
    method: requiredText(req.body?.method, 20, '付款方式'),
    email,
    memberId: req.auth ? req.auth.id : null
  });
  res.json(order);
}));

router.get('/:orderNo', requireMember, route(async (req, res) => {
  const order = await getOrderByNo(getDb(), req.params.orderNo);
  if (!order || order.memberId !== req.auth.id) {
    throw new HttpError(404, '查無相符的訂單');
  }
  res.json(order);
}));

module.exports = router;
