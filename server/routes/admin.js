const express = require('express');
const { getDb } = require('../db');
const { HttpError } = require('../httpError');
const {
  route,
  requiredText,
  optionalText,
  requiredEmail,
  requiredInt,
  optionalNumber,
  idParam,
  timestamp,
  requestIp
} = require('../util');
const {
  signToken,
  requireAdmin,
  requireAny,
  requirePermission,
  allows
} = require('../middleware/auth');
const { PRODUCT_SELECT, ARTICLE_SELECT, mapProduct, mapArticle, mapMember, mapAudit } = require('../map');
const { writeAudit } = require('../audit');
const { listOrders, setOrderStatus, setTracking } = require('../orderService');
const { MODULES, modulesFor } = require('../permissions');
const { createCaptcha, consumeCaptcha } = require('../captcha');
const { saveUpload, cleanImagePath } = require('../uploads');
const { hashPassword, verifyPassword, sanitizePlain } = require('../security');

const router = express.Router();
const LOCK_MINUTES = 15;
const LOCK_AFTER = 5;

function readFlag(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function laterTimestamp(minutes) {
  const date = new Date(Date.now() + minutes * 60 * 1000);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function lockState(db, username) {
  const row = db.prepare(
    'SELECT fail_count, locked_until FROM admin_login_locks WHERE username = ?'
  ).get(username);
  if (!row) return { failCount: 0, locked: false };
  if (row.locked_until && row.locked_until > timestamp()) {
    return { failCount: row.fail_count, locked: true };
  }
  if (row.locked_until) {
    db.prepare(
      'UPDATE admin_login_locks SET fail_count = 0, locked_until = NULL WHERE username = ?'
    ).run(username);
    return { failCount: 0, locked: false };
  }
  return { failCount: row.fail_count, locked: false };
}

function recordLoginFailure(db, username) {
  const state = lockState(db, username);
  const failCount = state.failCount + 1;
  const lockedUntil = failCount >= LOCK_AFTER ? laterTimestamp(LOCK_MINUTES) : null;
  db.prepare(`
    INSERT INTO admin_login_locks (username, fail_count, locked_until)
    VALUES (?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET fail_count = excluded.fail_count, locked_until = excluded.locked_until
  `).run(username, failCount, lockedUntil);
  return failCount >= LOCK_AFTER;
}

function clearLoginFailure(db, username) {
  db.prepare('DELETE FROM admin_login_locks WHERE username = ?').run(username);
}

router.get('/captcha', route((req, res) => {
  res.json(createCaptcha());
}));

router.post('/login', route((req, res) => {
  const username = requiredText(req.body?.username, 40, '帳號').toLowerCase();
  const password = String(req.body?.password || '');
  const db = getDb();
  if (lockState(db, username).locked) {
    throw new HttpError(429, `連續錯誤 ${LOCK_AFTER} 次，此帳號已鎖定 ${LOCK_MINUTES} 分鐘`);
  }
  const captchaOk = consumeCaptcha(req.body?.captchaId, req.body?.captchaCode);
  const admin = db.prepare(`
    SELECT a.id, a.name, a.username, a.password_hash, a.is_active, r.name AS role_name
    FROM admins a
    JOIN roles r ON r.id = a.role_id
    WHERE a.username = ?
  `).get(username);
  const matched = admin ? verifyPassword(password, admin.password_hash) : false;
  if (!captchaOk || !admin || !matched) {
    const locked = recordLoginFailure(db, username);
    writeAudit(db, {
      action: 'admin.login_failed',
      targetType: 'admin',
      detail: { username, reason: captchaOk ? 'credentials' : 'captcha' },
      ip: requestIp(req)
    });
    if (locked) {
      throw new HttpError(429, `連續錯誤 ${LOCK_AFTER} 次，此帳號已鎖定 ${LOCK_MINUTES} 分鐘`);
    }
    throw new HttpError(401, captchaOk ? '帳號或密碼不正確' : '驗證碼不正確，請重新輸入');
  }
  if (!admin.is_active) throw new HttpError(403, '此帳號已停用，請聯絡最大管理者');
  clearLoginFailure(db, username);
  writeAudit(db, {
    adminId: admin.id,
    action: 'admin.login',
    targetType: 'admin',
    targetId: admin.id,
    ip: requestIp(req)
  });
  res.json({
    token: signToken({ typ: 'admin', id: admin.id }),
    admin: {
      id: admin.id,
      name: admin.name,
      username: admin.username,
      roleName: admin.role_name
    }
  });
}));

router.use(requireAdmin);

router.get('/me', route((req, res) => {
  const permissions = getDb().prepare(`
    SELECT p.code, p.name, p.description
    FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    JOIN admins a ON a.role_id = rp.role_id
    WHERE a.id = ?
    ORDER BY p.id
  `).all(req.admin.id);
  res.json({
    id: req.admin.id,
    name: req.admin.name,
    username: req.admin.username,
    role: {
      code: req.admin.roleCode,
      name: req.admin.roleName,
      level: req.admin.roleLevel
    },
    permissions
  });
}));

router.get('/summary', route((req, res) => {
  const db = getDb();
  const summary = {};
  if (allows(req, 'catalog.read', 'products.write')) {
    summary.productCount = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  }
  if (allows(req, 'articles.read', 'articles.write')) {
    summary.articleCount = db.prepare('SELECT COUNT(*) AS n FROM articles').get().n;
  }
  if (allows(req, 'orders.read')) {
    summary.orderCount = db.prepare('SELECT COUNT(*) AS n FROM orders').get().n;
    summary.pendingOrderCount = db.prepare(
      "SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'"
    ).get().n;
  }
  if (allows(req, 'members.read')) {
    summary.memberCount = db.prepare('SELECT COUNT(*) AS n FROM members').get().n;
  }
  res.json(summary);
}));

function colorText(value) {
  const text = optionalText(value, 80, '顏色');
  const parts = text.split(/[|,、，]/).map((item) => item.trim()).filter(Boolean);
  if (parts.length > 8) throw new HttpError(400, '顏色最多 8 種');
  return parts.join('|');
}

function imageList(value) {
  const list = Array.isArray(value) ? value : [];
  if (list.length > 8) throw new HttpError(400, '細節圖最多 8 張');
  return list.map(cleanImagePath).filter(Boolean);
}

function productBody(body) {
  return {
    categoryId: requiredInt(body.categoryId, '分類', { min: 1 }),
    name: requiredText(body.name, 80, '商品名稱'),
    summary: optionalText(body.summary, 200, '品牌簡介'),
    description: optionalText(body.description, 4000, '商品說明'),
    price: requiredInt(body.price, '價格', { min: 0, max: 10000000 }),
    material: optionalText(body.material, 80, '材質'),
    weightGrams: optionalNumber(body.weightGrams, '重量'),
    stock: requiredInt(body.stock, '庫存', { min: 0, max: 100000 }),
    colors: colorText(body.colors),
    care: optionalText(body.care, 2000, '保養說明'),
    mainImage: cleanImagePath(body.mainImage),
    detailImages: imageList(body.detailImages),
    isPublished: readFlag(body.isPublished) ? 1 : 0
  };
}

function loadAdminProduct(db, id) {
  return db.prepare(`
    SELECT ${PRODUCT_SELECT}
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.id = ?
  `).get(id);
}

router.get('/products', requireAny('catalog.read', 'products.write'), route((req, res) => {
  const rows = getDb().prepare(`
    SELECT ${PRODUCT_SELECT}
    FROM products p
    JOIN categories c ON c.id = p.category_id
    ORDER BY p.id
  `).all();
  res.json(rows.map(mapProduct));
}));

router.post('/products', requirePermission('products.write'), route((req, res) => {
  const input = productBody(req.body || {});
  const db = getDb();
  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(input.categoryId);
  if (!category) throw new HttpError(400, '請選擇有效的分類');
  const slug = `draft-${Date.now()}`;
  const info = db.prepare(`
    INSERT INTO products (
      category_id, name, slug, summary, description, price, material, weight_grams, stock,
      colors, care, main_image, detail_images, is_published
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.categoryId, input.name, slug, input.summary, input.description,
    input.price, input.material, input.weightGrams, input.stock,
    input.colors, input.care, input.mainImage, JSON.stringify(input.detailImages), input.isPublished
  );
  const id = Number(info.lastInsertRowid);
  db.prepare('UPDATE products SET slug = ? WHERE id = ?').run(`product-${id}`, id);
  writeAudit(db, {
    adminId: req.admin.id,
    action: 'product.create',
    targetType: 'product',
    targetId: id,
    detail: { name: input.name, price: input.price, stock: input.stock, colors: input.colors },
    ip: requestIp(req)
  });
  res.status(201).json(mapProduct(loadAdminProduct(db, id)));
}));

router.put('/products/:id', requirePermission('products.write'), route((req, res) => {
  const id = idParam(req.params.id);
  const input = productBody(req.body || {});
  const db = getDb();
  const current = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!current) throw new HttpError(404, '找不到這個商品');
  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(input.categoryId);
  if (!category) throw new HttpError(400, '請選擇有效的分類');
  db.prepare(`
    UPDATE products
    SET category_id = ?, name = ?, summary = ?, description = ?, price = ?,
        material = ?, weight_grams = ?, stock = ?, colors = ?, care = ?,
        main_image = ?, detail_images = ?, is_published = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.categoryId, input.name, input.summary, input.description, input.price,
    input.material, input.weightGrams, input.stock, input.colors, input.care,
    input.mainImage, JSON.stringify(input.detailImages), input.isPublished, timestamp(), id
  );
  writeAudit(db, {
    adminId: req.admin.id,
    action: 'product.update',
    targetType: 'product',
    targetId: id,
    detail: { name: input.name, price: input.price, stock: input.stock, isPublished: input.isPublished },
    ip: requestIp(req)
  });
  res.json(mapProduct(loadAdminProduct(db, id)));
}));

router.delete('/products/:id', requirePermission('products.write'), route((req, res) => {
  const id = idParam(req.params.id);
  const db = getDb();
  const current = db.prepare('SELECT id, name FROM products WHERE id = ?').get(id);
  if (!current) throw new HttpError(404, '找不到這個商品');
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  writeAudit(db, {
    adminId: req.admin.id,
    action: 'product.delete',
    targetType: 'product',
    targetId: id,
    detail: { name: current.name },
    ip: requestIp(req)
  });
  res.json({ ok: true });
}));

router.post('/categories', requirePermission('categories.write'), route((req, res) => {
  const name = requiredText(req.body?.name, 40, '分類名稱');
  const description = optionalText(req.body?.description, 200, '分類說明');
  const db = getDb();
  const sort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM categories').get().n + 1;
  const info = db.prepare(
    'INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)'
  ).run(name, `draft-${Date.now()}`, description, sort);
  const id = Number(info.lastInsertRowid);
  db.prepare('UPDATE categories SET slug = ? WHERE id = ?').run(`category-${id}`, id);
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  writeAudit(db, {
    adminId: req.admin.id,
    action: 'category.create',
    targetType: 'category',
    targetId: id,
    detail: { name },
    ip: requestIp(req)
  });
  res.status(201).json({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order
  });
}));

function publishedDate(value) {
  const text = requiredText(value, 10, '發布日期');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new HttpError(400, '發布日期格式不正確');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    throw new HttpError(400, '發布日期格式不正確');
  }
  return `${text} 12:00:00`;
}

function articleBody(body) {
  const content = sanitizePlain(body.content, 8000, '內文', { required: true });
  const summary = sanitizePlain(body.summary, 200, '摘要');
  return {
    title: sanitizePlain(body.title, 120, '標題', { required: true }),
    summary: summary || content.replace(/\s+/g, ' ').slice(0, 80),
    content,
    coverImage: cleanImagePath(body.coverImage),
    publishedAt: publishedDate(body.publishedAt),
    isPublished: readFlag(body.isPublished) ? 1 : 0
  };
}

function loadArticle(db, id) {
  return db.prepare(`
    SELECT ${ARTICLE_SELECT}
    FROM articles a
    LEFT JOIN admins ON admins.id = a.author_admin_id
    WHERE a.id = ?
  `).get(id);
}

router.get('/articles', requireAny('articles.read', 'articles.write'), route((req, res) => {
  const rows = getDb().prepare(`
    SELECT ${ARTICLE_SELECT}
    FROM articles a
    LEFT JOIN admins ON admins.id = a.author_admin_id
    ORDER BY a.id DESC
  `).all();
  res.json(rows.map(mapArticle));
}));

router.post('/articles', requirePermission('articles.write'), route((req, res) => {
  const input = articleBody(req.body || {});
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO articles (title, slug, summary, content, cover_image, is_published, author_admin_id, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.title,
    `draft-${Date.now()}`,
    input.summary,
    input.content,
    input.coverImage,
    input.isPublished,
    req.admin.id,
    input.publishedAt
  );
  const id = Number(info.lastInsertRowid);
  db.prepare('UPDATE articles SET slug = ? WHERE id = ?').run(`article-${id}`, id);
  writeAudit(db, {
    adminId: req.admin.id,
    action: 'article.create',
    targetType: 'article',
    targetId: id,
    detail: { title: input.title, publishedAt: input.publishedAt },
    ip: requestIp(req)
  });
  res.status(201).json(mapArticle(loadArticle(db, id)));
}));

router.put('/articles/:id', requirePermission('articles.write'), route((req, res) => {
  const id = idParam(req.params.id);
  const input = articleBody(req.body || {});
  const db = getDb();
  const current = db.prepare('SELECT id FROM articles WHERE id = ?').get(id);
  if (!current) throw new HttpError(404, '找不到這篇文章');
  db.prepare(`
    UPDATE articles
    SET title = ?, summary = ?, content = ?, cover_image = ?, is_published = ?, published_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.title, input.summary, input.content, input.coverImage,
    input.isPublished, input.publishedAt, timestamp(), id
  );
  writeAudit(db, {
    adminId: req.admin.id,
    action: 'article.update',
    targetType: 'article',
    targetId: id,
    detail: { title: input.title, isPublished: input.isPublished, publishedAt: input.publishedAt },
    ip: requestIp(req)
  });
  res.json(mapArticle(loadArticle(db, id)));
}));

router.delete('/articles/:id', requirePermission('articles.write'), route((req, res) => {
  const id = idParam(req.params.id);
  const db = getDb();
  const current = db.prepare('SELECT id, title FROM articles WHERE id = ?').get(id);
  if (!current) throw new HttpError(404, '找不到這篇文章');
  db.prepare('DELETE FROM articles WHERE id = ?').run(id);
  writeAudit(db, {
    adminId: req.admin.id,
    action: 'article.delete',
    targetType: 'article',
    targetId: id,
    detail: { title: current.title },
    ip: requestIp(req)
  });
  res.json({ ok: true });
}));

router.get('/orders', requirePermission('orders.read'), route((req, res) => {
  res.json(listOrders(getDb()));
}));

router.patch('/orders/:id/tracking', requirePermission('orders.write'), route((req, res) => {
  const id = idParam(req.params.id);
  const order = setTracking(getDb(), id, req.body?.trackingNo, {
    adminId: req.admin.id,
    ip: requestIp(req)
  });
  res.json(order);
}));

router.patch('/orders/:id/status', requirePermission('orders.write'), route((req, res) => {
  const id = idParam(req.params.id);
  const status = requiredText(req.body?.status, 20, '訂單狀態');
  const order = setOrderStatus(getDb(), id, status, {
    adminId: req.admin.id,
    ip: requestIp(req)
  });
  res.json(order);
}));

router.get('/members', requirePermission('members.read'), route((req, res) => {
  const rows = getDb().prepare(
    'SELECT id, name, email, phone, line_id, created_at FROM members ORDER BY id DESC'
  ).all();
  res.json(rows.map(mapMember));
}));

router.post('/uploads', requireAny('products.write', 'articles.write'), route(async (req, res) => {
  const url = await saveUpload(req);
  res.status(201).json({ url });
}));

router.get('/roles', requireAny('admins.read', 'permissions.write'), route((req, res) => {
  const db = getDb();
  const roles = db.prepare(`
    SELECT id, code, name, description, role_level
    FROM roles
    ORDER BY role_level, id
  `).all().map((role) => {
    const codes = db.prepare(`
      SELECT p.code
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = ?
    `).all(role.id).map((row) => row.code);
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      level: role.role_level,
      modules: modulesFor(codes),
      locked: role.code === 'super_admin'
    };
  });
  res.json({
    modules: MODULES.map((item) => ({ code: item.code, name: item.name })),
    roles
  });
}));

router.put('/roles/:id/modules', requirePermission('permissions.write'), route((req, res) => {
  const id = idParam(req.params.id);
  const db = getDb();
  const role = db.prepare('SELECT id, code, name FROM roles WHERE id = ?').get(id);
  if (!role) throw new HttpError(404, '找不到這個角色');
  if (role.code === 'super_admin') throw new HttpError(400, '最大管理者固定擁有全部模組');
  const requested = Array.isArray(req.body?.modules) ? req.body.modules : null;
  if (!requested) throw new HttpError(400, '請勾選可使用的模組');
  const unknown = requested.filter((code) => !MODULES.some((item) => item.code === code));
  if (unknown.length) throw new HttpError(400, '有無法辨識的模組');
  const codes = [...new Set(MODULES
    .filter((item) => requested.includes(item.code))
    .flatMap((item) => item.permissions))];
  const permissionIds = db.prepare('SELECT id, code FROM permissions').all();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(id);
    const insert = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const code of codes) {
      const permission = permissionIds.find((item) => item.code === code);
      if (!permission) throw new HttpError(400, '權限資料不完整');
      insert.run(id, permission.id);
    }
    writeAudit(db, {
      adminId: req.admin.id,
      action: 'role.permissions',
      targetType: 'role',
      targetId: id,
      detail: { role: role.name, modules: requested },
      ip: requestIp(req)
    });
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (rollbackError) { /* 沒有進行中的交易時略過 */ }
    throw error;
  }
  res.json({ ok: true, modules: modulesFor(codes) });
}));

router.post('/admins', requirePermission('admins.write'), route((req, res) => {
  const name = requiredText(req.body?.name, 40, '名稱');
  const username = requiredText(req.body?.username, 40, '帳號').toLowerCase();
  const email = requiredEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const roleId = requiredInt(req.body?.roleId, '角色', { min: 1 });
  if (!/^[a-z0-9]{3,20}$/.test(username)) throw new HttpError(400, '帳號請使用 3 到 20 個英數小寫');
  if (password.length < 8 || password.length > 72) throw new HttpError(400, '密碼請設定 8 到 72 個字元');
  const db = getDb();
  const role = db.prepare('SELECT id, name, code FROM roles WHERE id = ?').get(roleId);
  if (!role) throw new HttpError(400, '請選擇有效的角色');
  if (db.prepare('SELECT id FROM admins WHERE username = ?').get(username)) {
    throw new HttpError(400, '這個帳號已經有人使用');
  }
  if (db.prepare('SELECT id FROM admins WHERE email = ?').get(email)) {
    throw new HttpError(400, '這個電子郵件已經有人使用');
  }
  const info = db.prepare(`
    INSERT INTO admins (role_id, name, username, email, password_hash)
    VALUES (?, ?, ?, ?, ?)
  `).run(roleId, name, username, email, hashPassword(password));
  const id = Number(info.lastInsertRowid);
  writeAudit(db, {
    adminId: req.admin.id,
    action: 'admin.create',
    targetType: 'admin',
    targetId: id,
    detail: { username, role: role.name },
    ip: requestIp(req)
  });
  res.status(201).json({ id, name, username, roleName: role.name });
}));

router.get('/admins', requirePermission('admins.read'), route((req, res) => {
  const rows = getDb().prepare(`
    SELECT a.id, a.name, a.username, a.email, a.is_active, a.created_at,
           r.name AS role_name, r.code AS role_code, r.role_level
    FROM admins a
    JOIN roles r ON r.id = a.role_id
    ORDER BY r.role_level, a.id
  `).all();
  res.json(rows.map((row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    isActive: !!row.is_active,
    roleName: row.role_name,
    roleCode: row.role_code,
    roleLevel: row.role_level,
    createdAt: row.created_at
  })));
}));

router.patch('/admins/:id', requirePermission('admins.write'), route((req, res) => {
  const id = idParam(req.params.id);
  if (id === req.admin.id) throw new HttpError(400, '不能停用自己的帳號');
  const isActive = readFlag(req.body?.isActive) ? 1 : 0;
  const db = getDb();
  const current = db.prepare('SELECT id, username FROM admins WHERE id = ?').get(id);
  if (!current) throw new HttpError(404, '找不到這個管理員');
  db.prepare('UPDATE admins SET is_active = ?, updated_at = ? WHERE id = ?').run(isActive, timestamp(), id);
  writeAudit(db, {
    adminId: req.admin.id,
    action: 'admin.status',
    targetType: 'admin',
    targetId: id,
    detail: { username: current.username, isActive },
    ip: requestIp(req)
  });
  res.json({ ok: true, isActive: !!isActive });
}));

function bannerImage(value) {
  const text = String(value || '').trim();
  if (/^\/images\/banners\/[a-z0-9.-]+\.svg$/i.test(text)) return text;
  return cleanImagePath(text);
}

function bannerLink(value) {
  const text = sanitizePlain(value, 120, '連結', { required: true });
  if (!text.startsWith('/') || text.startsWith('//') || text.includes('\\')) {
    throw new HttpError(400, '連結請填本站路徑，例如 /shop.html');
  }
  return text;
}

function bannerBody(body) {
  const image = bannerImage(body.image);
  if (!image) throw new HttpError(400, '請上傳主視覺圖片');
  return {
    eyebrow: sanitizePlain(body.eyebrow, 40, '小標'),
    title: sanitizePlain(body.title, 80, '標題', { required: true }),
    body: sanitizePlain(body.body, 200, '說明'),
    linkHref: bannerLink(body.linkHref),
    linkLabel: sanitizePlain(body.linkLabel, 20, '按鈕文字', { required: true }),
    image,
    altText: sanitizePlain(body.altText, 80, '圖片說明'),
    imageWidth: requiredInt(body.imageWidth, '圖片寬度', { min: 40, max: 100 }),
    imageHeight: requiredInt(body.imageHeight, '圖片高度', { min: 80, max: 480 }),
    sortOrder: requiredInt(body.sortOrder, '排序', { min: 0, max: 999 }),
    isPublished: readFlag(body.isPublished) ? 1 : 0
  };
}

function mapAdminBanner(row) {
  return {
    id: row.id,
    eyebrow: row.eyebrow,
    title: row.title,
    body: row.body,
    linkHref: row.link_href,
    linkLabel: row.link_label,
    image: row.image,
    altText: row.alt_text,
    imageWidth: row.image_width || 100,
    imageHeight: row.image_height || 240,
    sortOrder: row.sort_order,
    isPublished: !!row.is_published
  };
}

router.get('/banners', requirePermission('products.write'), route((req, res) => {
  const rows = getDb().prepare(`
    SELECT id, eyebrow, title, body, link_href, link_label, image, alt_text,
           image_width, image_height, sort_order, is_published
    FROM banners
    ORDER BY sort_order, id
  `).all();
  res.json(rows.map(mapAdminBanner));
}));

router.post('/banners', requirePermission('products.write'), route((req, res) => {
  const input = bannerBody(req.body || {});
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO banners (
      eyebrow, title, body, link_href, link_label, image, alt_text,
      image_width, image_height, sort_order, is_published
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.eyebrow, input.title, input.body, input.linkHref, input.linkLabel,
    input.image, input.altText, input.imageWidth, input.imageHeight, input.sortOrder, input.isPublished
  );
  const id = Number(info.lastInsertRowid);
  writeAudit(db, {
    adminId: req.admin.id,
    action: 'banner.create',
    targetType: 'banner',
    targetId: id,
    detail: { title: input.title },
    ip: requestIp(req)
  });
  res.status(201).json(mapAdminBanner(db.prepare('SELECT * FROM banners WHERE id = ?').get(id)));
}));

router.put('/banners/:id', requirePermission('products.write'), route((req, res) => {
  const id = idParam(req.params.id);
  const input = bannerBody(req.body || {});
  const db = getDb();
  const current = db.prepare('SELECT id FROM banners WHERE id = ?').get(id);
  if (!current) throw new HttpError(404, '找不到這張主視覺');
  db.prepare(`
    UPDATE banners
    SET eyebrow = ?, title = ?, body = ?, link_href = ?, link_label = ?,
        image = ?, alt_text = ?, image_width = ?, image_height = ?,
        sort_order = ?, is_published = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.eyebrow, input.title, input.body, input.linkHref, input.linkLabel,
    input.image, input.altText, input.imageWidth, input.imageHeight,
    input.sortOrder, input.isPublished, timestamp(), id
  );
  writeAudit(db, {
    adminId: req.admin.id,
    action: 'banner.update',
    targetType: 'banner',
    targetId: id,
    detail: { title: input.title },
    ip: requestIp(req)
  });
  res.json(mapAdminBanner(db.prepare('SELECT * FROM banners WHERE id = ?').get(id)));
}));

router.delete('/banners/:id', requirePermission('products.write'), route((req, res) => {
  const id = idParam(req.params.id);
  const db = getDb();
  const current = db.prepare('SELECT id, title FROM banners WHERE id = ?').get(id);
  if (!current) throw new HttpError(404, '找不到這張主視覺');
  db.prepare('DELETE FROM banners WHERE id = ?').run(id);
  writeAudit(db, {
    adminId: req.admin.id,
    action: 'banner.delete',
    targetType: 'banner',
    targetId: id,
    detail: { title: current.title },
    ip: requestIp(req)
  });
  res.json({ ok: true });
}));

router.get('/audit-logs', requirePermission('audit.read'), route((req, res) => {
  const rows = getDb().prepare(`
    SELECT l.id, l.admin_id, a.name AS admin_name, a.username, l.action,
           l.target_type, l.target_id, l.detail, l.ip_address, l.created_at
    FROM audit_logs l
    LEFT JOIN admins a ON a.id = l.admin_id
    ORDER BY l.id DESC
    LIMIT 100
  `).all();
  res.json(rows.map(mapAudit));
}));

module.exports = router;
