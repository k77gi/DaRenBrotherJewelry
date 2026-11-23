<?php

if (!function_exists('mb_strlen')) {
    function mb_strlen($text, $encoding = 'UTF-8') {
        $count = preg_match_all('/./u', (string) $text, $matches);
        return $count ? $count : 0;
    }
}
if (!function_exists('mb_substr')) {
    function mb_substr($text, $start, $length = null, $encoding = 'UTF-8') {
        $chars = preg_split('//u', (string) $text, -1, PREG_SPLIT_NO_EMPTY);
        $slice = array_slice($chars, $start, $length);
        return implode('', $slice);
    }
}

class HttpError extends Exception {
    public $status;
    public function __construct($status, $message) {
        parent::__construct($message);
        $this->status = $status;
    }
}

function config() {
    static $config;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }
    return $config;
}

function fail($status, $message) {
    throw new HttpError($status, $message);
}

function json_out($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function db() {
    global $PDO;
    return $PDO;
}

function db_one($sql, $params = array()) {
    $stmt = db()->prepare($sql);
    $stmt->execute(array_values($params));
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function db_all($sql, $params = array()) {
    $stmt = db()->prepare($sql);
    $stmt->execute(array_values($params));
    return $stmt->fetchAll();
}

function db_run($sql, $params = array()) {
    $stmt = db()->prepare($sql);
    $stmt->execute(array_values($params));
    return array(
        'id' => (int) db()->lastInsertId(),
        'changes' => $stmt->rowCount()
    );
}

function db_exec($sql) {
    db()->exec($sql);
}

function timestamp() {
    return date('Y-m-d H:i:s');
}

function request_ip() {
    return isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
}

function request_method() {
    $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
    if ($method === 'POST' && !empty($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
        $method = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
    }
    return $method;
}

function app_base() {
    $script = isset($_SERVER['SCRIPT_NAME']) ? str_replace('\\', '/', $_SERVER['SCRIPT_NAME']) : '';
    $dir = rtrim(str_replace('\\', '/', dirname($script)), '/');
    if (substr($dir, -4) === '/api') $dir = substr($dir, 0, -4);
    if ($dir === '' || $dir === '/' || $dir === '.') return '';
    return $dir;
}

function request_path() {
    $uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
    $path = parse_url($uri, PHP_URL_PATH);
    if (!is_string($path) || $path === '') $path = '/';
    $path = rawurldecode($path);
    $pos = strpos($path, '/api/');
    if ($pos !== false) {
        $rest = substr($path, $pos + 4);
        return ($rest === '' || $rest === false) ? '/' : '/' . trim($rest, '/');
    }
    if (strlen($path) >= 4 && substr($path, -4) === '/api') return '/';
    if (!empty($_SERVER['PATH_INFO'])) return '/' . trim($_SERVER['PATH_INFO'], '/');
    return '/';
}

function request_body() {
    $type = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
    if (stripos($type, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') return array();
        $data = json_decode($raw, true);
        if (!is_array($data)) fail(400, '傳送的資料格式不正確');
        return $data;
    }
    return is_array($_POST) ? $_POST : array();
}

function query_param($name) {
    return isset($_GET[$name]) ? $_GET[$name] : null;
}

function b64url($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function jwt_sign($payload) {
    $payload['iat'] = time();
    $payload['exp'] = time() + 7 * 24 * 60 * 60;
    $header = b64url(json_encode(array('typ' => 'JWT', 'alg' => 'HS256')));
    $body = b64url(json_encode($payload));
    $sig = b64url(hash_hmac('sha256', $header . '.' . $body, config()['jwt_secret'], true));
    return $header . '.' . $body . '.' . $sig;
}

function jwt_read() {
    $header = '';
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) $header = $_SERVER['HTTP_AUTHORIZATION'];
    elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) $header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $match)) return null;
    $parts = explode('.', $match[1]);
    if (count($parts) !== 3) fail(401, '登入已過期，請重新登入');
    $expected = b64url(hash_hmac('sha256', $parts[0] . '.' . $parts[1], config()['jwt_secret'], true));
    if (!hash_equals($expected, $parts[2])) fail(401, '登入已過期，請重新登入');
    $json = base64_decode(strtr($parts[1], '-_', '+/'));
    $payload = json_decode($json, true);
    if (!is_array($payload) || empty($payload['exp']) || $payload['exp'] < time()) {
        fail(401, '登入已過期，請重新登入');
    }
    return $payload;
}

function hash_pw($password) {
    return password_hash($password, PASSWORD_BCRYPT, array('cost' => 10));
}

function verify_pw($password, $hash) {
    if (!is_string($hash) || !preg_match('/^\$2[aby]\$\d{2}\$[.\/A-Za-z0-9]{53}$/', $hash)) return false;
    return password_verify($password, $hash);
}

function required_text($value, $max, $label) {
    $text = trim((string) $value);
    if ($text === '') fail(400, '請填寫' . $label);
    if (mb_strlen($text, 'UTF-8') > $max) fail(400, $label . '請少於 ' . $max . ' 個字');
    return $text;
}

function optional_text($value, $max, $label) {
    $text = trim((string) $value);
    if (mb_strlen($text, 'UTF-8') > $max) fail(400, $label . '請少於 ' . $max . ' 個字');
    return $text;
}

function required_email($value) {
    $email = strtolower(trim((string) $value));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 120) fail(400, '請輸入有效的電子郵件');
    return $email;
}

function optional_phone($value) {
    $phone = trim((string) $value);
    if ($phone === '') return '';
    if (!preg_match('/^[0-9+\-()\s]{6,20}$/', $phone)) fail(400, '電話格式不正確');
    return $phone;
}

function required_phone($value) {
    $phone = optional_phone($value);
    if ($phone === '') fail(400, '請填寫電話');
    return $phone;
}

function required_int($value, $label, $min = 0, $max = 10000000) {
    if (!is_numeric($value) || (int) $value != $value) fail(400, $label . '格式不正確');
    $number = (int) $value;
    if ($number < $min || $number > $max) fail(400, $label . '格式不正確');
    return $number;
}

function optional_number($value, $label) {
    if ($value === '' || $value === null) return null;
    if (!is_numeric($value)) fail(400, $label . '格式不正確');
    $number = (float) $value;
    if ($number < 0 || $number > 10000) fail(400, $label . '格式不正確');
    return round($number, 2);
}

function id_param($value) {
    $id = required_int($value, '編號', 1, 1000000000);
    return $id;
}

function sanitize_plain($value, $max, $label, $required = false) {
    $text = str_replace("\0", '', (string) $value);
    $text = preg_replace('/<script[\s\S]*?<\/script>/i', '', $text);
    $text = preg_replace('/<style[\s\S]*?<\/style>/i', '', $text);
    $text = preg_replace('/<[^>]*>/', '', $text);
    $text = preg_replace('/javascript\s*:/i', '', $text);
    $text = preg_replace('/\son\w+\s*=/i', '', $text);
    $text = trim($text);
    if ($required && $text === '') fail(400, '請填寫' . $label);
    if (mb_strlen($text, 'UTF-8') > $max) fail(400, $label . '請少於 ' . $max . ' 個字');
    return $text;
}

function luhn_ok($digits) {
    $sum = 0;
    $alternate = false;
    for ($i = strlen($digits) - 1; $i >= 0; $i--) {
        $digit = (int) $digits[$i];
        if ($alternate) {
            $digit *= 2;
            if ($digit > 9) $digit -= 9;
        }
        $sum += $digit;
        $alternate = !$alternate;
    }
    return $sum % 10 === 0;
}

function assert_no_card($body) {
    $keys = array('cardnumber', 'cardno', 'pan', 'cvv', 'cvc', 'cvv2', 'securitycode', 'expiry', 'expire', 'expmonth', 'expyear', 'creditcard');
    foreach ($body as $key => $value) {
        $normalized = strtolower(preg_replace('/[^a-z0-9]/i', '', (string) $key));
        if (in_array($normalized, $keys, true)) fail(400, '本店不收集信用卡號或 CVV');
        if (is_string($value) && preg_match_all('/(?:\d[ -]?){13,19}/', $value, $groups)) {
            foreach ($groups[0] as $group) {
                $digits = preg_replace('/\D/', '', $group);
                $len = strlen($digits);
                if ($len >= 13 && $len <= 19 && luhn_ok($digits)) fail(400, '請勿在表單留下信用卡號');
            }
        }
    }
}

function write_audit($entry) {
    db_run(
        'INSERT INTO audit_logs (admin_id, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
        array(
            isset($entry['adminId']) ? $entry['adminId'] : null,
            $entry['action'],
            isset($entry['targetType']) ? $entry['targetType'] : null,
            isset($entry['targetId']) ? (string) $entry['targetId'] : null,
            !empty($entry['detail']) ? json_encode($entry['detail'], JSON_UNESCAPED_UNICODE) : null,
            isset($entry['ip']) ? $entry['ip'] : null
        )
    );
}

function image_set($slug) {
    $known = array('pearl-necklace', 'gold-diamond-ring', 'jade-bracelet', 'two-tone-studs', 'agate-bracelet');
    if (!in_array($slug, $known, true)) {
        return array(array('src' => '/images/products/generic.svg', 'label' => '商品圖'));
    }
    return array(
        array('src' => '/images/products/' . $slug . '-1.svg', 'label' => '正面'),
        array('src' => '/images/products/' . $slug . '-2.svg', 'label' => '細節'),
        array('src' => '/images/products/' . $slug . '-3.svg', 'label' => '側面')
    );
}

function json_list($text) {
    $data = json_decode((string) $text, true);
    return is_array($data) ? $data : array();
}

function map_category($row) {
    return array(
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'slug' => $row['slug'],
        'description' => $row['description'],
        'sortOrder' => (int) $row['sort_order'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at']
    );
}

function map_product($row) {
    $details = array();
    foreach (json_list(isset($row['detail_images']) ? $row['detail_images'] : '[]') as $src) {
        if ($src) $details[] = $src;
    }
    $fields = array();
    foreach (json_list(isset($row['extra_fields']) ? $row['extra_fields'] : '[]') as $item) {
        if (is_array($item) && !empty($item['label']) && !empty($item['value'])) {
            $fields[] = array('label' => (string) $item['label'], 'value' => (string) $item['value']);
        }
    }
    $images = array();
    if (!empty($row['main_image'])) $images[] = array('src' => $row['main_image'], 'label' => '主圖');
    foreach ($details as $index => $src) $images[] = array('src' => $src, 'label' => '細節 ' . ($index + 1));
    if (!$images) $images = image_set($row['slug']);
    $colors = array();
    foreach (explode('|', (string) (isset($row['colors']) ? $row['colors'] : '')) as $color) {
        $color = trim($color);
        if ($color !== '') $colors[] = $color;
    }
    return array(
        'id' => (int) $row['id'],
        'categoryId' => (int) $row['category_id'],
        'categoryName' => $row['category_name'],
        'categorySlug' => $row['category_slug'],
        'name' => $row['name'],
        'slug' => $row['slug'],
        'summary' => $row['summary'],
        'description' => $row['description'],
        'price' => (int) $row['price'],
        'material' => $row['material'],
        'weightGrams' => $row['weight_grams'] === null ? null : (float) $row['weight_grams'],
        'stock' => (int) $row['stock'],
        'colors' => $colors,
        'care' => isset($row['care']) ? $row['care'] : '',
        'mainImage' => isset($row['main_image']) ? $row['main_image'] : '',
        'detailImages' => $details,
        'extraFields' => $fields,
        'images' => $images,
        'isPublished' => (bool) $row['is_published'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at']
    );
}

function map_article($row) {
    $cover = isset($row['cover_image']) ? $row['cover_image'] : '';
    return array(
        'id' => (int) $row['id'],
        'title' => $row['title'],
        'slug' => $row['slug'],
        'summary' => $row['summary'],
        'content' => $row['content'],
        'isPublished' => (bool) $row['is_published'],
        'authorAdminId' => $row['author_admin_id'] === null ? null : (int) $row['author_admin_id'],
        'authorName' => !empty($row['author_name']) ? $row['author_name'] : '大仁哥的珠寶小舖',
        'coverImage' => $cover,
        'thumbnail' => $cover !== '' ? $cover : '/images/articles/' . $row['slug'] . '.svg',
        'publishedAt' => $row['published_at'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at']
    );
}

function map_member($row) {
    $email = (string) $row['email'];
    return array(
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'email' => substr($email, -14) === '@members.local' ? '' : $email,
        'phone' => isset($row['phone']) ? $row['phone'] : '',
        'lineId' => isset($row['line_id']) ? $row['line_id'] : '',
        'createdAt' => $row['created_at']
    );
}

function map_order($row) {
    return array(
        'id' => (int) $row['id'],
        'orderNo' => $row['order_no'],
        'memberId' => $row['member_id'] === null ? null : (int) $row['member_id'],
        'buyerName' => $row['buyer_name'],
        'buyerEmail' => $row['buyer_email'],
        'buyerPhone' => $row['buyer_phone'],
        'shippingAddress' => $row['shipping_address'],
        'cvsStoreId' => isset($row['cvs_store_id']) ? $row['cvs_store_id'] : '',
        'cvsStoreName' => isset($row['cvs_store_name']) ? $row['cvs_store_name'] : '',
        'cvsAddress' => isset($row['cvs_address']) ? $row['cvs_address'] : '',
        'logisticsSubType' => isset($row['logistics_subtype']) ? $row['logistics_subtype'] : '',
        'note' => $row['note'],
        'paymentMethod' => isset($row['payment_method']) ? $row['payment_method'] : '',
        'trackingNo' => isset($row['tracking_no']) ? $row['tracking_no'] : '',
        'status' => $row['status'],
        'subtotal' => (int) $row['subtotal'],
        'shippingFee' => (int) $row['shipping_fee'],
        'total' => (int) $row['total'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at']
    );
}

function map_full_order($row) {
    $items = db_all(
        'SELECT id, product_id, product_name, unit_price, quantity, line_total FROM order_items WHERE order_id = ? ORDER BY id',
        array($row['id'])
    );
    $mapped = array();
    foreach ($items as $item) {
        $mapped[] = array(
            'id' => (int) $item['id'],
            'productId' => $item['product_id'] === null ? null : (int) $item['product_id'],
            'productName' => $item['product_name'],
            'unitPrice' => (int) $item['unit_price'],
            'quantity' => (int) $item['quantity'],
            'lineTotal' => (int) $item['line_total']
        );
    }
    $order = map_order($row);
    $order['items'] = $mapped;
    return $order;
}

function map_banner($row) {
    return array(
        'id' => (int) $row['id'],
        'eyebrow' => $row['eyebrow'],
        'title' => $row['title'],
        'body' => $row['body'],
        'linkHref' => $row['link_href'],
        'linkLabel' => $row['link_label'],
        'image' => $row['image'],
        'altText' => $row['alt_text'],
        'imageWidth' => !empty($row['image_width']) ? (int) $row['image_width'] : 480,
        'imageHeight' => !empty($row['image_height']) ? (int) $row['image_height'] : 240,
        'sortOrder' => (int) $row['sort_order'],
        'isPublished' => (bool) $row['is_published']
    );
}

function map_audit($row) {
    return array(
        'id' => (int) $row['id'],
        'adminId' => $row['admin_id'] === null ? null : (int) $row['admin_id'],
        'adminName' => !empty($row['admin_name']) ? $row['admin_name'] : '系統',
        'username' => isset($row['username']) ? $row['username'] : '',
        'action' => $row['action'],
        'targetType' => $row['target_type'],
        'targetId' => $row['target_id'],
        'detail' => $row['detail'],
        'ipAddress' => $row['ip_address'],
        'createdAt' => $row['created_at']
    );
}

const PRODUCT_SELECT = 'p.id, p.category_id, c.name AS category_name, c.slug AS category_slug, p.name, p.slug, p.summary, p.description, p.price, p.material, p.weight_grams, p.stock, p.colors, p.care, p.main_image, p.detail_images, p.extra_fields, p.is_published, p.created_at, p.updated_at';
const ARTICLE_SELECT = 'a.id, a.title, a.slug, a.summary, a.content, a.cover_image, a.is_published, a.author_admin_id, admins.name AS author_name, a.published_at, a.created_at, a.updated_at';

function connect_db() {
    $c = config();
    if ($c['db_name'] === '請改成資料庫名稱' || $c['db_user'] === '請改成資料庫帳號') {
        fail(500, '請先修改 app/config.php 的資料庫名稱、帳號與密碼');
    }
    $dsn = 'mysql:host=' . $c['db_host'] . ';port=' . (int) $c['db_port'] . ';dbname=' . $c['db_name'] . ';charset=utf8mb4';
    try {
        $pdo = new PDO($dsn, $c['db_user'], $c['db_pass'], array(
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => true
        ));
    } catch (PDOException $error) {
        fail(500, db_problem_text($error));
    }
    try {
        $pdo->exec("SET time_zone = '+08:00'");
    } catch (PDOException $error) {
        // 部分主機未載入時區表，連線仍可使用。
    }
    return $pdo;
}

function db_problem_text($error) {
    $code = (isset($error->errorInfo) && isset($error->errorInfo[1])) ? (int) $error->errorInfo[1] : 0;
    $raw = $error->getMessage();
    if ($code === 1044 || $code === 1142) {
        return '資料庫帳號沒有權限。請到 cPanel 的「MySQL 資料庫」，把帳號加入這個資料庫，並勾選「所有權限」。';
    }
    if ($code === 1045) {
        return '資料庫帳號或密碼不正確，請核對 app/config.php。';
    }
    if ($code === 1049) {
        return '找不到這個資料庫。app/config.php 的資料庫名稱要和 phpMyAdmin 左側顯示的完整名稱相同。';
    }
    if ($code === 2002 || $code === 2003) {
        return '無法連上 MySQL。app/config.php 的 db_host 請填 localhost。';
    }
    return '資料庫發生錯誤：' . $raw;
}

function split_sql($sql) {
    $lines = preg_split('/\r\n|\r|\n/', $sql);
    $kept = array();
    foreach ($lines as $line) {
        if (preg_match('/^\s*--/', $line)) continue;
        $kept[] = $line;
    }
    $parts = preg_split('/;\s*(?:\r\n|\n|\r|$)/', implode("\n", $kept));
    $statements = array();
    foreach ($parts as $part) {
        $part = trim($part);
        if ($part !== '') $statements[] = $part;
    }
    return $statements;
}

function install_schema() {
    $sql = file_get_contents(dirname(__DIR__) . '/server/schema.sql');
    foreach (split_sql($sql) as $statement) db_exec($statement);
}

function ensure_db() {
    global $PDO;
    $PDO = connect_db();
    $ready = false;
    try {
        $row = db_one('SELECT `value` FROM schema_meta WHERE meta_key = ?', array('seeded_at'));
        $ready = $row && $row['value'] !== '';
    } catch (PDOException $error) {
        $ready = false;
    }
    if ($ready) return;
    try {
        install_schema();
        require_once __DIR__ . '/seed.php';
        seed_database();
    } catch (PDOException $error) {
        fail(500, db_problem_text($error));
    }
}
