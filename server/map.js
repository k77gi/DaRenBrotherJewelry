const { imageSet } = require('./visuals');

const PRODUCT_SELECT = `
  p.id, p.category_id, c.name AS category_name, c.slug AS category_slug,
  p.name, p.slug, p.summary, p.description, p.price, p.material,
  p.weight_grams, p.stock, p.colors, p.care, p.main_image, p.detail_images, p.extra_fields,
  p.is_published, p.created_at, p.updated_at
`;

const ARTICLE_SELECT = `
  a.id, a.title, a.slug, a.summary, a.content, a.cover_image, a.is_published,
  a.author_admin_id, admins.name AS author_name,
  a.published_at, a.created_at, a.updated_at
`;

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function extraFieldsOf(row) {
  let fields = [];
  try {
    fields = JSON.parse(row.extra_fields || '[]');
  } catch (error) {
    fields = [];
  }
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((item) => item && item.label && item.value)
    .map((item) => ({ label: String(item.label), value: String(item.value) }));
}

function detailsOf(row) {
  let details = [];
  try {
    details = JSON.parse(row.detail_images || '[]');
  } catch (error) {
    details = [];
  }
  if (!Array.isArray(details)) return [];
  return details.filter(Boolean);
}

function productImages(row) {
  const images = [];
  if (row.main_image) images.push({ src: row.main_image, label: '主圖' });
  detailsOf(row).forEach((src, index) => {
    images.push({ src, label: `細節 ${index + 1}` });
  });
  if (images.length) return images;
  return imageSet(row.slug);
}

function mapProduct(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    name: row.name,
    slug: row.slug,
    summary: row.summary,
    description: row.description,
    price: row.price,
    material: row.material,
    weightGrams: row.weight_grams,
    stock: row.stock,
    colors: String(row.colors || '').split('|').map((item) => item.trim()).filter(Boolean),
    care: row.care || '',
    mainImage: row.main_image || '',
    detailImages: detailsOf(row),
    extraFields: extraFieldsOf(row),
    images: productImages(row),
    isPublished: !!row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapArticle(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content: row.content,
    isPublished: !!row.is_published,
    authorAdminId: row.author_admin_id,
    authorName: row.author_name || '大仁哥的珠寶小舖',
    coverImage: row.cover_image || '',
    thumbnail: row.cover_image || `/images/articles/${row.slug}.svg`,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMember(row) {
  const email = String(row.email || '');
  return {
    id: row.id,
    name: row.name,
    email: email.endsWith('@members.local') ? '' : email,
    phone: row.phone || '',
    lineId: row.line_id || '',
    createdAt: row.created_at
  };
}

function mapOrder(row) {
  return {
    id: row.id,
    orderNo: row.order_no,
    memberId: row.member_id,
    buyerName: row.buyer_name,
    buyerEmail: row.buyer_email,
    buyerPhone: row.buyer_phone,
    shippingAddress: row.shipping_address,
    note: row.note,
    paymentMethod: row.payment_method || '',
    trackingNo: row.tracking_no || '',
    status: row.status,
    subtotal: row.subtotal,
    shippingFee: row.shipping_fee,
    total: row.total,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapOrderItem(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    unitPrice: row.unit_price,
    quantity: row.quantity,
    lineTotal: row.line_total
  };
}

function mapAudit(row) {
  return {
    id: row.id,
    adminId: row.admin_id,
    adminName: row.admin_name || '系統',
    username: row.username || '',
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    detail: row.detail,
    ipAddress: row.ip_address,
    createdAt: row.created_at
  };
}

module.exports = {
  PRODUCT_SELECT,
  ARTICLE_SELECT,
  mapCategory,
  mapProduct,
  mapArticle,
  mapMember,
  mapOrder,
  mapOrderItem,
  mapAudit
};
