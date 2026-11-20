const { PERMISSIONS, ROLES, codesFor } = require('./permissions');
const { hashPassword } = require('./security');
const { timestamp } = require('./util');
const { writeAudit } = require('./audit');

const ACCOUNTS = [
  {
    name: '大仁哥',
    username: 'daren',
    email: 'daren@shop.local',
    password: 'Daren#2026',
    role: 'super_admin'
  },
  {
    name: '主要管理者',
    username: 'merch',
    email: 'merch@shop.local',
    password: 'Merch#2026',
    role: 'product_manager'
  },
  {
    name: '助理管理者',
    username: 'editor',
    email: 'editor@shop.local',
    password: 'Editor#2026',
    role: 'content_editor'
  }
];

const CATEGORIES = [
  ['項鍊', 'necklace', '珍珠與細鍊為主，適合日常佩戴。', 1],
  ['戒指', 'ring', '下單前請先量好戒圍，本店示範款為固定尺寸。', 2],
  ['手鍊', 'bracelet', '玉石與瑪瑙，選購時請對一下手圍。', 3],
  ['耳環', 'earring', '以貼耳、輕量的款式為主。', 4]
];

const PRODUCTS = [
  {
    category: 'necklace',
    name: '月光淡水珍珠項鍊',
    slug: 'pearl-necklace',
    summary: '圓潤白珍珠配細緻銀鏈，日常與聚餐都戴得住。',
    description: '這條項鍊以約 8 毫米的淡水珍珠為主體，光澤偏柔白，配上細銀鏈。鏈長約 42 公分，另附 5 公分延長鏈。\n\n珍珠會因皮膚油脂而更潤，平常用軟布擦拭即可。鏈身是 925 銀鍍金，請避免長時間碰水與香水。\n\n適合第一次買珍珠、想先戴看看的人。頁面上的庫存就是目前可售數量。',
    price: 6800,
    material: '淡水珍珠、925 銀鍍金',
    weight: 12.6,
    stock: 8
  },
  {
    category: 'ring',
    name: '細金圓鑽戒指',
    slug: 'gold-diamond-ring',
    summary: '14K 金單鑽，戒身細、鑽石小而清楚。',
    description: '戒身約 1.5 毫米寬，鑽石約 0.05 克拉，四爪鑲法，側面看得到金的厚度，比較不容易勾到衣物。\n\n固定戒圍 11 號，內徑約 16.5 毫米。下單前請先量好常用戒圍，這個示範站不提供改圈。\n\n14K 金適合每天戴。洗手與做家事時建議取下。',
    price: 12800,
    material: '14K 黃金、圓形鑽石',
    weight: 2.3,
    stock: 4
  },
  {
    category: 'bracelet',
    name: '青玉平安扣手鍊',
    slug: 'jade-bracelet',
    summary: '小顆青玉平安扣，彈力繩可直接套上手腕。',
    description: '平安扣直徑約 15 毫米，顏色是淡青綠色，帶一點天然紋路。每顆紋路不會完全一樣。\n\n手圍以 14 到 16 公分為主。彈力繩戴久了會鬆，鬆了就不要再硬撐。\n\n玉石怕碰撞，收納時不要跟金屬鍊堆在一起。',
    price: 4200,
    material: '天然青玉、彈力繩',
    weight: 16.8,
    stock: 10
  },
  {
    category: 'earring',
    name: '雙色金小圓耳釘',
    slug: 'two-tone-studs',
    summary: '黃金與白金交錯的小圓片，沒有垂墜，上班也好戴。',
    description: '耳釘直徑約 6 毫米，正面是黃白金相間的圓形。耳針為 14K 金，附矽膠耳迫。\n\n這款沒有鑲石，重量輕。剛打耳洞、還在恢復期的人不建議佩戴。對金屬過敏的人，請先確認自己能戴 14K 金。\n\n庫存 1 件代表一對。',
    price: 3600,
    material: '14K 雙色金',
    weight: 1.6,
    stock: 14
  },
  {
    category: 'bracelet',
    name: '紅瑪瑙穩重手串',
    slug: 'agate-bracelet',
    summary: '顆粒清楚的紅瑪瑙，顏色穩，男女都能戴。',
    description: '珠子直徑約 10 毫米，中間夾小顆黃銅隔珠，手圍約 16 到 17 公分。\n\n瑪瑙硬度高，但仍建議避免摔到硬地。流汗後用乾布擦過再收進布袋。\n\n這是店裡單價最親民的一款，適合想先熟悉天然石的人。',
    price: 2680,
    material: '天然紅瑪瑙、黃銅隔珠',
    weight: 32,
    stock: 12
  }
];

function seed(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const permissionIds = {};
    const insertPermission = db.prepare(
      'INSERT INTO permissions (code, name, description) VALUES (?, ?, ?)'
    );
    for (const [code, name, description] of PERMISSIONS) {
      const info = insertPermission.run(code, name, description);
      permissionIds[code] = Number(info.lastInsertRowid);
    }

    const roleIds = {};
    const insertRole = db.prepare(
      'INSERT INTO roles (code, name, description, role_level) VALUES (?, ?, ?, ?)'
    );
    const insertRolePermission = db.prepare(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)'
    );
    for (const role of ROLES) {
      const info = insertRole.run(role.code, role.name, role.description, role.level);
      const roleId = Number(info.lastInsertRowid);
      roleIds[role.code] = roleId;
      for (const code of codesFor(role)) {
        if (!permissionIds[code]) throw new Error(`未知權限：${code}`);
        insertRolePermission.run(roleId, permissionIds[code]);
      }
    }

    const adminIds = {};
    const insertAdmin = db.prepare(
      'INSERT INTO admins (role_id, name, username, email, password_hash) VALUES (?, ?, ?, ?, ?)'
    );
    for (const account of ACCOUNTS) {
      const info = insertAdmin.run(
        roleIds[account.role],
        account.name,
        account.username,
        account.email,
        hashPassword(account.password)
      );
      adminIds[account.username] = Number(info.lastInsertRowid);
    }

    const categoryIds = {};
    const insertCategory = db.prepare(
      'INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)'
    );
    for (const [name, slug, description, sortOrder] of CATEGORIES) {
      const info = insertCategory.run(name, slug, description, sortOrder);
      categoryIds[slug] = Number(info.lastInsertRowid);
    }

    const insertProduct = db.prepare(`
      INSERT INTO products (
        category_id, name, slug, summary, description, price, material, weight_grams, stock, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    for (const product of PRODUCTS) {
      insertProduct.run(
        categoryIds[product.category],
        product.name,
        product.slug,
        product.summary,
        product.description,
        product.price,
        product.material,
        product.weight,
        product.stock
      );
    }

    const now = timestamp();
    const insertArticle = db.prepare(`
      INSERT INTO articles (title, slug, summary, content, is_published, author_admin_id, published_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `);
    insertArticle.run(
      '第一次買珍珠，怎麼看光澤與大小',
      'pearl-basics',
      '珍珠好不好看，先看光澤，再決定大小。這篇只講買第一條時用得到的判斷。',
      [
        '很多第一次買珍珠的人，會先被「很大顆」吸引。其實珍珠好不好看，光澤通常比尺寸更重要。',
        '怎麼看光澤\n把珍珠放在自然光下，表面應該像水面一樣，能映出清楚的反光。反光模糊、看起來霧霧的，多半是光澤較弱。',
        '尺寸怎麼選\n日常項鍊常見約 7 到 9 毫米。小於 7 毫米較秀氣，大於 9 毫米存在感高，價格也會明顯上升。先決定穿搭場合，再決定大小。',
        '顏色\n白珍珠、粉珍珠、淺金珍珠都適合日常。選跟膚色接近、或略亮一階的顏色，通常最不容易出錯。',
        '本舖商品頁會標示材質與參考重量。收到後若要搭配正式場合，建議先在自然光下再看一次光澤。'
      ].join('\n\n'),
      adminIds.daren,
      now
    );
    insertArticle.run(
      '金飾日常保養：五個避免變色的習慣',
      'gold-care',
      '金飾變暗，常常是清潔劑、汗水或保養品造成的。五個習慣就夠日常使用。',
      [
        '金飾變暗，常常不是金本身壞掉，而是接觸到清潔劑、汗水或保養品。下面五個習慣就夠用。',
        '1. 化妝、噴香水之後再戴\n化學成分留在金屬表面，時間久了會讓顏色看起來髒髒的。',
        '2. 洗手、游泳、泡溫泉先取下\n氯氣和溫泉水對細鏈、電鍍層特別不友善。',
        '3. 分開收納\n跟其他飾品堆在一起，容易刮傷。軟布袋或獨立小盒就好。',
        '4. 用軟布擦，不要用牙膏\n牙膏的磨粉會留下細痕。平常乾布輕擦即可。',
        '5. 很髒再交給專業清洗\n自己可以用清水加中性清潔劑輕刷，但鑲石飾品不建議泡太久。',
        '14K 金比 24K 金硬，比較適合每天戴。純金較軟，要避免拉扯細鏈。'
      ].join('\n\n'),
      adminIds.daren,
      now
    );

    db.prepare("INSERT INTO schema_meta (key, value) VALUES ('version', '1')").run();
    db.prepare("INSERT INTO schema_meta (key, value) VALUES ('seeded_at', ?)").run(now);
    writeAudit(db, {
      adminId: adminIds.daren,
      action: 'system.seed',
      targetType: 'database',
      targetId: '1',
      detail: { products: PRODUCTS.length, articles: 2, admins: ACCOUNTS.length },
      ip: 'system'
    });
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (rollbackError) { /* 沒有進行中的交易時略過 */ }
    throw error;
  }
}

module.exports = { seed, ACCOUNTS };
