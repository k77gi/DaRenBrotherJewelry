-- 大仁哥的珠寶小舖（MySQL / MariaDB）
-- 金額一律是新台幣整數元，不使用小數。
-- 時間欄位是 DATETIME，格式 YYYY-MM-DD HH:MM:SS（連線時區 +08:00）
-- 請先在 phpMyAdmin 或 cPanel 建立空資料庫，再啟動網站。本檔由程式自動執行。

CREATE TABLE IF NOT EXISTS schema_meta (
  meta_key VARCHAR(64) NOT NULL,
  `value` VARCHAR(255) NOT NULL,
  PRIMARY KEY (meta_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  role_level INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id INT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  username VARCHAR(40) NOT NULL,
  email VARCHAR(120) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  is_active TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_username (username),
  UNIQUE KEY uq_admins_email (email),
  CONSTRAINT fk_admins_role FOREIGN KEY (role_id) REFERENCES roles (id),
  CONSTRAINT chk_admins_active CHECK (is_active IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id INT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  summary VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  price INT NOT NULL,
  material VARCHAR(80) NOT NULL DEFAULT '',
  weight_grams DOUBLE NULL,
  stock INT NOT NULL DEFAULT 0,
  colors VARCHAR(80) NOT NULL DEFAULT '',
  care TEXT NOT NULL DEFAULT (''),
  main_image VARCHAR(255) NOT NULL DEFAULT '',
  detail_images TEXT NOT NULL DEFAULT ('[]'),
  extra_fields TEXT NOT NULL DEFAULT ('[]'),
  is_published TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_slug (slug),
  KEY idx_products_category (category_id),
  KEY idx_products_published (is_published),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT chk_products_price CHECK (price >= 0),
  CONSTRAINT chk_products_weight CHECK (weight_grams IS NULL OR weight_grams >= 0),
  CONSTRAINT chk_products_stock CHECK (stock >= 0),
  CONSTRAINT chk_products_published CHECK (is_published IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS articles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  summary VARCHAR(255) NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  cover_image VARCHAR(255) NOT NULL DEFAULT '',
  is_published TINYINT NOT NULL DEFAULT 1,
  author_admin_id INT UNSIGNED NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_articles_slug (slug),
  KEY idx_articles_published (is_published),
  CONSTRAINT fk_articles_author FOREIGN KEY (author_admin_id) REFERENCES admins (id) ON DELETE SET NULL,
  CONSTRAINT chk_articles_published CHECK (is_published IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(120) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL DEFAULT '',
  line_id VARCHAR(40) NOT NULL DEFAULT '',
  facebook_id VARCHAR(40) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_members_email (email),
  UNIQUE KEY uq_members_facebook (facebook_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(40) NOT NULL,
  member_id INT UNSIGNED NULL,
  buyer_name VARCHAR(80) NOT NULL,
  buyer_email VARCHAR(120) NOT NULL,
  buyer_phone VARCHAR(20) NOT NULL,
  shipping_address VARCHAR(255) NOT NULL,
  note VARCHAR(300) NOT NULL DEFAULT '',
  payment_method VARCHAR(20) NOT NULL DEFAULT '',
  tracking_no VARCHAR(40) NOT NULL DEFAULT '',
  cvs_store_id VARCHAR(20) NOT NULL DEFAULT '',
  cvs_store_name VARCHAR(40) NOT NULL DEFAULT '',
  cvs_address VARCHAR(160) NOT NULL DEFAULT '',
  logistics_subtype VARCHAR(20) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  subtotal INT NOT NULL,
  shipping_fee INT NOT NULL,
  total INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_no (order_no),
  KEY idx_orders_member (member_id),
  KEY idx_orders_status (status),
  CONSTRAINT fk_orders_member FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE SET NULL,
  CONSTRAINT chk_orders_status CHECK (status IN ('pending', 'paid', 'shipped', 'completed', 'cancelled')),
  CONSTRAINT chk_orders_subtotal CHECK (subtotal >= 0),
  CONSTRAINT chk_orders_shipping CHECK (shipping_fee >= 0),
  CONSTRAINT chk_orders_total CHECK (total = subtotal + shipping_fee)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(120) NOT NULL,
  unit_price INT NOT NULL,
  quantity INT NOT NULL,
  line_total INT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL,
  CONSTRAINT chk_order_items_price CHECK (unit_price >= 0),
  CONSTRAINT chk_order_items_qty CHECK (quantity > 0),
  CONSTRAINT chk_order_items_line CHECK (line_total = unit_price * quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cvs_map_sessions (
  trade_no VARCHAR(20) NOT NULL,
  token VARCHAR(64) NOT NULL,
  subtype VARCHAR(20) NOT NULL,
  cvs_store_id VARCHAR(20) NOT NULL DEFAULT '',
  cvs_store_name VARCHAR(40) NOT NULL DEFAULT '',
  cvs_address VARCHAR(160) NOT NULL DEFAULT '',
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trade_no),
  UNIQUE KEY uq_cvs_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id INT UNSIGNED NULL,
  action VARCHAR(40) NOT NULL,
  target_type VARCHAR(40) NULL,
  target_id VARCHAR(40) NULL,
  detail TEXT NULL,
  ip_address VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_login_locks (
  username VARCHAR(40) NOT NULL,
  fail_count INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  PRIMARY KEY (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS banners (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  eyebrow VARCHAR(40) NOT NULL DEFAULT '',
  title VARCHAR(80) NOT NULL,
  body VARCHAR(255) NOT NULL DEFAULT '',
  link_href VARCHAR(120) NOT NULL DEFAULT '/shop.html',
  link_label VARCHAR(20) NOT NULL DEFAULT '查看',
  image VARCHAR(255) NOT NULL DEFAULT '',
  alt_text VARCHAR(80) NOT NULL DEFAULT '',
  image_width INT NOT NULL DEFAULT 480,
  image_height INT NOT NULL DEFAULT 240,
  sort_order INT NOT NULL DEFAULT 0,
  is_published TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_banners_published CHECK (is_published IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_tickets (
  id VARCHAR(64) NOT NULL,
  secret_hash VARCHAR(64) NOT NULL,
  member_id INT UNSIGNED NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_login_tickets_status CHECK (status IN ('pending', 'confirmed', 'used'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS captchas (
  id VARCHAR(64) NOT NULL,
  code VARCHAR(8) NOT NULL,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inquiries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(40) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
