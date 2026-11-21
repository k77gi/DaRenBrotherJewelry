const express = require('express');
const config = require('../config');
const { getDb } = require('../db');
const { HttpError } = require('../httpError');
const { route, idParam } = require('../util');
const { PRODUCT_SELECT, ARTICLE_SELECT, mapCategory, mapProduct, mapArticle } = require('../map');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true });
});

router.get('/shop', (req, res) => {
  res.json({
    name: '大仁哥的珠寶小舖',
    freeShippingThreshold: config.freeShippingThreshold,
    shippingFee: config.shippingFee,
    phone: config.phone,
    address: config.address,
    hours: config.hours
  });
});

router.get('/categories', route((req, res) => {
  const rows = getDb().prepare(`
    SELECT id, name, slug, description, sort_order, created_at, updated_at
    FROM categories
    ORDER BY sort_order, id
  `).all();
  res.json(rows.map(mapCategory));
}));

router.get('/products', route((req, res) => {
  const params = [];
  let where = 'WHERE p.is_published = 1';
  const category = req.query.category;
  if (category) {
    if (/^\d+$/.test(String(category))) {
      where += ' AND c.id = ?';
      params.push(Number(category));
    } else if (/^[a-z0-9-]{1,40}$/.test(String(category))) {
      where += ' AND c.slug = ?';
      params.push(String(category));
    } else {
      throw new HttpError(400, '分類格式不正確');
    }
  }
  const rows = getDb().prepare(`
    SELECT ${PRODUCT_SELECT}
    FROM products p
    JOIN categories c ON c.id = p.category_id
    ${where}
    ORDER BY p.id
  `).all(...params);
  res.json(rows.map(mapProduct));
}));

router.get('/products/:id', route((req, res) => {
  const row = getDb().prepare(`
    SELECT ${PRODUCT_SELECT}
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.id = ? AND p.is_published = 1
  `).get(idParam(req.params.id));
  if (!row) throw new HttpError(404, '找不到這個商品');
  res.json(mapProduct(row));
}));

function mapBanner(row) {
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

router.get('/banners', route((req, res) => {
  const rows = getDb().prepare(`
    SELECT id, eyebrow, title, body, link_href, link_label, image, alt_text,
           image_width, image_height, sort_order, is_published
    FROM banners
    WHERE is_published = 1
    ORDER BY sort_order, id
  `).all();
  res.json(rows.map(mapBanner));
}));

router.get('/articles', route((req, res) => {
  const rows = getDb().prepare(`
    SELECT ${ARTICLE_SELECT}
    FROM articles a
    LEFT JOIN admins ON admins.id = a.author_admin_id
    WHERE a.is_published = 1
    ORDER BY a.published_at DESC, a.id DESC
  `).all();
  res.json(rows.map(mapArticle));
}));

router.get('/articles/:id', route((req, res) => {
  const row = getDb().prepare(`
    SELECT ${ARTICLE_SELECT}
    FROM articles a
    LEFT JOIN admins ON admins.id = a.author_admin_id
    WHERE a.id = ? AND a.is_published = 1
  `).get(idParam(req.params.id));
  if (!row) throw new HttpError(404, '找不到這篇文章');
  res.json(mapArticle(row));
}));

module.exports = router;
