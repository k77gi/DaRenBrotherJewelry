const config = require('./config');
const { HttpError } = require('./httpError');
const { timestamp } = require('./util');
const { mapOrder, mapOrderItem } = require('./map');
const { writeAudit } = require('./audit');

async function rollback(db) {
  try { await db.exec('ROLLBACK'); } catch (error) { /* 沒有進行中的交易時略過 */ }
}

async function mapFullOrder(db, row) {
  const items = await db.prepare(`
    SELECT id, product_id, product_name, unit_price, quantity, line_total
    FROM order_items
    WHERE order_id = ?
    ORDER BY id
  `).all(row.id);
  return { ...mapOrder(row), items: items.map(mapOrderItem) };
}

async function nextOrderNo(db) {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const orderNo = `DR${day}${suffix}`;
    const exists = await db.prepare('SELECT 1 AS found FROM orders WHERE order_no = ?').get(orderNo);
    if (!exists) return orderNo;
  }
  throw new HttpError(500, '訂單編號產生失敗，請再試一次');
}

async function createOrder(db, input) {
  let orderId;
  await db.exec('BEGIN IMMEDIATE');
  try {
    const lines = [];
    for (const item of input.items) {
      const product = await db.prepare(
        'SELECT id, name, price, stock, colors, is_published FROM products WHERE id = ?'
      ).get(item.productId);
      if (!product || !product.is_published) {
        throw new HttpError(400, '有商品已下架，請回購物車確認');
      }
      const colors = String(product.colors || '').split('|').map((color) => color.trim()).filter(Boolean);
      const color = item.color || colors[0] || '';
      if (colors.length && !colors.includes(color)) {
        throw new HttpError(400, `請選擇「${product.name}」的顏色`);
      }
      const needed = input.items
        .filter((entry) => entry.productId === item.productId)
        .reduce((sum, entry) => sum + entry.quantity, 0);
      if (product.stock < needed) {
        throw new HttpError(400, `「${product.name}」庫存只剩 ${product.stock} 件`);
      }
      const productName = color ? `${product.name}（${color}）` : product.name;
      lines.push({
        productId: product.id,
        productName,
        unitPrice: product.price,
        quantity: item.quantity,
        lineTotal: product.price * item.quantity
      });
    }

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const shippingFee = subtotal >= config.freeShippingThreshold ? 0 : config.shippingFee;
    const orderNo = await nextOrderNo(db);
    const info = await db.prepare(`
      INSERT INTO orders (
        order_no, member_id, buyer_name, buyer_email, buyer_phone,
        shipping_address, note, status, subtotal, shipping_fee, total,
        cvs_store_id, cvs_store_name, cvs_address, logistics_subtype
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderNo,
      input.memberId,
      input.buyerName,
      input.buyerEmail,
      input.buyerPhone,
      input.shippingAddress,
      input.note,
      subtotal,
      shippingFee,
      subtotal + shippingFee,
      input.cvsStoreId || '',
      input.cvsStoreName || '',
      input.cvsAddress || '',
      input.logisticsSubType || ''
    );
    orderId = Number(info.lastInsertRowid);
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const line of lines) {
      await insertItem.run(orderId, line.productId, line.productName, line.unitPrice, line.quantity, line.lineTotal);
    }
    await db.exec('COMMIT');
  } catch (error) {
    await rollback(db);
    throw error;
  }

  const row = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  return await mapFullOrder(db, row);
}

function holdsStock(status) {
  return status === 'paid' || status === 'shipped' || status === 'completed';
}

async function adjustStock(db, order, nextStatus) {
  const before = holdsStock(order.status);
  const after = holdsStock(nextStatus);
  if (before === after) return;

  const items = await db.prepare(
    'SELECT product_id, quantity, product_name FROM order_items WHERE order_id = ?'
  ).all(order.id);

  if (after) {
    for (const item of items) {
      if (!item.product_id) {
        throw new HttpError(400, `「${item.product_name}」已從商品刪除，無法完成付款`);
      }
      const result = await db.prepare(`
        UPDATE products SET stock = stock - ?, updated_at = ?
        WHERE id = ? AND stock >= ?
      `).run(item.quantity, timestamp(), item.product_id, item.quantity);
      if (result.changes !== 1) {
        throw new HttpError(400, `「${item.product_name}」庫存不足，無法完成付款`);
      }
    }
    return;
  }

  for (const item of items) {
    if (!item.product_id) continue;
    await db.prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?')
      .run(item.quantity, timestamp(), item.product_id);
  }
}

async function setOrderStatus(db, orderId, nextStatus, audit, extra = {}) {
  const allowed = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
  if (!allowed.includes(nextStatus)) throw new HttpError(400, '訂單狀態不正確');

  await db.exec('BEGIN IMMEDIATE');
  try {
    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new HttpError(404, '找不到這筆訂單');
    if (order.status !== nextStatus) {
      await adjustStock(db, order, nextStatus);
      await db.prepare(`
        UPDATE orders
        SET status = ?, payment_method = COALESCE(?, payment_method), updated_at = ?
        WHERE id = ?
      `).run(nextStatus, extra.paymentMethod || null, timestamp(), orderId);
      if (audit) {
        await writeAudit(db, {
          adminId: audit.adminId,
          action: 'order.status',
          targetType: 'order',
          targetId: orderId,
          detail: { orderNo: order.order_no, from: order.status, to: nextStatus },
          ip: audit.ip
        });
      }
    }
    await db.exec('COMMIT');
  } catch (error) {
    await rollback(db);
    throw error;
  }

  const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  return await mapFullOrder(db, updated);
}

async function setTracking(db, orderId, trackingNo, audit) {
  const order = await db.prepare('SELECT id, order_no, tracking_no FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new HttpError(404, '找不到這筆訂單');
  const value = String(trackingNo || '').trim();
  if (value.length > 40) throw new HttpError(400, '物流單號請少於 40 個字');
  if (value && !/^[A-Za-z0-9-]+$/.test(value)) {
    throw new HttpError(400, '物流單號只接受英數與減號');
  }
  await db.prepare('UPDATE orders SET tracking_no = ?, updated_at = ? WHERE id = ?').run(value, timestamp(), orderId);
  if (audit) {
    await writeAudit(db, {
      adminId: audit.adminId,
      action: 'order.tracking',
      targetType: 'order',
      targetId: orderId,
      detail: { orderNo: order.order_no, trackingNo: value },
      ip: audit.ip
    });
  }
  const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  return await mapFullOrder(db, updated);
}

async function listOrders(db, { memberId, limit = 100 } = {}) {
  const params = [];
  let sql = 'SELECT * FROM orders';
  if (memberId) {
    sql += ' WHERE member_id = ?';
    params.push(memberId);
  }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(limit);
  const rows = await db.prepare(sql).all(...params);
  return Promise.all(rows.map((row) => mapFullOrder(db, row)));
}

async function getOrderByNo(db, orderNo) {
  const row = await db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
  if (!row) return null;
  return await mapFullOrder(db, row);
}

async function payOrder(db, { orderNo, method, email, memberId }) {
  const methods = ['card', 'atm', 'linepay'];
  if (!methods.includes(method)) throw new HttpError(400, '請選擇付款方式');
  const row = await db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
  if (!row) throw new HttpError(404, '查無相符的訂單');
  const memberOk = memberId && row.member_id === memberId;
  const emailOk = email && row.buyer_email === email;
  if (!memberOk && !emailOk) {
    throw new HttpError(404, '查無相符的訂單，請確認訂單編號與電子郵件');
  }
  if (holdsStock(row.status)) throw new HttpError(400, '這筆訂單已經付款');
  if (row.status !== 'pending') throw new HttpError(400, '這筆訂單目前不能付款');
  return await setOrderStatus(db, row.id, 'paid', null, { paymentMethod: method });
}

module.exports = { createOrder, setOrderStatus, setTracking, listOrders, getOrderByNo, payOrder };
