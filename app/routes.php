<?php

function dispatch($method, $path) {
    $routes = array(
        array('GET', '#^/health$#', 'route_health'),
        array('GET', '#^/shop$#', 'route_shop'),
        array('GET', '#^/categories$#', 'route_categories'),
        array('GET', '#^/products$#', 'route_products'),
        array('GET', '#^/products/(\d+)$#', 'route_product'),
        array('GET', '#^/banners$#', 'route_banners'),
        array('GET', '#^/articles$#', 'route_articles'),
        array('GET', '#^/articles/(\d+)$#', 'route_article'),
        array('POST', '#^/inquiries$#', 'route_inquiry_create'),
        array('POST', '#^/members/register$#', 'route_member_register'),
        array('POST', '#^/members/login$#', 'route_member_login'),
        array('POST', '#^/members/enter$#', 'route_member_enter'),
        array('GET', '#^/members/me$#', 'route_member_me'),
        array('GET', '#^/members/orders$#', 'route_member_orders'),
        array('GET', '#^/members/purchases$#', 'route_member_purchases'),
        array('GET', '#^/members/facebook/start$#', 'route_facebook_start'),
        array('GET', '#^/members/facebook/callback$#', 'route_facebook_callback'),
        array('POST', '#^/orders$#', 'route_order_create'),
        array('POST', '#^/orders/lookup$#', 'route_order_lookup'),
        array('POST', '#^/orders/([^/]+)/pay$#', 'route_order_pay'),
        array('GET', '#^/orders/([^/]+)$#', 'route_order_get'),
        array('POST', '#^/logistics/cvs-map$#', 'route_cvs_map'),
        array('GET', '#^/logistics/cvs-map/([a-f0-9]{32})$#', 'route_cvs_get'),
        array('POST', '#^/logistics/cvs-reply$#', 'route_cvs_reply'),
        array('GET', '#^/admin/captcha$#', 'route_admin_captcha'),
        array('POST', '#^/admin/login$#', 'route_admin_login'),
        array('GET', '#^/admin/me$#', 'route_admin_me'),
        array('GET', '#^/admin/summary$#', 'route_admin_summary'),
        array('GET', '#^/admin/products$#', 'route_admin_products'),
        array('POST', '#^/admin/products$#', 'route_admin_product_create'),
        array('PUT', '#^/admin/products/(\d+)$#', 'route_admin_product_update'),
        array('DELETE', '#^/admin/products/(\d+)$#', 'route_admin_product_delete'),
        array('POST', '#^/admin/categories$#', 'route_admin_category_create'),
        array('GET', '#^/admin/articles$#', 'route_admin_articles'),
        array('POST', '#^/admin/articles$#', 'route_admin_article_create'),
        array('PUT', '#^/admin/articles/(\d+)$#', 'route_admin_article_update'),
        array('DELETE', '#^/admin/articles/(\d+)$#', 'route_admin_article_delete'),
        array('GET', '#^/admin/payment-settings$#', 'route_admin_payment_get'),
        array('PUT', '#^/admin/payment-settings$#', 'route_admin_payment_save'),
        array('GET', '#^/admin/orders$#', 'route_admin_orders'),
        array('PUT', '#^/admin/orders/quantities$#', 'route_admin_order_quantities'),
        array('POST', '#^/admin/orders/delete$#', 'route_admin_orders_delete'),
        array('PATCH', '#^/admin/orders/(\d+)/tracking$#', 'route_admin_tracking'),
        array('PATCH', '#^/admin/orders/(\d+)/status$#', 'route_admin_status'),
        array('GET', '#^/admin/members$#', 'route_admin_members'),
        array('PUT', '#^/admin/members/(\d+)$#', 'route_admin_member_update'),
        array('POST', '#^/admin/members/delete$#', 'route_admin_members_delete'),
        array('POST', '#^/admin/uploads$#', 'route_admin_upload'),
        array('DELETE', '#^/admin/uploads$#', 'route_admin_upload_delete'),
        array('GET', '#^/admin/roles$#', 'route_admin_roles'),
        array('PUT', '#^/admin/roles/(\d+)/modules$#', 'route_admin_role_modules'),
        array('POST', '#^/admin/admins$#', 'route_admin_create'),
        array('GET', '#^/admin/admins$#', 'route_admin_list'),
        array('PUT', '#^/admin/admins/(\d+)$#', 'route_admin_update'),
        array('DELETE', '#^/admin/admins/(\d+)$#', 'route_admin_delete'),
        array('PATCH', '#^/admin/admins/(\d+)$#', 'route_admin_status_flag'),
        array('GET', '#^/admin/banners$#', 'route_admin_banners'),
        array('POST', '#^/admin/banners$#', 'route_admin_banner_create'),
        array('PUT', '#^/admin/banners/(\d+)$#', 'route_admin_banner_update'),
        array('DELETE', '#^/admin/banners/(\d+)/image$#', 'route_admin_banner_clear_image'),
        array('DELETE', '#^/admin/banners/(\d+)$#', 'route_admin_banner_delete'),
        array('GET', '#^/admin/inquiries$#', 'route_admin_inquiries'),
        array('PUT', '#^/admin/inquiries/(\d+)$#', 'route_admin_inquiry_update'),
        array('POST', '#^/admin/inquiries/delete$#', 'route_admin_inquiries_delete'),
        array('GET', '#^/admin/audit-logs$#', 'route_admin_audit')
    );
    foreach ($routes as $route) {
        if ($route[0] !== $method) continue;
        if (!preg_match($route[1], $path, $match)) continue;
        array_shift($match);
        call_user_func_array($route[2], $match);
        return;
    }
}

function current_member() {
    $payload = jwt_read();
    if (!$payload || (isset($payload['typ']) ? $payload['typ'] : '') !== 'member') fail(401, '請先登入會員');
    return $payload;
}

function optional_member() {
    $header = '';
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) $header = $_SERVER['HTTP_AUTHORIZATION'];
    elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) $header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    if ($header === '') return null;
    $payload = jwt_read();
    if ($payload && (isset($payload['typ']) ? $payload['typ'] : '') === 'member') return $payload;
    return null;
}

function current_admin() {
    $payload = jwt_read();
    if (!$payload || (isset($payload['typ']) ? $payload['typ'] : '') !== 'admin') fail(401, '請先登入管理後台');
    $admin = db_one(
        'SELECT a.id, a.name, a.username, a.is_active, r.code AS role_code, r.name AS role_name, r.role_level
         FROM admins a JOIN roles r ON r.id = a.role_id WHERE a.id = ?',
        array($payload['id'])
    );
    if (!$admin || !(int) $admin['is_active']) fail(401, '請先登入管理後台');
    $rows = db_all(
        'SELECT p.code FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         JOIN admins a ON a.role_id = rp.role_id WHERE a.id = ?',
        array($admin['id'])
    );
    $permissions = array();
    foreach ($rows as $row) $permissions[] = $row['code'];
    return array(
        'id' => (int) $admin['id'],
        'name' => $admin['name'],
        'username' => $admin['username'],
        'roleCode' => $admin['role_code'],
        'roleName' => $admin['role_name'],
        'roleLevel' => (int) $admin['role_level'],
        'permissions' => $permissions
    );
}

function allow_any($admin, $codes) {
    foreach ($codes as $code) {
        if (in_array($code, $admin['permissions'], true)) return;
    }
    fail(403, '你的權限不足，無法檢視這項資料');
}

function allow_all($admin, $codes) {
    foreach ($codes as $code) {
        if (!in_array($code, $admin['permissions'], true)) fail(403, '你的權限不足，無法執行這項操作');
    }
}

function route_health() { json_out(array('ok' => true)); }

function payment_settings() {
    $defaults = array('online' => true, 'bankName' => '', 'payeeName' => '', 'payeeAccount' => '');
    $row = db_one('SELECT `value` FROM schema_meta WHERE meta_key = ?', array('payment_settings'));
    if (!$row || $row['value'] === '') return $defaults;
    $data = json_decode($row['value'], true);
    if (!is_array($data)) return $defaults;
    return array(
        'online' => !isset($data['online']) || !empty($data['online']),
        'bankName' => isset($data['bankName']) ? (string) $data['bankName'] : '',
        'payeeName' => isset($data['payeeName']) ? (string) $data['payeeName'] : '',
        'payeeAccount' => isset($data['payeeAccount']) ? (string) $data['payeeAccount'] : ''
    );
}

function route_shop() {
    $c = config();
    json_out(array(
        'name' => '大仁哥的珠寶小舖',
        'freeShippingThreshold' => (int) $c['free_shipping_threshold'],
        'shippingFee' => (int) $c['shipping_fee'],
        'phone' => $c['phone'],
        'address' => $c['address'],
        'hours' => $c['hours'],
        'payment' => payment_settings()
    ));
}

function route_categories() {
    $rows = db_all('SELECT id, name, slug, description, sort_order, created_at, updated_at FROM categories ORDER BY sort_order, id');
    $out = array();
    foreach ($rows as $row) $out[] = map_category($row);
    json_out($out);
}

function route_products() {
    $params = array();
    $where = 'WHERE p.is_published = 1';
    $category = query_param('category');
    if ($category !== null && $category !== '') {
        if (preg_match('/^\d+$/', (string) $category)) {
            $where .= ' AND c.id = ?';
            $params[] = (int) $category;
        } elseif (preg_match('/^[a-z0-9-]{1,40}$/', (string) $category)) {
            $where .= ' AND c.slug = ?';
            $params[] = (string) $category;
        } else fail(400, '分類格式不正確');
    }
    $rows = db_all('SELECT ' . PRODUCT_SELECT . ' FROM products p JOIN categories c ON c.id = p.category_id ' . $where . ' ORDER BY p.id', $params);
    $out = array();
    foreach ($rows as $row) $out[] = map_product($row);
    json_out($out);
}

function route_product($id) {
    $row = db_one('SELECT ' . PRODUCT_SELECT . ' FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ? AND p.is_published = 1', array(id_param($id)));
    if (!$row) fail(404, '找不到這個商品');
    json_out(map_product($row));
}

function route_banners() {
    $rows = db_all('SELECT id, eyebrow, title, body, link_href, link_label, image, alt_text, image_width, image_height, sort_order, is_published FROM banners WHERE is_published = 1 ORDER BY sort_order, id');
    $out = array();
    foreach ($rows as $row) $out[] = map_banner($row);
    json_out($out);
}

function route_articles() {
    $rows = db_all('SELECT ' . ARTICLE_SELECT . ' FROM articles a LEFT JOIN admins ON admins.id = a.author_admin_id WHERE a.is_published = 1 ORDER BY a.published_at DESC, a.id DESC');
    $out = array();
    foreach ($rows as $row) $out[] = map_article($row);
    json_out($out);
}

function route_article($id) {
    $row = db_one('SELECT ' . ARTICLE_SELECT . ' FROM articles a LEFT JOIN admins ON admins.id = a.author_admin_id WHERE a.id = ? AND a.is_published = 1', array(id_param($id)));
    if (!$row) fail(404, '找不到這篇文章');
    json_out(map_article($row));
}

function route_inquiry_create() {
    $body = request_body();
    $info = db_run(
        'INSERT INTO inquiries (name, phone, email, message) VALUES (?, ?, ?, ?)',
        array(
            sanitize_plain(isset($body['name']) ? $body['name'] : '', 40, '姓名', true),
            required_phone(sanitize_plain(isset($body['phone']) ? $body['phone'] : '', 20, '電話', true)),
            required_email(sanitize_plain(isset($body['email']) ? $body['email'] : '', 120, '電子郵件', true)),
            sanitize_plain(isset($body['message']) ? $body['message'] : '', 1000, '諮詢內容', true)
        )
    );
    json_out(array('id' => $info['id']), 201);
}

function read_password($value) {
    $password = (string) $value;
    $length = strlen($password);
    if ($length < 8 || $length > 72) fail(400, '密碼請設定 8 到 72 個字元');
    return $password;
}

function canonical_phone($value, $required) {
    $phone = optional_phone($value);
    if ($required && $phone === '') fail(400, '請填寫電話');
    return preg_replace('/[\s()-]/', '', $phone);
}

function line_id($value) {
    $text = trim((string) $value);
    if (!preg_match('/^[A-Za-z][A-Za-z0-9._-]{3,19}$/', $text)) {
        fail(400, 'LINE ID 請使用 4 到 20 個字，以英文開頭，可含數字、點、底線或減號');
    }
    return $text;
}

function find_member_account($account) {
    $text = trim((string) $account);
    $phone = preg_replace('/[\s()-]/', '', $text);
    return db_one(
        'SELECT id, name, email, phone, line_id, facebook_id, password_hash, created_at FROM members
         WHERE LOWER(email) = LOWER(?) OR (phone <> \'\' AND phone = ?) OR (line_id <> \'\' AND LOWER(line_id) = LOWER(?))',
        array($text, $phone, $text)
    );
}

function route_member_register() {
    $body = request_body();
    $name = required_text(isset($body['name']) ? $body['name'] : '', 40, '姓名');
    $password = read_password(isset($body['password']) ? $body['password'] : '');
    $method = isset($body['method']) ? (string) $body['method'] : 'email';
    if (!in_array($method, array('email', 'phone', 'line'), true)) fail(400, '請選擇註冊方式');
    $email = '';
    $phone = '';
    $line = '';
    if ($method === 'email') {
        $email = required_email(isset($body['email']) ? $body['email'] : '');
        $phone = canonical_phone(isset($body['phone']) ? $body['phone'] : '', false);
    } elseif ($method === 'phone') {
        $phone = canonical_phone(isset($body['phone']) ? $body['phone'] : '', true);
        $email = 'm' . time() . mt_rand(0, 999) . '@members.local';
    } else {
        $line = line_id(isset($body['lineId']) ? $body['lineId'] : '');
        $phone = canonical_phone(isset($body['phone']) ? $body['phone'] : '', false);
        $email = 'm' . time() . mt_rand(0, 999) . '@members.local';
    }
    if (db_one('SELECT id FROM members WHERE LOWER(email) = LOWER(?)', array($email))) fail(409, '這個電子郵件已經註冊');
    if ($phone !== '' && db_one('SELECT id FROM members WHERE phone = ?', array($phone))) fail(409, '這個電話號碼已經註冊');
    if ($line !== '' && db_one('SELECT id FROM members WHERE LOWER(line_id) = LOWER(?)', array($line))) fail(409, '這個 LINE ID 已經註冊');
    $info = db_run(
        'INSERT INTO members (name, email, password_hash, phone, line_id) VALUES (?, ?, ?, ?, ?)',
        array($name, $email, hash_pw($password), $phone, $line)
    );
    $member = db_one('SELECT id, name, email, phone, line_id, created_at FROM members WHERE id = ?', array($info['id']));
    json_out(array('token' => jwt_sign(array('typ' => 'member', 'id' => (int) $member['id'])), 'member' => map_member($member)), 201);
}

function member_token_out($member, $created) {
    json_out(array(
        'token' => jwt_sign(array('typ' => 'member', 'id' => (int) $member['id'])),
        'member' => map_member($member),
        'created' => $created
    ), $created ? 201 : 200);
}

function route_member_enter() {
    $body = request_body();
    $method = isset($body['method']) ? (string) $body['method'] : 'email';
    if (!in_array($method, array('email', 'phone', 'line'), true)) fail(400, '請選擇電子郵件、電話或 LINE ID');
    $password = read_password(isset($body['password']) ? $body['password'] : '');
    $name = optional_text(isset($body['name']) ? $body['name'] : '', 40, '姓名');
    if ($method === 'email') {
        $email = required_email(isset($body['account']) ? $body['account'] : '');
        $member = db_one(
            'SELECT id, name, email, phone, line_id, facebook_id, password_hash, created_at FROM members WHERE LOWER(email) = LOWER(?)',
            array($email)
        );
        if ($member) {
            if (!verify_pw($password, $member['password_hash'])) {
                if (!empty($member['facebook_id'])) fail(401, '這個帳號是用 Facebook 建立的，請按「使用 Facebook 加入或登入」');
                fail(401, '密碼不正確');
            }
            member_token_out($member, false);
        }
        if ($name === '') $name = strstr($email, '@', true);
        if ($name === false || $name === '') $name = '會員';
        $name = mb_substr($name, 0, 40, 'UTF-8');
        $info = db_run(
            'INSERT INTO members (name, email, password_hash, phone, line_id) VALUES (?, ?, ?, ?, ?)',
            array($name, $email, hash_pw($password), '', '')
        );
    } elseif ($method === 'phone') {
        $phone = canonical_phone(isset($body['account']) ? $body['account'] : '', true);
        $member = db_one(
            'SELECT id, name, email, phone, line_id, facebook_id, password_hash, created_at FROM members WHERE phone = ?',
            array($phone)
        );
        if ($member) {
            if (!verify_pw($password, $member['password_hash'])) {
                if (!empty($member['facebook_id'])) fail(401, '這個帳號是用 Facebook 建立的，請按「使用 Facebook 加入或登入」');
                fail(401, '密碼不正確');
            }
            member_token_out($member, false);
        }
        if ($name === '') $name = $phone;
        $name = mb_substr($name, 0, 40, 'UTF-8');
        $email = 'm' . time() . mt_rand(0, 999) . '@members.local';
        $info = db_run(
            'INSERT INTO members (name, email, password_hash, phone, line_id) VALUES (?, ?, ?, ?, ?)',
            array($name, $email, hash_pw($password), $phone, '')
        );
    } else {
        $line = line_id(isset($body['account']) ? $body['account'] : '');
        $member = db_one(
            'SELECT id, name, email, phone, line_id, facebook_id, password_hash, created_at FROM members WHERE LOWER(line_id) = LOWER(?)',
            array($line)
        );
        if ($member) {
            if (!verify_pw($password, $member['password_hash'])) {
                if (!empty($member['facebook_id'])) fail(401, '這個帳號是用 Facebook 建立的，請按「使用 Facebook 加入或登入」');
                fail(401, '密碼不正確');
            }
            member_token_out($member, false);
        }
        if ($name === '') $name = $line;
        $name = mb_substr($name, 0, 40, 'UTF-8');
        $email = 'm' . time() . mt_rand(0, 999) . '@members.local';
        $info = db_run(
            'INSERT INTO members (name, email, password_hash, phone, line_id) VALUES (?, ?, ?, ?, ?)',
            array($name, $email, hash_pw($password), '', $line)
        );
    }
    $created = db_one('SELECT id, name, email, phone, line_id, created_at FROM members WHERE id = ?', array($info['id']));
    member_token_out($created, true);
}

function route_member_login() {
    $body = request_body();
    $account = trim((string) (isset($body['account']) ? $body['account'] : (isset($body['email']) ? $body['email'] : '')));
    if ($account === '') fail(400, '請填寫電子郵件、電話或 LINE ID');
    $password = isset($body['password']) ? (string) $body['password'] : '';
    $member = find_member_account($account);
    $hash = $member ? $member['password_hash'] : hash_pw('dummy-password');
    if (!$member || !verify_pw($password, $hash)) {
        if ($member && !empty($member['facebook_id'])) fail(401, '這個帳號是用 Facebook 建立的，請按「使用 Facebook 加入或登入」');
        fail(401, '帳號或密碼不正確');
    }
    json_out(array('token' => jwt_sign(array('typ' => 'member', 'id' => (int) $member['id'])), 'member' => map_member($member)));
}

function route_member_me() {
    $auth = current_member();
    $member = db_one('SELECT id, name, email, phone, line_id, created_at FROM members WHERE id = ?', array($auth['id']));
    if (!$member) fail(401, '請先登入會員');
    json_out(map_member($member));
}

function route_member_orders() {
    $auth = current_member();
    json_out(list_orders($auth['id']));
}

function route_member_purchases() {
    $auth = current_member();
    $rows = db_all(
        "SELECT oi.product_id, oi.product_name, oi.quantity, o.created_at
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.member_id = ? AND o.status IN ('paid', 'shipped', 'completed')
         ORDER BY o.id DESC, oi.id DESC
         LIMIT 200",
        array($auth['id'])
    );
    $seen = array();
    $productIds = array();
    foreach ($rows as $row) {
        $key = $row['product_id'] === null ? 'name:' . $row['product_name'] : 'id:' . $row['product_id'];
        if (isset($seen[$key])) {
            $seen[$key]['boughtQty'] += (int) $row['quantity'];
            continue;
        }
        $seen[$key] = array(
            'productId' => $row['product_id'] === null ? null : (int) $row['product_id'],
            'productName' => $row['product_name'],
            'boughtQty' => (int) $row['quantity'],
            'boughtAt' => $row['created_at']
        );
        if ($row['product_id'] !== null) $productIds[(int) $row['product_id']] = true;
    }
    $products = array();
    if ($productIds) {
        $ids = array_keys($productIds);
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $found = db_all(
            'SELECT id, name, slug, price, stock, is_published, colors, main_image FROM products WHERE id IN (' . $marks . ')',
            $ids
        );
        foreach ($found as $product) $products[(int) $product['id']] = $product;
    }
    $out = array();
    foreach ($seen as $item) {
        $product = $item['productId'] !== null && isset($products[$item['productId']]) ? $products[$item['productId']] : null;
        $published = $product && (int) $product['is_published'] === 1;
        $stock = $product ? (int) $product['stock'] : 0;
        $color = '';
        if ($product) {
            foreach (explode('|', (string) $product['colors']) as $part) {
                $part = trim($part);
                if ($part !== '' && substr($item['productName'], -strlen('（' . $part . '）')) === '（' . $part . '）') {
                    $color = $part;
                    break;
                }
            }
        }
        $canBuy = $published && $stock > 0;
        $out[] = array(
            'productId' => $item['productId'],
            'name' => $product ? $product['name'] : $item['productName'],
            'slug' => $product ? $product['slug'] : '',
            'price' => $product ? (int) $product['price'] : null,
            'stock' => $stock,
            'color' => $color,
            'image' => $product && $product['main_image'] !== '' ? $product['main_image'] : '',
            'boughtQty' => $item['boughtQty'],
            'boughtAt' => $item['boughtAt'],
            'canBuy' => $canBuy,
            'unavailableReason' => $canBuy ? '' : ($published ? '商品已售完，無法購買' : '商品已下架，無法購買')
        );
    }
    json_out($out);
}

function request_origin() {
    $configured = rtrim((string) config()['public_origin'], '/');
    if ($configured !== '') return $configured;
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
        || (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443');
    if (!$https && $host !== '' && !preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/i', $host)) $https = true;
    return ($https ? 'https' : 'http') . '://' . $host;
}

function facebook_redirect_uri() {
    return request_origin() . app_base() . '/api/members/facebook/callback';
}

function facebook_return($message) {
    header('Location: ' . app_base() . '/member.html?facebook=' . rawurlencode($message));
    exit;
}

function facebook_state() {
    $body = time() . '-' . bin2hex(random_bytes(8));
    return $body . '.' . hash_hmac('sha256', $body, config()['jwt_secret']);
}

function facebook_state_ok($state) {
    $parts = explode('.', (string) $state, 2);
    if (count($parts) !== 2 || !preg_match('/^(\d+)-[a-f0-9]{16}$/', $parts[0], $match)) return false;
    $expected = hash_hmac('sha256', $parts[0], config()['jwt_secret']);
    if (!hash_equals($expected, $parts[1])) return false;
    return abs(time() - (int) $match[1]) < 600;
}

function facebook_get($url) {
    if (!function_exists('curl_init')) fail(500, '主機沒有啟用 curl，無法使用 Facebook 登入');
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
    if (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTPS')) {
        curl_setopt($ch, CURLOPT_PROTOCOLS, CURLPROTO_HTTPS);
    }
    $raw = curl_exec($ch);
    curl_close($ch);
    if (!is_string($raw) || $raw === '') fail(502, '無法連上 Facebook，請稍後再試');
    $data = json_decode($raw, true);
    if (!is_array($data)) fail(502, 'Facebook 回傳的資料無法讀取');
    return $data;
}

function route_facebook_start() {
    $c = config();
    $appId = isset($c['facebook_app_id']) ? trim((string) $c['facebook_app_id']) : '';
    $secret = isset($c['facebook_app_secret']) ? trim((string) $c['facebook_app_secret']) : '';
    if ($appId === '' || $secret === '') facebook_return('請先在 app/config.php 填入 Facebook 應用程式編號與密鑰');
    $query = http_build_query(array(
        'client_id' => $appId,
        'redirect_uri' => facebook_redirect_uri(),
        'state' => facebook_state(),
        'scope' => 'email,public_profile',
        'response_type' => 'code'
    ));
    header('Location: https://www.facebook.com/v23.0/dialog/oauth?' . $query);
    exit;
}

function login_cookie($name, $value, $path) {
    setcookie($name, $value, array(
        'expires' => time() + 180,
        'path' => $path,
        'secure' => stripos(request_origin(), 'https://') === 0,
        'httponly' => false,
        'samesite' => 'Lax'
    ));
}

function facebook_finish_login($member) {
    $token = jwt_sign(array('typ' => 'member', 'id' => (int) $member['id']));
    $base = app_base();
    $cookiePath = $base === '' ? '/' : $base;
    login_cookie('daren-member-token', $token, $cookiePath);
    login_cookie('daren-member-name', $member['name'], $cookiePath);
    header('Location: ' . $base . '/profile.html?logged_in=1#token=' . rawurlencode($token) . '&name=' . rawurlencode($member['name']));
    exit;
}

function route_facebook_callback() {
    if (!empty($_GET['error'])) facebook_return('已取消 Facebook 登入');
    $code = isset($_GET['code']) ? (string) $_GET['code'] : '';
    $state = isset($_GET['state']) ? (string) $_GET['state'] : '';
    if ($code === '' || !facebook_state_ok($state)) {
        facebook_return('Facebook 登入已失效。請在 Facebook 登入的設定加入這個重新導向網址：' . facebook_redirect_uri());
    }
    $c = config();
    $appId = isset($c['facebook_app_id']) ? trim((string) $c['facebook_app_id']) : '';
    $secret = isset($c['facebook_app_secret']) ? trim((string) $c['facebook_app_secret']) : '';
    if ($appId === '' || $secret === '') facebook_return('請先在 app/config.php 填入 Facebook 應用程式編號與密鑰');
    $redirect = facebook_redirect_uri();
    $tokenUrl = 'https://graph.facebook.com/v23.0/oauth/access_token?' . http_build_query(array(
        'client_id' => $appId,
        'redirect_uri' => $redirect,
        'client_secret' => $secret,
        'code' => $code
    ));
    $token = facebook_get($tokenUrl);
    if (empty($token['access_token'])) facebook_return('Facebook 沒有完成授權。請確認應用程式的重新導向網址是 ' . $redirect);
    $profile = facebook_get('https://graph.facebook.com/v23.0/me?' . http_build_query(array(
        'fields' => 'id,name,email',
        'access_token' => $token['access_token']
    )));
    if (!empty($profile['error'])) facebook_return('Facebook 沒有完成授權，請再試一次');
    $facebookId = isset($profile['id']) ? (string) $profile['id'] : '';
    if (!preg_match('/^[0-9]{1,40}$/', $facebookId)) facebook_return('Facebook 沒有提供會員編號');
    $name = trim(isset($profile['name']) ? (string) $profile['name'] : '');
    if ($name === '') $name = 'Facebook 會員';
    if (mb_strlen($name, 'UTF-8') > 80) $name = mb_substr($name, 0, 80, 'UTF-8');
    $email = isset($profile['email']) ? strtolower(trim((string) $profile['email'])) : '';
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $email = '';
    $member = db_one('SELECT id, name, email, phone, line_id, created_at FROM members WHERE facebook_id = ?', array($facebookId));
    if (!$member && $email !== '') {
        $member = db_one('SELECT id, name, email, phone, line_id, facebook_id, created_at FROM members WHERE LOWER(email) = LOWER(?)', array($email));
        if ($member && !empty($member['facebook_id']) && $member['facebook_id'] !== $facebookId) {
            facebook_return('這個電子郵件已經連結另一個 Facebook 帳號');
        }
        if ($member && empty($member['facebook_id'])) {
            db_run('UPDATE members SET facebook_id = ?, updated_at = ? WHERE id = ? AND facebook_id IS NULL', array($facebookId, timestamp(), $member['id']));
        }
    }
    if (!$member) {
        $storedEmail = $email !== '' ? $email : ('fb' . $facebookId . '@members.local');
        $info = db_run(
            'INSERT INTO members (name, email, password_hash, phone, line_id, facebook_id) VALUES (?, ?, ?, ?, ?, ?)',
            array($name, $storedEmail, hash_pw(bin2hex(random_bytes(24))), '', '', $facebookId)
        );
        $member = db_one('SELECT id, name, email, phone, line_id, created_at FROM members WHERE id = ?', array($info['id']));
    }
    facebook_finish_login($member);
}

function holds_stock($status) {
    return $status === 'paid' || $status === 'shipped' || $status === 'completed';
}

function next_order_no() {
    $day = date('Ymd');
    for ($i = 0; $i < 5; $i++) {
        $orderNo = 'DR' . $day . str_pad((string) mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);
        if (!db_one('SELECT 1 AS found FROM orders WHERE order_no = ?', array($orderNo))) return $orderNo;
    }
    fail(500, '訂單編號產生失敗，請再試一次');
}

function list_orders($memberId) {
    $sql = 'SELECT * FROM orders';
    $params = array();
    if ($memberId) {
        $sql .= ' WHERE member_id = ?';
        $params[] = $memberId;
    }
    $sql .= ' ORDER BY id DESC LIMIT 100';
    $rows = db_all($sql, $params);
    $out = array();
    foreach ($rows as $row) $out[] = map_full_order($row);
    return $out;
}

function normalize_items($items) {
    if (!is_array($items) || count($items) === 0) fail(400, '購物車是空的');
    if (count($items) > 50) fail(400, '一次結帳的品項過多');
    $merged = array();
    $totals = array();
    foreach ($items as $item) {
        $productId = required_int(isset($item['productId']) ? $item['productId'] : null, '商品', 1);
        $quantity = required_int(isset($item['quantity']) ? $item['quantity'] : null, '數量', 1, 99);
        $color = optional_text(isset($item['color']) ? $item['color'] : '', 20, '顏色');
        $key = $productId . "\n" . $color;
        if (!isset($merged[$key])) $merged[$key] = array('productId' => $productId, 'quantity' => 0, 'color' => $color);
        $merged[$key]['quantity'] += $quantity;
        if ($merged[$key]['quantity'] > 99) fail(400, '同一商品最多 99 件');
        if (!isset($totals[$productId])) $totals[$productId] = 0;
        $totals[$productId] += $quantity;
    }
    foreach ($totals as $quantity) {
        if ($quantity > 99) fail(400, '同一商品最多 99 件');
    }
    return array_values($merged);
}

function load_cvs($token) {
    $text = (string) $token;
    if (!preg_match('/^[a-f0-9]{32}$/', $text)) fail(400, '請先用電子地圖選擇超商');
    $row = db_one(
        "SELECT subtype, cvs_store_id, cvs_store_name, cvs_address, CASE WHEN expires_at <= NOW() THEN 1 ELSE 0 END AS expired FROM cvs_map_sessions WHERE token = ?",
        array($text)
    );
    if (!$row || (int) $row['expired'] || $row['cvs_store_id'] === '') fail(400, '請先用電子地圖選擇超商');
    return $row;
}

function route_order_create() {
    $body = request_body();
    assert_no_card($body);
    $delivery = isset($body['delivery']) ? (string) $body['delivery'] : 'home';
    if (!in_array($delivery, array('home', 'cvs'), true)) fail(400, '請選擇收貨方式');
    $cvs = $delivery === 'cvs' ? load_cvs(isset($body['cvsToken']) ? $body['cvsToken'] : '') : null;
    $items = normalize_items(isset($body['items']) ? $body['items'] : array());
    $memberId = null;
    $auth = optional_member();
    if ($auth) {
        $member = db_one('SELECT id FROM members WHERE id = ?', array($auth['id']));
        if ($member) $memberId = (int) $member['id'];
    }
    $c = config();
    db()->beginTransaction();
    try {
        $lines = array();
        foreach ($items as $item) {
            $product = db_one('SELECT id, name, price, stock, colors, is_published FROM products WHERE id = ?', array($item['productId']));
            if (!$product || !(int) $product['is_published']) fail(400, '有商品已下架，請回購物車確認');
            $colors = array();
            foreach (explode('|', (string) $product['colors']) as $color) {
                $color = trim($color);
                if ($color !== '') $colors[] = $color;
            }
            $color = $item['color'] !== '' ? $item['color'] : (isset($colors[0]) ? $colors[0] : '');
            if ($colors && !in_array($color, $colors, true)) fail(400, '請選擇「' . $product['name'] . '」的顏色');
            $needed = 0;
            foreach ($items as $entry) {
                if ($entry['productId'] === $item['productId']) $needed += $entry['quantity'];
            }
            if ((int) $product['stock'] < $needed) fail(400, '「' . $product['name'] . '」庫存只剩 ' . $product['stock'] . ' 件');
            $lines[] = array(
                'productId' => (int) $product['id'],
                'productName' => $color !== '' ? $product['name'] . '（' . $color . '）' : $product['name'],
                'unitPrice' => (int) $product['price'],
                'quantity' => $item['quantity'],
                'lineTotal' => (int) $product['price'] * $item['quantity']
            );
        }
        $subtotal = 0;
        foreach ($lines as $line) $subtotal += $line['lineTotal'];
        $shipping = $subtotal >= (int) $c['free_shipping_threshold'] ? 0 : (int) $c['shipping_fee'];
        $orderNo = next_order_no();
        $paymentMethod = payment_settings()['online'] ? '' : 'transfer';
        $info = db_run(
            "INSERT INTO orders (order_no, member_id, buyer_name, buyer_email, buyer_phone, shipping_address, note, status, payment_method, subtotal, shipping_fee, total, cvs_store_id, cvs_store_name, cvs_address, logistics_subtype) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)",
            array(
                $orderNo, $memberId,
                sanitize_plain(isset($body['buyerName']) ? $body['buyerName'] : '', 40, '收件人', true),
                required_email(isset($body['buyerEmail']) ? $body['buyerEmail'] : ''),
                required_phone(isset($body['buyerPhone']) ? $body['buyerPhone'] : ''),
                $cvs ? $cvs['cvs_address'] : sanitize_plain(isset($body['shippingAddress']) ? $body['shippingAddress'] : '', 200, '收件地址', true),
                sanitize_plain(isset($body['note']) ? $body['note'] : '', 300, '備註'),
                $paymentMethod, $subtotal, $shipping, $subtotal + $shipping,
                $cvs ? $cvs['cvs_store_id'] : '',
                $cvs ? $cvs['cvs_store_name'] : '',
                $cvs ? $cvs['cvs_address'] : '',
                $cvs ? $cvs['subtype'] : ''
            )
        );
        foreach ($lines as $line) {
            db_run(
                'INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?)',
                array($info['id'], $line['productId'], $line['productName'], $line['unitPrice'], $line['quantity'], $line['lineTotal'])
            );
        }
        db()->commit();
        $orderId = $info['id'];
    } catch (Exception $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
    $row = db_one('SELECT * FROM orders WHERE id = ?', array($orderId));
    json_out(map_full_order($row), 201);
}

function route_order_lookup() {
    $body = request_body();
    $orderNo = required_text(isset($body['orderNo']) ? $body['orderNo'] : '', 40, '訂單編號');
    $email = required_email(isset($body['email']) ? $body['email'] : '');
    $row = db_one('SELECT * FROM orders WHERE order_no = ?', array($orderNo));
    if (!$row || $row['buyer_email'] !== $email) fail(404, '查無相符的訂單，請確認訂單編號與電子郵件');
    json_out(map_full_order($row));
}

function set_order_status($orderId, $nextStatus, $audit, $paymentMethod) {
    $allowed = array('pending', 'paid', 'shipped', 'completed', 'cancelled');
    if (!in_array($nextStatus, $allowed, true)) fail(400, '訂單狀態不正確');
    db()->beginTransaction();
    try {
        $order = db_one('SELECT * FROM orders WHERE id = ?', array($orderId));
        if (!$order) fail(404, '找不到這筆訂單');
        if ($order['status'] !== $nextStatus) {
            $before = holds_stock($order['status']);
            $after = holds_stock($nextStatus);
            if ($before !== $after) {
                $items = db_all('SELECT product_id, quantity, product_name FROM order_items WHERE order_id = ?', array($order['id']));
                if ($after) {
                    foreach ($items as $item) {
                        if (!$item['product_id']) fail(400, '「' . $item['product_name'] . '」已從商品刪除，無法完成付款');
                        $result = db_run(
                            'UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?',
                            array((int) $item['quantity'], timestamp(), $item['product_id'], (int) $item['quantity'])
                        );
                        if ($result['changes'] !== 1) fail(400, '「' . $item['product_name'] . '」庫存不足，無法完成付款');
                    }
                } else {
                    foreach ($items as $item) {
                        if (!$item['product_id']) continue;
                        db_run('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?', array((int) $item['quantity'], timestamp(), $item['product_id']));
                    }
                }
            }
            db_run(
                'UPDATE orders SET status = ?, payment_method = COALESCE(?, payment_method), updated_at = ? WHERE id = ?',
                array($nextStatus, $paymentMethod, timestamp(), $orderId)
            );
            if ($audit) {
                write_audit(array(
                    'adminId' => $audit['id'],
                    'action' => 'order.status',
                    'targetType' => 'order',
                    'targetId' => $orderId,
                    'detail' => array('orderNo' => $order['order_no'], 'from' => $order['status'], 'to' => $nextStatus),
                    'ip' => request_ip()
                ));
            }
        }
        db()->commit();
    } catch (Exception $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
    return map_full_order(db_one('SELECT * FROM orders WHERE id = ?', array($orderId)));
}

function route_order_pay($orderNo) {
    $body = request_body();
    assert_no_card($body);
    $method = required_text(isset($body['method']) ? $body['method'] : '', 20, '付款方式');
    if (!in_array($method, array('card', 'atm', 'linepay'), true)) fail(400, '請選擇付款方式');
    $email = !empty($body['email']) ? required_email($body['email']) : '';
    $auth = optional_member();
    $row = db_one('SELECT * FROM orders WHERE order_no = ?', array($orderNo));
    if (!$row) fail(404, '查無相符的訂單');
    $memberOk = $auth && (int) $row['member_id'] === (int) $auth['id'];
    $emailOk = $email !== '' && $row['buyer_email'] === $email;
    if (!$memberOk && !$emailOk) fail(404, '查無相符的訂單，請確認訂單編號與電子郵件');
    if (holds_stock($row['status'])) fail(400, '這筆訂單已經付款');
    if ($row['status'] !== 'pending') fail(400, '這筆訂單目前不能付款');
    json_out(set_order_status((int) $row['id'], 'paid', null, $method));
}

function route_order_get($orderNo) {
    $auth = current_member();
    $row = db_one('SELECT * FROM orders WHERE order_no = ?', array($orderNo));
    if (!$row || (int) $row['member_id'] !== (int) $auth['id']) fail(404, '查無相符的訂單');
    json_out(map_full_order($row));
}

function route_cvs_map() {
    $body = request_body();
    $subtypes = array('UNIMART' => '7-ELEVEN', 'FAMI' => '全家', 'HILIFE' => '萊爾富');
    $subtype = isset($body['subtype']) ? (string) $body['subtype'] : '';
    if (!isset($subtypes[$subtype])) fail(400, '請選擇 7-ELEVEN、全家或萊爾富');
    $device = (isset($body['device']) ? (string) $body['device'] : '0') === '1' ? '1' : '0';
    db_run('DELETE FROM cvs_map_sessions WHERE expires_at <= NOW()');
    $trade = substr('C' . strtoupper(base_convert((string) time(), 10, 36) . bin2hex(random_bytes(3))), 0, 20);
    $token = bin2hex(random_bytes(16));
    db_run(
        'INSERT INTO cvs_map_sessions (trade_no, token, subtype, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))',
        array($trade, $token, $subtype)
    );
    $origin = request_origin();
    $c = config();
    json_out(array(
        'action' => $c['ecpay_map_url'],
        'stage' => $c['ecpay_map_url'] === 'https://logistics-stage.ecpay.com.tw/Express/map',
        'fields' => array(
            'MerchantID' => $c['ecpay_merchant_id'],
            'MerchantTradeNo' => $trade,
            'LogisticsType' => 'CVS',
            'LogisticsSubType' => $subtype,
            'IsCollection' => 'N',
            'ServerReplyURL' => $origin . app_base() . '/api/logistics/cvs-reply',
            'ExtraData' => substr($token, 0, 20),
            'Device' => $device
        )
    ));
}

function route_cvs_get($token) {
    $row = db_one(
        "SELECT subtype, cvs_store_id, cvs_store_name, cvs_address, CASE WHEN expires_at <= NOW() THEN 1 ELSE 0 END AS expired FROM cvs_map_sessions WHERE token = ?",
        array($token)
    );
    $names = array('UNIMART' => '7-ELEVEN', 'FAMI' => '全家', 'HILIFE' => '萊爾富');
    if (!$row || (int) $row['expired'] || $row['cvs_store_id'] === '') fail(404, '找不到這次的門市選擇');
    json_out(array(
        'subtype' => $row['subtype'],
        'subtypeName' => isset($names[$row['subtype']]) ? $names[$row['subtype']] : $row['subtype'],
        'storeId' => $row['cvs_store_id'],
        'storeName' => $row['cvs_store_name'],
        'address' => $row['cvs_address']
    ));
}

function route_cvs_reply() {
    try {
        $body = request_body();
        if ((isset($body['MerchantID']) ? (string) $body['MerchantID'] : '') !== config()['ecpay_merchant_id']) {
            fail(400, '綠界回傳的商店代號不符');
        }
        $trade = isset($body['MerchantTradeNo']) ? (string) $body['MerchantTradeNo'] : '';
        $row = db_one(
            "SELECT token, subtype, CASE WHEN expires_at <= NOW() THEN 1 ELSE 0 END AS expired FROM cvs_map_sessions WHERE trade_no = ?",
            array($trade)
        );
        if (!$row || (int) $row['expired']) fail(400, '這次的門市選擇已失效，請回結帳頁重選');
        $storeId = trim(isset($body['CVSStoreID']) ? (string) $body['CVSStoreID'] : '');
        if (!preg_match('/^[A-Za-z0-9]{4,9}$/', $storeId)) fail(400, '門市代號格式不正確');
        $names = array('UNIMART', 'FAMI', 'HILIFE');
        $subtype = in_array(isset($body['LogisticsSubType']) ? $body['LogisticsSubType'] : '', $names, true) ? $body['LogisticsSubType'] : $row['subtype'];
        db_run(
            "UPDATE cvs_map_sessions SET cvs_store_id = ?, cvs_store_name = ?, cvs_address = ?, subtype = ? WHERE trade_no = ? AND cvs_store_id = ''",
            array(
                $storeId,
                sanitize_plain(isset($body['CVSStoreName']) ? $body['CVSStoreName'] : '', 30, '超商名稱', true),
                sanitize_plain(isset($body['CVSAddress']) ? $body['CVSAddress'] : '', 120, '超商地址', true),
                $subtype,
                $trade
            )
        );
        $next = app_base() . '/checkout.html?cvs=' . rawurlencode($row['token']);
        header('Content-Type: text/html; charset=utf-8');
        echo '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>返回結帳</title></head><body><p>正在返回結帳頁…</p><script>location.replace(' . json_encode($next) . ')</script></body></html>';
        exit;
    } catch (HttpError $error) {
        http_response_code(400);
        header('Content-Type: text/html; charset=utf-8');
        echo '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>門市選擇失敗</title></head><body><p>'
            . htmlspecialchars($error->getMessage(), ENT_QUOTES, 'UTF-8')
            . '</p><p><a href="' . htmlspecialchars(app_base() . '/checkout.html', ENT_QUOTES, 'UTF-8') . '">回結帳頁</a></p></body></html>';
        exit;
    }
}

function captcha_create() {
    db_run('DELETE FROM captchas WHERE expires_at <= NOW()');
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $code = '';
    for ($i = 0; $i < 4; $i++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    $id = bin2hex(random_bytes(16));
    db_run('INSERT INTO captchas (id, code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))', array($id, $code));
    $letters = '';
    for ($i = 0; $i < 4; $i++) {
        $x = 16 + $i * 32;
        $y = 32 + random_int(-3, 3);
        $rotate = random_int(-16, 16);
        $letters .= '<text x="' . $x . '" y="' . $y . '" transform="rotate(' . $rotate . ' ' . $x . ' ' . $y . ')" font-size="26" font-family="Georgia, serif" fill="#1f1b17">' . $code[$i] . '</text>';
    }
    $noise = '';
    for ($i = 0; $i < 6; $i++) {
        $noise .= '<line x1="' . random_int(0, 140) . '" y1="' . random_int(0, 48) . '" x2="' . random_int(0, 140) . '" y2="' . random_int(0, 48) . '" stroke="#b7a898" stroke-width="1"/>';
    }
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="48" viewBox="0 0 140 48"><rect width="140" height="48" fill="#f6f1e8"/>' . $noise . $letters . '</svg>';
    return array('id' => $id, 'image' => 'data:image/svg+xml;charset=UTF-8,' . rawurlencode($svg));
}

function captcha_consume($id, $answer) {
    $row = db_one('SELECT code, expires_at FROM captchas WHERE id = ?', array((string) $id));
    if ($row) db_run('DELETE FROM captchas WHERE id = ?', array((string) $id));
    if (!$row || $row['expires_at'] <= timestamp()) return false;
    return strtoupper(trim((string) $answer)) === $row['code'];
}

function later_timestamp($minutes) {
    return date('Y-m-d H:i:s', time() + $minutes * 60);
}

function lock_state($username) {
    $row = db_one('SELECT fail_count, locked_until FROM admin_login_locks WHERE username = ?', array($username));
    if (!$row) return array('failCount' => 0, 'locked' => false);
    if ($row['locked_until'] && $row['locked_until'] > timestamp()) {
        return array('failCount' => (int) $row['fail_count'], 'locked' => true);
    }
    if ($row['locked_until']) {
        db_run('UPDATE admin_login_locks SET fail_count = 0, locked_until = NULL WHERE username = ?', array($username));
        return array('failCount' => 0, 'locked' => false);
    }
    return array('failCount' => (int) $row['fail_count'], 'locked' => false);
}

function route_admin_captcha() { json_out(captcha_create()); }

function route_admin_login() {
    $body = request_body();
    $username = strtolower(required_text(isset($body['username']) ? $body['username'] : '', 40, '帳號'));
    $password = isset($body['password']) ? (string) $body['password'] : '';
    if (lock_state($username)['locked']) fail(429, '連續錯誤 5 次，此帳號已鎖定 15 分鐘');
    $captchaOk = captcha_consume(isset($body['captchaId']) ? $body['captchaId'] : '', isset($body['captchaCode']) ? $body['captchaCode'] : '');
    $admin = db_one(
        'SELECT a.id, a.name, a.username, a.password_hash, a.is_active, r.name AS role_name FROM admins a JOIN roles r ON r.id = a.role_id WHERE a.username = ?',
        array($username)
    );
    $matched = $admin ? verify_pw($password, $admin['password_hash']) : false;
    if (!$captchaOk || !$admin || !$matched) {
        $state = lock_state($username);
        $failCount = $state['failCount'] + 1;
        $lockedUntil = $failCount >= 5 ? later_timestamp(15) : null;
        db_run(
            'INSERT INTO admin_login_locks (username, fail_count, locked_until) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE fail_count = VALUES(fail_count), locked_until = VALUES(locked_until)',
            array($username, $failCount, $lockedUntil)
        );
        write_audit(array(
            'action' => 'admin.login_failed',
            'targetType' => 'admin',
            'detail' => array('username' => $username, 'reason' => $captchaOk ? 'credentials' : 'captcha'),
            'ip' => request_ip()
        ));
        if ($failCount >= 5) fail(429, '連續錯誤 5 次，此帳號已鎖定 15 分鐘');
        fail(401, $captchaOk ? '帳號或密碼不正確' : '驗證碼不正確，請重新輸入');
    }
    if (!(int) $admin['is_active']) fail(403, '此帳號已停用，請聯絡最大管理者');
    db_run('DELETE FROM admin_login_locks WHERE username = ?', array($username));
    write_audit(array('adminId' => (int) $admin['id'], 'action' => 'admin.login', 'targetType' => 'admin', 'targetId' => (int) $admin['id'], 'ip' => request_ip()));
    json_out(array(
        'token' => jwt_sign(array('typ' => 'admin', 'id' => (int) $admin['id'])),
        'admin' => array('id' => (int) $admin['id'], 'name' => $admin['name'], 'username' => $admin['username'], 'roleName' => $admin['role_name'])
    ));
}

function read_flag($value) {
    return $value === true || $value === 1 || $value === '1' || $value === 'true';
}

function clean_image_path($value) {
    $text = trim((string) $value);
    if ($text === '') return '';
    if (preg_match('#^/uploads/[a-z0-9.-]+$#i', $text)) return $text;
    if (preg_match('#^/images/(products|articles|banners)/[a-z0-9.-]+\.svg$#i', $text)) return $text;
    fail(400, '圖片路徑不正確');
}

function remove_upload($url) {
    $text = clean_image_path($url);
    if (strpos($text, '/uploads/') !== 0) return false;
    $file = dirname(__DIR__) . '/uploads/' . substr($text, strlen('/uploads/'));
    $root = realpath(dirname(__DIR__) . '/uploads');
    $real = realpath($file);
    if (!$root || !$real || strpos($real, $root) !== 0 || !is_file($real)) return false;
    return unlink($real);
}

function release_image($url) {
    $text = trim((string) $url);
    if (strpos($text, '/uploads/') !== 0) return false;
    if (db_one('SELECT 1 AS n FROM banners WHERE image = ?', array($text))) return false;
    if (db_one('SELECT 1 AS n FROM products WHERE main_image = ?', array($text))) return false;
    if (db_one('SELECT 1 AS n FROM articles WHERE cover_image = ?', array($text))) return false;
    $details = db_all("SELECT detail_images FROM products WHERE detail_images <> ''");
    foreach ($details as $row) {
        $list = json_list($row['detail_images']);
        if (in_array($text, $list, true)) return false;
    }
    return remove_upload($text);
}

function save_uploaded_image() {
    if (empty($_FILES['file']) || !is_array($_FILES['file'])) fail(400, '請選擇圖片檔案');
    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) fail(400, '請選擇圖片檔案');
    if ($file['size'] <= 0 || $file['size'] > 12 * 1024 * 1024) fail(400, '圖片請小於 12MB');
    if (!function_exists('imagecreatefromjpeg')) fail(500, '主機沒有啟用 GD 圖片函式，無法壓縮上傳的照片');
    $info = @getimagesize($file['tmp_name']);
    if (!$info || empty($info['mime'])) fail(400, '只接受 JPG、PNG、GIF 或 WEBP');
    $mime = $info['mime'];
    if ($mime === 'image/jpeg') $src = @imagecreatefromjpeg($file['tmp_name']);
    elseif ($mime === 'image/png') $src = @imagecreatefrompng($file['tmp_name']);
    elseif ($mime === 'image/gif') $src = @imagecreatefromgif($file['tmp_name']);
    elseif ($mime === 'image/webp' && function_exists('imagecreatefromwebp')) $src = @imagecreatefromwebp($file['tmp_name']);
    else fail(400, '只接受 JPG、PNG、GIF 或 WEBP');
    if (!$src) fail(400, '圖片無法處理，請改傳 JPG、PNG 或 WEBP');
    if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
        $exif = @exif_read_data($file['tmp_name']);
        $orientation = isset($exif['Orientation']) ? (int) $exif['Orientation'] : 1;
        if ($orientation === 3) $src = imagerotate($src, 180, 0);
        elseif ($orientation === 6) $src = imagerotate($src, -90, 0);
        elseif ($orientation === 8) $src = imagerotate($src, 90, 0);
    }
    $width = imagesx($src);
    $height = imagesy($src);
    $targetWidth = $width > 1600 ? 1600 : $width;
    $targetHeight = (int) max(1, round($height * ($targetWidth / $width)));
    $dst = imagecreatetruecolor($targetWidth, $targetHeight);
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    $clear = imagecolorallocatealpha($dst, 0, 0, 0, 127);
    imagefilledrectangle($dst, 0, 0, $targetWidth, $targetHeight, $clear);
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);
    $dir = dirname(__DIR__) . '/uploads';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $stem = time() . '-' . bin2hex(random_bytes(6));
    $saved = false;
    if (function_exists('imagewebp')) $saved = imagewebp($dst, $dir . '/' . $stem . '.webp', 85);
    if ($saved) $name = $stem . '.webp';
    else {
        imagejpeg($dst, $dir . '/' . $stem . '.jpg', 85);
        $name = $stem . '.jpg';
    }
    imagedestroy($src);
    imagedestroy($dst);
    return '/uploads/' . $name;
}

function product_input($body) {
    $colors = optional_text(isset($body['colors']) ? $body['colors'] : '', 80, '顏色');
    $parts = preg_split('/[|,、，]/u', $colors);
    $clean = array();
    foreach ($parts as $part) {
        $part = trim($part);
        if ($part !== '') $clean[] = $part;
    }
    if (count($clean) > 8) fail(400, '顏色最多 8 種');
    $extra = isset($body['extraFields']) && is_array($body['extraFields']) ? $body['extraFields'] : array();
    if (count($extra) > 12) fail(400, '自訂欄位最多 12 個');
    $fields = array();
    foreach ($extra as $item) {
        $fields[] = array(
            'label' => sanitize_plain(isset($item['label']) ? $item['label'] : '', 20, '欄位名稱', true),
            'value' => sanitize_plain(isset($item['value']) ? $item['value'] : '', 200, '欄位內容', true)
        );
    }
    $images = isset($body['detailImages']) && is_array($body['detailImages']) ? $body['detailImages'] : array();
    if (count($images) > 8) fail(400, '細節圖最多 8 張');
    $details = array();
    foreach ($images as $image) {
        $path = clean_image_path($image);
        if ($path !== '') $details[] = $path;
    }
    return array(
        'categoryId' => required_int(isset($body['categoryId']) ? $body['categoryId'] : null, '分類', 1),
        'name' => required_text(isset($body['name']) ? $body['name'] : '', 80, '商品名稱'),
        'summary' => optional_text(isset($body['summary']) ? $body['summary'] : '', 200, '品牌簡介'),
        'description' => optional_text(isset($body['description']) ? $body['description'] : '', 4000, '商品說明'),
        'price' => required_int(isset($body['price']) ? $body['price'] : null, '價格', 0, 10000000),
        'material' => optional_text(isset($body['material']) ? $body['material'] : '', 80, '材質'),
        'weightGrams' => optional_number(isset($body['weightGrams']) ? $body['weightGrams'] : null, '重量'),
        'stock' => required_int(isset($body['stock']) ? $body['stock'] : null, '庫存', 0, 100000),
        'colors' => implode('|', $clean),
        'care' => optional_text(isset($body['care']) ? $body['care'] : '', 2000, '保養說明'),
        'mainImage' => clean_image_path(isset($body['mainImage']) ? $body['mainImage'] : ''),
        'detailImages' => $details,
        'extraFields' => $fields,
        'isPublished' => read_flag(isset($body['isPublished']) ? $body['isPublished'] : null) ? 1 : 0
    );
}

function load_admin_product($id) {
    return db_one('SELECT ' . PRODUCT_SELECT . ' FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?', array($id));
}

function published_date($value) {
    $text = required_text($value, 10, '發布日期');
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $text, $match)) fail(400, '發布日期格式不正確');
    if (!checkdate((int) $match[2], (int) $match[3], (int) $match[1])) fail(400, '發布日期格式不正確');
    return $text . ' 12:00:00';
}

function article_input($body) {
    $content = sanitize_plain(isset($body['content']) ? $body['content'] : '', 8000, '內文', true);
    $summary = sanitize_plain(isset($body['summary']) ? $body['summary'] : '', 200, '摘要');
    if ($summary === '') $summary = mb_substr(preg_replace('/\s+/u', ' ', $content), 0, 80, 'UTF-8');
    return array(
        'title' => sanitize_plain(isset($body['title']) ? $body['title'] : '', 120, '標題', true),
        'summary' => $summary,
        'content' => $content,
        'coverImage' => clean_image_path(isset($body['coverImage']) ? $body['coverImage'] : ''),
        'publishedAt' => published_date(isset($body['publishedAt']) ? $body['publishedAt'] : ''),
        'isPublished' => read_flag(isset($body['isPublished']) ? $body['isPublished'] : null) ? 1 : 0
    );
}

function load_article($id) {
    return db_one('SELECT ' . ARTICLE_SELECT . ' FROM articles a LEFT JOIN admins ON admins.id = a.author_admin_id WHERE a.id = ?', array($id));
}

function banner_input($body) {
    $image = trim(isset($body['image']) ? (string) $body['image'] : '');
    if ($image !== '' && !preg_match('#^/images/banners/[a-z0-9.-]+\.svg$#i', $image)) $image = clean_image_path($image);
    $link = sanitize_plain(isset($body['linkHref']) ? $body['linkHref'] : '', 120, '連結', true);
    if (strpos($link, '/') !== 0 || strpos($link, '//') === 0 || strpos($link, '\\') !== false) fail(400, '連結請填本站路徑，例如 /shop.html');
    return array(
        'eyebrow' => sanitize_plain(isset($body['eyebrow']) ? $body['eyebrow'] : '', 40, '小標'),
        'title' => sanitize_plain(isset($body['title']) ? $body['title'] : '', 80, '標題', true),
        'body' => sanitize_plain(isset($body['body']) ? $body['body'] : '', 200, '說明'),
        'linkHref' => $link,
        'linkLabel' => sanitize_plain(isset($body['linkLabel']) ? $body['linkLabel'] : '', 20, '按鈕文字', true),
        'image' => $image,
        'altText' => sanitize_plain(isset($body['altText']) ? $body['altText'] : '', 80, '圖片說明'),
        'imageWidth' => required_int(isset($body['imageWidth']) ? $body['imageWidth'] : null, '圖片寬度', 80, 1600),
        'imageHeight' => required_int(isset($body['imageHeight']) ? $body['imageHeight'] : null, '圖片高度', 80, 480),
        'sortOrder' => required_int(isset($body['sortOrder']) ? $body['sortOrder'] : null, '排序', 0, 999),
        'isPublished' => read_flag(isset($body['isPublished']) ? $body['isPublished'] : null) ? 1 : 0
    );
}

function inquiry_input($body) {
    return array(
        'name' => sanitize_plain(isset($body['name']) ? $body['name'] : '', 40, '姓名', true),
        'phone' => required_phone(sanitize_plain(isset($body['phone']) ? $body['phone'] : '', 20, '電話', true)),
        'email' => required_email(sanitize_plain(isset($body['email']) ? $body['email'] : '', 120, '電子郵件', true)),
        'message' => sanitize_plain(isset($body['message']) ? $body['message'] : '', 1000, '諮詢內容', true)
    );
}

function map_inquiry($row) {
    return array(
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'phone' => $row['phone'],
        'email' => $row['email'],
        'message' => $row['message'],
        'createdAt' => $row['created_at']
    );
}

function modules_catalog() {
    return array(
        array('code' => 'products', 'name' => '商品管理', 'permissions' => array('catalog.read', 'products.write', 'categories.write')),
        array('code' => 'articles', 'name' => '文章管理', 'permissions' => array('articles.read', 'articles.write')),
        array('code' => 'orders', 'name' => '訂單管理', 'permissions' => array('orders.read', 'orders.write')),
        array('code' => 'members', 'name' => '會員管理', 'permissions' => array('members.read')),
        array('code' => 'inquiries', 'name' => '聯絡訊息', 'permissions' => array('inquiries.read', 'inquiries.write')),
        array('code' => 'admins', 'name' => '管理員與權限', 'permissions' => array('admins.read', 'admins.write', 'permissions.write')),
        array('code' => 'audit', 'name' => '操作日誌', 'permissions' => array('audit.read'))
    );
}

function modules_for($codes) {
    $out = array();
    foreach (modules_catalog() as $module) {
        $ok = true;
        foreach ($module['permissions'] as $code) {
            if (!in_array($code, $codes, true)) $ok = false;
        }
        if ($ok) $out[] = $module['code'];
    }
    return $out;
}

function route_admin_me() {
    $admin = current_admin();
    $rows = db_all(
        'SELECT p.code, p.name, p.description FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id JOIN admins a ON a.role_id = rp.role_id WHERE a.id = ? ORDER BY p.id',
        array($admin['id'])
    );
    json_out(array(
        'id' => $admin['id'],
        'name' => $admin['name'],
        'username' => $admin['username'],
        'role' => array('code' => $admin['roleCode'], 'name' => $admin['roleName'], 'level' => $admin['roleLevel']),
        'permissions' => $rows
    ));
}

function route_admin_summary() {
    $admin = current_admin();
    $summary = array();
    if (array_intersect(array('catalog.read', 'products.write'), $admin['permissions'])) {
        $summary['productCount'] = (int) db_one('SELECT COUNT(*) AS n FROM products')['n'];
    }
    if (array_intersect(array('articles.read', 'articles.write'), $admin['permissions'])) {
        $summary['articleCount'] = (int) db_one('SELECT COUNT(*) AS n FROM articles')['n'];
    }
    if (in_array('orders.read', $admin['permissions'], true)) {
        $summary['orderCount'] = (int) db_one('SELECT COUNT(*) AS n FROM orders')['n'];
        $summary['pendingOrderCount'] = (int) db_one("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'")['n'];
    }
    if (in_array('members.read', $admin['permissions'], true)) {
        $summary['memberCount'] = (int) db_one('SELECT COUNT(*) AS n FROM members')['n'];
    }
    if (array_intersect(array('inquiries.read', 'inquiries.write'), $admin['permissions'])) {
        $summary['inquiryCount'] = (int) db_one('SELECT COUNT(*) AS n FROM inquiries')['n'];
    }
    json_out($summary);
}

function route_admin_products() {
    $admin = current_admin();
    allow_any($admin, array('catalog.read', 'products.write'));
    $rows = db_all('SELECT ' . PRODUCT_SELECT . ' FROM products p JOIN categories c ON c.id = p.category_id ORDER BY p.id');
    $out = array();
    foreach ($rows as $row) $out[] = map_product($row);
    json_out($out);
}

function route_admin_product_create() {
    $admin = current_admin();
    allow_all($admin, array('products.write'));
    $input = product_input(request_body());
    if (!db_one('SELECT id FROM categories WHERE id = ?', array($input['categoryId']))) fail(400, '請選擇有效的分類');
    $info = db_run(
        'INSERT INTO products (category_id, name, slug, summary, description, price, material, weight_grams, stock, colors, care, main_image, detail_images, extra_fields, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        array($input['categoryId'], $input['name'], 'draft-' . time(), $input['summary'], $input['description'], $input['price'], $input['material'], $input['weightGrams'], $input['stock'], $input['colors'], $input['care'], $input['mainImage'], json_encode($input['detailImages'], JSON_UNESCAPED_UNICODE), json_encode($input['extraFields'], JSON_UNESCAPED_UNICODE), $input['isPublished'])
    );
    db_run('UPDATE products SET slug = ? WHERE id = ?', array('product-' . $info['id'], $info['id']));
    write_audit(array('adminId' => $admin['id'], 'action' => 'product.create', 'targetType' => 'product', 'targetId' => $info['id'], 'detail' => array('name' => $input['name'], 'price' => $input['price'], 'stock' => $input['stock'], 'colors' => $input['colors']), 'ip' => request_ip()));
    json_out(map_product(load_admin_product($info['id'])), 201);
}

function route_admin_product_update($id) {
    $admin = current_admin();
    allow_all($admin, array('products.write'));
    $id = id_param($id);
    $input = product_input(request_body());
    if (!db_one('SELECT id FROM products WHERE id = ?', array($id))) fail(404, '找不到這個商品');
    if (!db_one('SELECT id FROM categories WHERE id = ?', array($input['categoryId']))) fail(400, '請選擇有效的分類');
    db_run(
        'UPDATE products SET category_id = ?, name = ?, summary = ?, description = ?, price = ?, material = ?, weight_grams = ?, stock = ?, colors = ?, care = ?, main_image = ?, detail_images = ?, extra_fields = ?, is_published = ?, updated_at = ? WHERE id = ?',
        array($input['categoryId'], $input['name'], $input['summary'], $input['description'], $input['price'], $input['material'], $input['weightGrams'], $input['stock'], $input['colors'], $input['care'], $input['mainImage'], json_encode($input['detailImages'], JSON_UNESCAPED_UNICODE), json_encode($input['extraFields'], JSON_UNESCAPED_UNICODE), $input['isPublished'], timestamp(), $id)
    );
    write_audit(array('adminId' => $admin['id'], 'action' => 'product.update', 'targetType' => 'product', 'targetId' => $id, 'detail' => array('name' => $input['name'], 'price' => $input['price'], 'stock' => $input['stock'], 'isPublished' => $input['isPublished']), 'ip' => request_ip()));
    json_out(map_product(load_admin_product($id)));
}

function route_admin_product_delete($id) {
    $admin = current_admin();
    allow_all($admin, array('products.write'));
    $id = id_param($id);
    $current = db_one('SELECT id, name FROM products WHERE id = ?', array($id));
    if (!$current) fail(404, '找不到這個商品');
    db_run('DELETE FROM products WHERE id = ?', array($id));
    write_audit(array('adminId' => $admin['id'], 'action' => 'product.delete', 'targetType' => 'product', 'targetId' => $id, 'detail' => array('name' => $current['name']), 'ip' => request_ip()));
    json_out(array('ok' => true));
}

function route_admin_category_create() {
    $admin = current_admin();
    allow_all($admin, array('categories.write'));
    $body = request_body();
    $name = required_text(isset($body['name']) ? $body['name'] : '', 40, '分類名稱');
    $description = optional_text(isset($body['description']) ? $body['description'] : '', 200, '分類說明');
    $sort = (int) db_one('SELECT COALESCE(MAX(sort_order), 0) AS n FROM categories')['n'] + 1;
    $info = db_run('INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)', array($name, 'draft-' . time(), $description, $sort));
    db_run('UPDATE categories SET slug = ? WHERE id = ?', array('category-' . $info['id'], $info['id']));
    $row = db_one('SELECT * FROM categories WHERE id = ?', array($info['id']));
    write_audit(array('adminId' => $admin['id'], 'action' => 'category.create', 'targetType' => 'category', 'targetId' => $info['id'], 'detail' => array('name' => $name), 'ip' => request_ip()));
    json_out(array('id' => (int) $row['id'], 'name' => $row['name'], 'slug' => $row['slug'], 'description' => $row['description'], 'sortOrder' => (int) $row['sort_order']), 201);
}

function route_admin_articles() {
    $admin = current_admin();
    allow_any($admin, array('articles.read', 'articles.write'));
    $rows = db_all('SELECT ' . ARTICLE_SELECT . ' FROM articles a LEFT JOIN admins ON admins.id = a.author_admin_id ORDER BY a.id DESC');
    $out = array();
    foreach ($rows as $row) $out[] = map_article($row);
    json_out($out);
}

function route_admin_article_create() {
    $admin = current_admin();
    allow_all($admin, array('articles.write'));
    $input = article_input(request_body());
    $info = db_run(
        'INSERT INTO articles (title, slug, summary, content, cover_image, is_published, author_admin_id, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        array($input['title'], 'draft-' . time(), $input['summary'], $input['content'], $input['coverImage'], $input['isPublished'], $admin['id'], $input['publishedAt'])
    );
    db_run('UPDATE articles SET slug = ? WHERE id = ?', array('article-' . $info['id'], $info['id']));
    write_audit(array('adminId' => $admin['id'], 'action' => 'article.create', 'targetType' => 'article', 'targetId' => $info['id'], 'detail' => array('title' => $input['title'], 'publishedAt' => $input['publishedAt']), 'ip' => request_ip()));
    json_out(map_article(load_article($info['id'])), 201);
}

function route_admin_article_update($id) {
    $admin = current_admin();
    allow_all($admin, array('articles.write'));
    $id = id_param($id);
    $input = article_input(request_body());
    if (!db_one('SELECT id FROM articles WHERE id = ?', array($id))) fail(404, '找不到這篇文章');
    db_run(
        'UPDATE articles SET title = ?, summary = ?, content = ?, cover_image = ?, is_published = ?, published_at = ?, updated_at = ? WHERE id = ?',
        array($input['title'], $input['summary'], $input['content'], $input['coverImage'], $input['isPublished'], $input['publishedAt'], timestamp(), $id)
    );
    write_audit(array('adminId' => $admin['id'], 'action' => 'article.update', 'targetType' => 'article', 'targetId' => $id, 'detail' => array('title' => $input['title'], 'isPublished' => $input['isPublished'], 'publishedAt' => $input['publishedAt']), 'ip' => request_ip()));
    json_out(map_article(load_article($id)));
}

function route_admin_article_delete($id) {
    $admin = current_admin();
    allow_all($admin, array('articles.write'));
    $id = id_param($id);
    $current = db_one('SELECT id, title FROM articles WHERE id = ?', array($id));
    if (!$current) fail(404, '找不到這篇文章');
    db_run('DELETE FROM articles WHERE id = ?', array($id));
    write_audit(array('adminId' => $admin['id'], 'action' => 'article.delete', 'targetType' => 'article', 'targetId' => $id, 'detail' => array('title' => $current['title']), 'ip' => request_ip()));
    json_out(array('ok' => true));
}

function route_admin_payment_get() {
    $admin = current_admin();
    allow_all($admin, array('orders.write'));
    json_out(payment_settings());
}

function route_admin_payment_save() {
    $admin = current_admin();
    allow_all($admin, array('orders.write'));
    $body = request_body();
    $online = !empty($body['online']);
    $bankName = sanitize_plain(isset($body['bankName']) ? $body['bankName'] : '', 40, '銀行名稱');
    $payeeName = sanitize_plain(isset($body['payeeName']) ? $body['payeeName'] : '', 40, '收款戶名', !$online);
    $payeeAccount = sanitize_plain(isset($body['payeeAccount']) ? $body['payeeAccount'] : '', 30, '收款帳號', !$online);
    if ($payeeAccount !== '' && !preg_match('/^[0-9-]{6,30}$/', $payeeAccount)) fail(400, '收款帳號請填數字或連字號');
    $settings = array(
        'online' => $online,
        'bankName' => $bankName,
        'payeeName' => $payeeName,
        'payeeAccount' => $payeeAccount
    );
    $json = json_encode($settings, JSON_UNESCAPED_UNICODE);
    if ($json === false || mb_strlen($json, 'UTF-8') > 255) fail(400, '匯款資訊過長，請縮短後再儲存');
    $existing = db_one('SELECT meta_key FROM schema_meta WHERE meta_key = ?', array('payment_settings'));
    if ($existing) {
        db_run('UPDATE schema_meta SET `value` = ? WHERE meta_key = ?', array($json, 'payment_settings'));
    } else {
        db_run('INSERT INTO schema_meta (meta_key, `value`) VALUES (?, ?)', array('payment_settings', $json));
    }
    write_audit(array(
        'adminId' => $admin['id'],
        'action' => 'payment.settings',
        'targetType' => 'shop',
        'targetId' => null,
        'detail' => array('online' => $online, 'payeeName' => $payeeName),
        'ip' => request_ip()
    ));
    json_out($settings);
}

function route_admin_orders() {
    $admin = current_admin();
    allow_all($admin, array('orders.read'));
    json_out(list_orders(null));
}

function refresh_order_totals($orderId) {
    $sum = db_one('SELECT COALESCE(SUM(line_total), 0) AS subtotal FROM order_items WHERE order_id = ?', array($orderId));
    $order = db_one('SELECT shipping_fee FROM orders WHERE id = ?', array($orderId));
    $subtotal = (int) $sum['subtotal'];
    $shipping = (int) $order['shipping_fee'];
    db_run(
        'UPDATE orders SET subtotal = ?, total = ?, updated_at = ? WHERE id = ?',
        array($subtotal, $subtotal + $shipping, timestamp(), $orderId)
    );
}

function route_admin_order_quantities() {
    $admin = current_admin();
    allow_all($admin, array('orders.write'));
    $body = request_body();
    $items = isset($body['items']) && is_array($body['items']) ? $body['items'] : array();
    if (!$items) fail(400, '請先勾選要修改數量的訂單');
    if (count($items) > 100) fail(400, '一次修改的品項過多');
    db()->beginTransaction();
    try {
        $touched = array();
        foreach ($items as $entry) {
            if (!is_array($entry)) fail(400, '明細格式不正確');
            $itemId = required_int(isset($entry['id']) ? $entry['id'] : null, '明細', 1);
            $quantity = required_int(isset($entry['quantity']) ? $entry['quantity'] : null, '數量', 1, 99);
            $row = db_one(
                'SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.unit_price, oi.quantity, o.status, o.order_no
                 FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ?',
                array($itemId)
            );
            if (!$row) fail(404, '找不到訂單明細');
            $delta = $quantity - (int) $row['quantity'];
            if ($delta !== 0 && holds_stock($row['status'])) {
                if (!$row['product_id']) fail(400, '「' . $row['product_name'] . '」已從商品刪除，無法調整數量');
                if ($delta > 0) {
                    $result = db_run(
                        'UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?',
                        array($delta, timestamp(), $row['product_id'], $delta)
                    );
                    if ($result['changes'] !== 1) fail(400, '「' . $row['product_name'] . '」庫存不足，無法增加數量');
                } else {
                    db_run(
                        'UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?',
                        array(-$delta, timestamp(), $row['product_id'])
                    );
                }
            }
            db_run(
                'UPDATE order_items SET quantity = ?, line_total = ? WHERE id = ?',
                array($quantity, (int) $row['unit_price'] * $quantity, $itemId)
            );
            $touched[(int) $row['order_id']] = $row['order_no'];
        }
        foreach ($touched as $orderId => $orderNo) {
            refresh_order_totals($orderId);
            write_audit(array(
                'adminId' => $admin['id'],
                'action' => 'order.quantity',
                'targetType' => 'order',
                'targetId' => $orderId,
                'detail' => array('orderNo' => $orderNo),
                'ip' => request_ip()
            ));
        }
        db()->commit();
    } catch (Exception $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
    json_out(array('ok' => true));
}

function route_admin_orders_delete() {
    $admin = current_admin();
    allow_all($admin, array('orders.write'));
    $body = request_body();
    $ids = isset($body['ids']) && is_array($body['ids']) ? $body['ids'] : array();
    if (!$ids) fail(400, '請先勾選要刪除的訂單');
    if (count($ids) > 100) fail(400, '一次刪除的訂單過多');
    $clean = array();
    foreach ($ids as $id) $clean[required_int($id, '訂單', 1)] = true;
    db()->beginTransaction();
    try {
        foreach (array_keys($clean) as $id) {
            $order = db_one('SELECT id, order_no, status FROM orders WHERE id = ?', array($id));
            if (!$order) fail(404, '找不到要刪除的訂單');
            if (holds_stock($order['status'])) {
                $items = db_all('SELECT product_id, quantity FROM order_items WHERE order_id = ?', array($id));
                foreach ($items as $item) {
                    if (!$item['product_id']) continue;
                    db_run(
                        'UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?',
                        array((int) $item['quantity'], timestamp(), $item['product_id'])
                    );
                }
            }
            db_run('DELETE FROM orders WHERE id = ?', array($id));
            write_audit(array(
                'adminId' => $admin['id'],
                'action' => 'order.delete',
                'targetType' => 'order',
                'targetId' => $id,
                'detail' => array('orderNo' => $order['order_no']),
                'ip' => request_ip()
            ));
        }
        db()->commit();
    } catch (Exception $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
    json_out(array('ok' => true));
}

function route_admin_tracking($id) {
    $admin = current_admin();
    allow_all($admin, array('orders.write'));
    $id = id_param($id);
    $body = request_body();
    $order = db_one('SELECT id, order_no, tracking_no FROM orders WHERE id = ?', array($id));
    if (!$order) fail(404, '找不到這筆訂單');
    $value = trim(isset($body['trackingNo']) ? (string) $body['trackingNo'] : '');
    if (strlen($value) > 40) fail(400, '物流單號請少於 40 個字');
    if ($value !== '' && !preg_match('/^[A-Za-z0-9-]+$/', $value)) fail(400, '物流單號只接受英數與減號');
    db_run('UPDATE orders SET tracking_no = ?, updated_at = ? WHERE id = ?', array($value, timestamp(), $id));
    write_audit(array('adminId' => $admin['id'], 'action' => 'order.tracking', 'targetType' => 'order', 'targetId' => $id, 'detail' => array('orderNo' => $order['order_no'], 'trackingNo' => $value), 'ip' => request_ip()));
    json_out(map_full_order(db_one('SELECT * FROM orders WHERE id = ?', array($id))));
}

function route_admin_status($id) {
    $admin = current_admin();
    allow_all($admin, array('orders.write'));
    $body = request_body();
    $status = required_text(isset($body['status']) ? $body['status'] : '', 20, '訂單狀態');
    json_out(set_order_status(id_param($id), $status, $admin, null));
}

function route_admin_members() {
    $admin = current_admin();
    allow_all($admin, array('members.read'));
    $rows = db_all('SELECT id, name, email, phone, line_id, created_at FROM members ORDER BY id DESC');
    $out = array();
    foreach ($rows as $row) $out[] = map_member($row);
    json_out($out);
}

function route_admin_member_update($id) {
    $admin = current_admin();
    allow_all($admin, array('members.read'));
    $id = id_param($id);
    $current = db_one('SELECT id, name, email, phone, line_id FROM members WHERE id = ?', array($id));
    if (!$current) fail(404, '找不到這位會員');
    $body = request_body();
    $name = required_text(isset($body['name']) ? $body['name'] : '', 40, '姓名');
    $emailInput = trim(isset($body['email']) ? (string) $body['email'] : '');
    if ($emailInput === '') {
        $email = substr((string) $current['email'], -14) === '@members.local'
            ? $current['email']
            : ('m' . time() . mt_rand(0, 999) . '@members.local');
    } else {
        $email = required_email($emailInput);
    }
    $phone = canonical_phone(isset($body['phone']) ? $body['phone'] : '', false);
    $lineInput = trim(isset($body['lineId']) ? (string) $body['lineId'] : '');
    $line = $lineInput === '' ? '' : line_id($lineInput);
    $password = trim(isset($body['password']) ? (string) $body['password'] : '');
    if ($password !== '') $password = read_password($password);
    $emailTaken = db_one('SELECT id FROM members WHERE LOWER(email) = LOWER(?) AND id <> ?', array($email, $id));
    if ($emailTaken) fail(409, '這個電子郵件已經註冊');
    if ($phone !== '' && db_one('SELECT id FROM members WHERE phone = ? AND id <> ?', array($phone, $id))) fail(409, '這個電話號碼已經註冊');
    if ($line !== '' && db_one('SELECT id FROM members WHERE LOWER(line_id) = LOWER(?) AND id <> ?', array($line, $id))) fail(409, '這個 LINE ID 已經註冊');
    if ($password !== '') {
        db_run(
            'UPDATE members SET name = ?, email = ?, phone = ?, line_id = ?, password_hash = ?, updated_at = ? WHERE id = ?',
            array($name, $email, $phone, $line, hash_pw($password), timestamp(), $id)
        );
    } else {
        db_run(
            'UPDATE members SET name = ?, email = ?, phone = ?, line_id = ?, updated_at = ? WHERE id = ?',
            array($name, $email, $phone, $line, timestamp(), $id)
        );
    }
    write_audit(array(
        'adminId' => $admin['id'],
        'action' => 'member.update',
        'targetType' => 'member',
        'targetId' => $id,
        'detail' => array('name' => $name),
        'ip' => request_ip()
    ));
    json_out(map_member(db_one('SELECT id, name, email, phone, line_id, created_at FROM members WHERE id = ?', array($id))));
}

function route_admin_members_delete() {
    $admin = current_admin();
    allow_all($admin, array('members.read'));
    $body = request_body();
    $ids = isset($body['ids']) && is_array($body['ids']) ? $body['ids'] : array();
    if (!$ids) fail(400, '請先勾選要刪除的會員');
    if (count($ids) > 100) fail(400, '一次刪除的會員過多');
    $clean = array();
    foreach ($ids as $id) $clean[required_int($id, '會員', 1)] = true;
    db()->beginTransaction();
    try {
        foreach (array_keys($clean) as $id) {
            $member = db_one('SELECT id, name FROM members WHERE id = ?', array($id));
            if (!$member) fail(404, '找不到要刪除的會員');
            db_run('DELETE FROM members WHERE id = ?', array($id));
            write_audit(array(
                'adminId' => $admin['id'],
                'action' => 'member.delete',
                'targetType' => 'member',
                'targetId' => $id,
                'detail' => array('name' => $member['name']),
                'ip' => request_ip()
            ));
        }
        db()->commit();
    } catch (Exception $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
    json_out(array('ok' => true));
}

function route_admin_upload() {
    $admin = current_admin();
    allow_any($admin, array('products.write', 'articles.write'));
    json_out(array('url' => save_uploaded_image()), 201);
}

function route_admin_upload_delete() {
    $admin = current_admin();
    allow_any($admin, array('products.write', 'articles.write'));
    $body = request_body();
    $image = clean_image_path(isset($body['image']) ? $body['image'] : '');
    if (strpos($image, '/uploads/') !== 0) fail(400, '只能刪除上傳的圖片');
    if (!release_image($image)) fail(409, '這張圖片仍被使用');
    json_out(array('ok' => true));
}

function route_admin_roles() {
    $admin = current_admin();
    allow_any($admin, array('admins.read', 'permissions.write'));
    $roles = db_all('SELECT id, code, name, description, role_level FROM roles ORDER BY role_level, id');
    $out = array();
    foreach ($roles as $role) {
        $codes = array();
        $rows = db_all('SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id WHERE rp.role_id = ?', array($role['id']));
        foreach ($rows as $row) $codes[] = $row['code'];
        $out[] = array(
            'id' => (int) $role['id'],
            'code' => $role['code'],
            'name' => $role['name'],
            'description' => $role['description'],
            'level' => (int) $role['role_level'],
            'modules' => modules_for($codes),
            'locked' => $role['code'] === 'super_admin'
        );
    }
    $modules = array();
    foreach (modules_catalog() as $module) $modules[] = array('code' => $module['code'], 'name' => $module['name']);
    json_out(array('modules' => $modules, 'roles' => $out));
}

function route_admin_role_modules($id) {
    $admin = current_admin();
    allow_all($admin, array('permissions.write'));
    $id = id_param($id);
    $role = db_one('SELECT id, code, name FROM roles WHERE id = ?', array($id));
    if (!$role) fail(404, '找不到這個角色');
    if ($role['code'] === 'super_admin') fail(400, '最大管理者固定擁有全部模組');
    $body = request_body();
    $requested = isset($body['modules']) && is_array($body['modules']) ? $body['modules'] : null;
    if ($requested === null) fail(400, '請勾選可使用的模組');
    $catalog = modules_catalog();
    $known = array();
    foreach ($catalog as $module) $known[] = $module['code'];
    foreach ($requested as $code) {
        if (!in_array($code, $known, true)) fail(400, '有無法辨識的模組');
    }
    $codes = array();
    foreach ($catalog as $module) {
        if (in_array($module['code'], $requested, true)) {
            foreach ($module['permissions'] as $permission) $codes[$permission] = true;
        }
    }
    $codes = array_keys($codes);
    $permissionIds = db_all('SELECT id, code FROM permissions');
    db()->beginTransaction();
    try {
        db_run('DELETE FROM role_permissions WHERE role_id = ?', array($id));
        foreach ($codes as $code) {
            $permissionId = null;
            foreach ($permissionIds as $permission) {
                if ($permission['code'] === $code) $permissionId = (int) $permission['id'];
            }
            if (!$permissionId) fail(400, '權限資料不完整');
            db_run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', array($id, $permissionId));
        }
        write_audit(array('adminId' => $admin['id'], 'action' => 'role.permissions', 'targetType' => 'role', 'targetId' => $id, 'detail' => array('role' => $role['name'], 'modules' => $requested), 'ip' => request_ip()));
        db()->commit();
    } catch (Exception $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
    json_out(array('ok' => true, 'modules' => modules_for($codes)));
}

function route_admin_create() {
    $admin = current_admin();
    allow_all($admin, array('admins.write'));
    $body = request_body();
    $name = required_text(isset($body['name']) ? $body['name'] : '', 40, '名稱');
    $username = strtolower(required_text(isset($body['username']) ? $body['username'] : '', 40, '帳號'));
    $email = required_email(isset($body['email']) ? $body['email'] : '');
    $password = isset($body['password']) ? (string) $body['password'] : '';
    $roleId = required_int(isset($body['roleId']) ? $body['roleId'] : null, '角色', 1);
    if (!preg_match('/^[a-z0-9]{3,20}$/', $username)) fail(400, '帳號請使用 3 到 20 個英數小寫');
    if (strlen($password) < 8 || strlen($password) > 72) fail(400, '密碼請設定 8 到 72 個字元');
    $role = db_one('SELECT id, name, code FROM roles WHERE id = ?', array($roleId));
    if (!$role) fail(400, '請選擇有效的角色');
    if (db_one('SELECT id FROM admins WHERE username = ?', array($username))) fail(400, '這個帳號已經有人使用');
    if (db_one('SELECT id FROM admins WHERE email = ?', array($email))) fail(400, '這個電子郵件已經有人使用');
    $info = db_run(
        'INSERT INTO admins (role_id, name, username, email, password_hash) VALUES (?, ?, ?, ?, ?)',
        array($roleId, $name, $username, $email, hash_pw($password))
    );
    write_audit(array('adminId' => $admin['id'], 'action' => 'admin.create', 'targetType' => 'admin', 'targetId' => $info['id'], 'detail' => array('username' => $username, 'role' => $role['name']), 'ip' => request_ip()));
    json_out(array('id' => $info['id'], 'name' => $name, 'username' => $username, 'roleName' => $role['name']), 201);
}

function route_admin_list() {
    $admin = current_admin();
    allow_all($admin, array('admins.read'));
    $rows = db_all('SELECT a.id, a.name, a.username, a.email, a.is_active, a.created_at, a.role_id, r.name AS role_name, r.code AS role_code, r.role_level FROM admins a JOIN roles r ON r.id = a.role_id ORDER BY r.role_level, a.id');
    $out = array();
    foreach ($rows as $row) {
        $out[] = array(
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'username' => $row['username'],
            'email' => $row['email'],
            'isActive' => (bool) $row['is_active'],
            'roleId' => (int) $row['role_id'],
            'roleName' => $row['role_name'],
            'roleCode' => $row['role_code'],
            'roleLevel' => (int) $row['role_level'],
            'createdAt' => $row['created_at']
        );
    }
    json_out($out);
}

function route_admin_update($id) {
    $admin = current_admin();
    allow_all($admin, array('admins.write'));
    $id = id_param($id);
    $current = db_one('SELECT a.id, a.username, a.role_id, r.code AS role_code FROM admins a JOIN roles r ON r.id = a.role_id WHERE a.id = ?', array($id));
    if (!$current) fail(404, '找不到這個管理員');
    $body = request_body();
    $name = required_text(isset($body['name']) ? $body['name'] : '', 40, '名稱');
    $username = strtolower(required_text(isset($body['username']) ? $body['username'] : '', 40, '帳號'));
    $email = required_email(isset($body['email']) ? $body['email'] : '');
    $roleId = required_int(isset($body['roleId']) ? $body['roleId'] : null, '角色', 1);
    $password = isset($body['password']) ? (string) $body['password'] : '';
    if (!preg_match('/^[a-z0-9]{3,20}$/', $username)) fail(400, '帳號請使用 3 到 20 個英數小寫');
    if ($password !== '' && (strlen($password) < 8 || strlen($password) > 72)) fail(400, '密碼請設定 8 到 72 個字元');
    if ($id === $admin['id'] && $roleId !== (int) $current['role_id']) fail(400, '不能修改自己的角色');
    $role = db_one('SELECT id, name, code FROM roles WHERE id = ?', array($roleId));
    if (!$role) fail(400, '請選擇有效的角色');
    if ($current['role_code'] === 'super_admin' && $role['code'] !== 'super_admin') {
        $others = db_one('SELECT COUNT(*) AS total FROM admins a JOIN roles r ON r.id = a.role_id WHERE r.code = ? AND a.id <> ?', array('super_admin', $id));
        if ((int) $others['total'] < 1) fail(400, '至少要保留一位最大管理者');
    }
    if (db_one('SELECT id FROM admins WHERE username = ? AND id <> ?', array($username, $id))) fail(400, '這個帳號已經有人使用');
    if (db_one('SELECT id FROM admins WHERE email = ? AND id <> ?', array($email, $id))) fail(400, '這個電子郵件已經有人使用');
    if ($password !== '') {
        db_run(
            'UPDATE admins SET role_id = ?, name = ?, username = ?, email = ?, password_hash = ?, updated_at = ? WHERE id = ?',
            array($roleId, $name, $username, $email, hash_pw($password), timestamp(), $id)
        );
    } else {
        db_run(
            'UPDATE admins SET role_id = ?, name = ?, username = ?, email = ?, updated_at = ? WHERE id = ?',
            array($roleId, $name, $username, $email, timestamp(), $id)
        );
    }
    if ($username !== $current['username']) {
        db_run('DELETE FROM admin_login_locks WHERE username = ?', array($current['username']));
    }
    write_audit(array('adminId' => $admin['id'], 'action' => 'admin.update', 'targetType' => 'admin', 'targetId' => $id, 'detail' => array('username' => $username, 'role' => $role['name']), 'ip' => request_ip()));
    json_out(array('ok' => true));
}

function route_admin_delete($id) {
    $admin = current_admin();
    allow_all($admin, array('admins.write'));
    $id = id_param($id);
    if ($id === $admin['id']) fail(400, '不能刪除自己的帳號');
    $current = db_one('SELECT a.id, a.username, r.code AS role_code FROM admins a JOIN roles r ON r.id = a.role_id WHERE a.id = ?', array($id));
    if (!$current) fail(404, '找不到這個管理員');
    if ($current['role_code'] === 'super_admin') {
        $others = db_one('SELECT COUNT(*) AS total FROM admins a JOIN roles r ON r.id = a.role_id WHERE r.code = ? AND a.id <> ?', array('super_admin', $id));
        if ((int) $others['total'] < 1) fail(400, '至少要保留一位最大管理者');
    }
    db_run('UPDATE articles SET author_admin_id = NULL WHERE author_admin_id = ?', array($id));
    db_run('UPDATE audit_logs SET admin_id = NULL WHERE admin_id = ?', array($id));
    db_run('DELETE FROM admins WHERE id = ?', array($id));
    db_run('DELETE FROM admin_login_locks WHERE username = ?', array($current['username']));
    write_audit(array('adminId' => $admin['id'], 'action' => 'admin.delete', 'targetType' => 'admin', 'targetId' => $id, 'detail' => array('username' => $current['username']), 'ip' => request_ip()));
    json_out(array('ok' => true));
}

function route_admin_status_flag($id) {
    $admin = current_admin();
    allow_all($admin, array('admins.write'));
    $id = id_param($id);
    if ($id === $admin['id']) fail(400, '不能停用自己的帳號');
    $body = request_body();
    $isActive = read_flag(isset($body['isActive']) ? $body['isActive'] : null) ? 1 : 0;
    $current = db_one('SELECT id, username FROM admins WHERE id = ?', array($id));
    if (!$current) fail(404, '找不到這個管理員');
    db_run('UPDATE admins SET is_active = ?, updated_at = ? WHERE id = ?', array($isActive, timestamp(), $id));
    write_audit(array('adminId' => $admin['id'], 'action' => 'admin.status', 'targetType' => 'admin', 'targetId' => $id, 'detail' => array('username' => $current['username'], 'isActive' => $isActive), 'ip' => request_ip()));
    json_out(array('ok' => true, 'isActive' => (bool) $isActive));
}

function route_admin_banners() {
    $admin = current_admin();
    allow_all($admin, array('products.write'));
    $rows = db_all('SELECT id, eyebrow, title, body, link_href, link_label, image, alt_text, image_width, image_height, sort_order, is_published FROM banners ORDER BY sort_order, id');
    $out = array();
    foreach ($rows as $row) $out[] = map_banner($row);
    json_out($out);
}

function route_admin_banner_create() {
    $admin = current_admin();
    allow_all($admin, array('products.write'));
    $input = banner_input(request_body());
    $info = db_run(
        'INSERT INTO banners (eyebrow, title, body, link_href, link_label, image, alt_text, image_width, image_height, sort_order, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        array($input['eyebrow'], $input['title'], $input['body'], $input['linkHref'], $input['linkLabel'], $input['image'], $input['altText'], $input['imageWidth'], $input['imageHeight'], $input['sortOrder'], $input['isPublished'])
    );
    write_audit(array('adminId' => $admin['id'], 'action' => 'banner.create', 'targetType' => 'banner', 'targetId' => $info['id'], 'detail' => array('title' => $input['title']), 'ip' => request_ip()));
    json_out(map_banner(db_one('SELECT * FROM banners WHERE id = ?', array($info['id']))), 201);
}

function route_admin_banner_update($id) {
    $admin = current_admin();
    allow_all($admin, array('products.write'));
    $id = id_param($id);
    $input = banner_input(request_body());
    $current = db_one('SELECT id, image FROM banners WHERE id = ?', array($id));
    if (!$current) fail(404, '找不到這張主視覺');
    db_run(
        'UPDATE banners SET eyebrow = ?, title = ?, body = ?, link_href = ?, link_label = ?, image = ?, alt_text = ?, image_width = ?, image_height = ?, sort_order = ?, is_published = ?, updated_at = ? WHERE id = ?',
        array($input['eyebrow'], $input['title'], $input['body'], $input['linkHref'], $input['linkLabel'], $input['image'], $input['altText'], $input['imageWidth'], $input['imageHeight'], $input['sortOrder'], $input['isPublished'], timestamp(), $id)
    );
    if ($current['image'] && $current['image'] !== $input['image']) release_image($current['image']);
    write_audit(array('adminId' => $admin['id'], 'action' => 'banner.update', 'targetType' => 'banner', 'targetId' => $id, 'detail' => array('title' => $input['title']), 'ip' => request_ip()));
    json_out(map_banner(db_one('SELECT * FROM banners WHERE id = ?', array($id))));
}

function route_admin_banner_clear_image($id) {
    $admin = current_admin();
    allow_all($admin, array('products.write'));
    $id = id_param($id);
    $current = db_one('SELECT id, image FROM banners WHERE id = ?', array($id));
    if (!$current) fail(404, '找不到這張主視覺');
    $previous = $current['image'];
    db_run('UPDATE banners SET image = ?, updated_at = ? WHERE id = ?', array('', timestamp(), $id));
    release_image($previous);
    write_audit(array('adminId' => $admin['id'], 'action' => 'banner.update', 'targetType' => 'banner', 'targetId' => $id, 'detail' => array('image' => ''), 'ip' => request_ip()));
    json_out(array('ok' => true));
}

function route_admin_banner_delete($id) {
    $admin = current_admin();
    allow_all($admin, array('products.write'));
    $id = id_param($id);
    $current = db_one('SELECT id, title, image FROM banners WHERE id = ?', array($id));
    if (!$current) fail(404, '找不到這張主視覺');
    db_run('DELETE FROM banners WHERE id = ?', array($id));
    release_image($current['image']);
    write_audit(array('adminId' => $admin['id'], 'action' => 'banner.delete', 'targetType' => 'banner', 'targetId' => $id, 'detail' => array('title' => $current['title']), 'ip' => request_ip()));
    json_out(array('ok' => true));
}

function route_admin_inquiries() {
    $admin = current_admin();
    allow_any($admin, array('inquiries.read', 'inquiries.write'));
    $q = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
    if (strlen($q) > 40) $q = substr($q, 0, 40);
    if ($q !== '') {
        $like = '%' . str_replace(array('\\', '%', '_'), array('\\\\', '\\%', '\\_'), $q) . '%';
        $rows = db_all(
            "SELECT id, name, phone, email, message, created_at FROM inquiries WHERE name LIKE ? ESCAPE '\\\\' OR phone LIKE ? ESCAPE '\\\\' OR email LIKE ? ESCAPE '\\\\' OR message LIKE ? ESCAPE '\\\\' ORDER BY id DESC LIMIT 200",
            array($like, $like, $like, $like)
        );
    } else {
        $rows = db_all('SELECT id, name, phone, email, message, created_at FROM inquiries ORDER BY id DESC LIMIT 200');
    }
    $out = array();
    foreach ($rows as $row) $out[] = map_inquiry($row);
    json_out($out);
}

function route_admin_inquiry_update($id) {
    $admin = current_admin();
    allow_all($admin, array('inquiries.write'));
    $id = id_param($id);
    $input = inquiry_input(request_body());
    if (!db_one('SELECT id FROM inquiries WHERE id = ?', array($id))) fail(404, '找不到這則聯絡訊息');
    db_run('UPDATE inquiries SET name = ?, phone = ?, email = ?, message = ? WHERE id = ?', array($input['name'], $input['phone'], $input['email'], $input['message'], $id));
    write_audit(array('adminId' => $admin['id'], 'action' => 'inquiry.update', 'targetType' => 'inquiry', 'targetId' => $id, 'detail' => array('name' => $input['name']), 'ip' => request_ip()));
    json_out(map_inquiry(db_one('SELECT id, name, phone, email, message, created_at FROM inquiries WHERE id = ?', array($id))));
}

function route_admin_inquiries_delete() {
    $admin = current_admin();
    allow_all($admin, array('inquiries.write'));
    $body = request_body();
    $ids = isset($body['ids']) && is_array($body['ids']) ? $body['ids'] : array();
    if (!$ids) fail(400, '請先勾選要刪除的聯絡訊息');
    if (count($ids) > 100) fail(400, '一次刪除的聯絡訊息過多');
    $clean = array();
    foreach ($ids as $id) $clean[required_int($id, '聯絡訊息', 1)] = true;
    db()->beginTransaction();
    try {
        foreach (array_keys($clean) as $id) {
            $inquiry = db_one('SELECT id, name FROM inquiries WHERE id = ?', array($id));
            if (!$inquiry) fail(404, '找不到要刪除的聯絡訊息');
            db_run('DELETE FROM inquiries WHERE id = ?', array($id));
            write_audit(array(
                'adminId' => $admin['id'],
                'action' => 'inquiry.delete',
                'targetType' => 'inquiry',
                'targetId' => $id,
                'detail' => array('name' => $inquiry['name']),
                'ip' => request_ip()
            ));
        }
        db()->commit();
    } catch (Exception $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
    json_out(array('ok' => true));
}

function route_admin_audit() {
    $admin = current_admin();
    allow_all($admin, array('audit.read'));
    $rows = db_all('SELECT l.id, l.admin_id, a.name AS admin_name, a.username, l.action, l.target_type, l.target_id, l.detail, l.ip_address, l.created_at FROM audit_logs l LEFT JOIN admins a ON a.id = l.admin_id ORDER BY l.id DESC LIMIT 100');
    $out = array();
    foreach ($rows as $row) $out[] = map_audit($row);
    json_out($out);
}
