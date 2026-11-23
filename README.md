# 大仁哥的珠寶小舖

本地可跑的珠寶購物網站。前台負責畫面，後台負責規則與資料，資料存在 MySQL。

介面是繁體中文，沒有動畫特效。金額以新台幣整數計算。

## 為什麼用這套架構

前台是 HTML、CSS、JavaScript。正式環境的後台是 PHP，資料庫用 MySQL。phpMyAdmin 用來建立資料庫與查看資料。

改一個頁面就改對應的 HTML 或 JS，改一張資料表就改 `server/schema.sql`。

前後台是分開的：

- `frontend/` 只畫畫面，透過 `/api` 讀寫資料。
- `server/` 檢查權限、計算金額、寫入 MySQL。
- 瀏覽器不能直接碰到資料庫。

為了少開一個終端機，Express 會一併把網頁檔送出去。資料夾仍然分開。

## 環境

正式網站放在遠振這類只有 PHP 與 MySQL 的空間，不使用 Node.js。

- PHP 7.4 或以上（需有 PDO MySQL 與 GD）
- MySQL 8 或 MariaDB 10.3 以上
- 網頁伺服器需能讀取網站根目錄的 `.htaccess`（Apache）或 `web.config`（IIS）

## 啟動

在 phpMyAdmin 建立空資料庫，修改 `app/config.php` 的資料庫名稱、帳號、密碼與 `jwt_secret`。不要先匯入資料表。

把整個專案上傳到網站根目錄（`www` 或 `public_html`），並確認 `.htaccess` 有一起上傳。用網域開啟首頁。第一次有人瀏覽商品時，程式會建立資料表並寫入測試資料。

上傳的商品圖會壓成寬度最多 1600px 的 WebP（主機沒有 WebP 時改存 JPEG），檔案放在 `uploads/`。

請用網站網址開啟，不要直接用瀏覽器打開 HTML 檔。直接開檔時，頁面連不到 `/api`。

## 預設帳號

管理員密碼只寫在測試資料裡，資料庫存的是雜湊。正式使用前請改掉。

| 角色 | 帳號 | 密碼 | 預設可使用的模組 |
| --- | --- | --- | --- |
| 最大管理者 | daren | Daren#2026 | 全部。可新增管理員，並用核取方塊分配權限 |
| 主要管理者 | merch | Merch#2026 | 商品管理、文章管理、訂單管理 |
| 助理管理者 | editor | Editor#2026 | 只有文章管理（小白教室） |

登入需要圖形驗證碼。同一個帳號連續錯誤 5 次會鎖定 15 分鐘。權限設定只開放給最大管理者；商品、訂單、會員與文章的 API 都會再檢查一次權限。

後台：[http://localhost:3000/admin/login.html](http://localhost:3000/admin/login.html)

會員沒有預設帳號。到「會員」頁自行註冊。密碼至少 8 個字元。會員與管理員密碼都用 bcrypt 加鹽雜湊後才寫入資料庫，不會存明文。

## 資安

- 資料庫查詢使用參數化語句。分類代號只接受英數與減號。
- 小白教室與聯絡表單會先去掉 HTML 標籤與 `javascript:`。前台顯示時再跳脫 `<`、`>` 與引號。
- 結帳與模擬付款不接受卡號、CVV 或到期日。訂單只記錄付款方式代碼（信用卡、ATM、LINE Pay）。
- 後台新增、修改、刪除都要帶管理員權杖，並檢查該角色有沒有對應權限。會員訂單查詢要帶會員權杖。

## 購物規則

- 滿 NT$ 3,000 免運，未滿收取 NT$ 80。
- 結帳時由伺服器重算價格，不採用瀏覽器傳來的金額。
- 訂單先建立為待處理。模擬付款成功後才把狀態改為已付款，並扣除庫存。
- 取消已付款、已出貨或已完成的訂單會把庫存加回。
- 沒有串接真實信用卡或物流。後台可填寫物流單號，前台訂單頁會顯示。

## 目錄

```text
frontend/           前台與後台畫面
  index.html        首頁
  products.html     商品列表
  product.html      商品頁
  articles.html     小白教室列表
  article.html      文章頁
  cart.html         購物車（內容暫存在瀏覽器）
  checkout.html     結帳
  account.html      會員註冊、登入、訂單
  order.html        用訂單編號與電子郵件查訂單
  admin/            管理登入與後台
  css/              樣式
  js/common.js      全站共用：API、購物車、金額格式
server/
  index.js          網站入口
  schema.sql        資料表
  seed.js           測試資料
  routes/           /api 路由
  middleware/auth.js  會員與管理員登入檢查
data/uploads/       上傳並壓縮後的商品圖，不放進版控
```

`frontend/js/common.js` 要先載入。裡面的函式是全域函式，頁面腳本可以直接呼叫，所以不必先學模組打包。

## 資料表

定義在 `server/schema.sql`。關聯是：

- 分類 1 對多商品
- 訂單 1 對多訂單明細；明細保留下單當下的商品名稱與單價
- 會員 1 對多訂單；沒登入的訂單，`member_id` 是空的
- 角色多對多權限，管理員屬於一個角色
- 文章作者指向管理員
- 稽核日誌記錄後台登入與資料異動；管理員被刪除時，日誌仍保留

| 資料表 | 用途 | 主要欄位 |
| --- | --- | --- |
| categories | 商品分類 | name、slug、description、sort_order |
| products | 商品 | category_id、name、price、material、weight_grams、stock、is_published |
| articles | 小白教室 | title、summary、content、is_published、author_admin_id、published_at |
| members | 會員 | name、email、password_hash、phone |
| orders | 訂單 | order_no、member_id、收件資料、status、subtotal、shipping_fee、total |
| order_items | 訂單明細 | order_id、product_id、product_name、unit_price、quantity、line_total |
| roles | 角色 | code、name、role_level |
| permissions | 權限 | code、name、description |
| role_permissions | 角色擁有的權限 | role_id、permission_id |
| admins | 管理員 | role_id、name、username、email、password_hash、is_active |
| audit_logs | 操作稽核 | admin_id、action、target_type、target_id、detail、ip_address、created_at |
| schema_meta | 是否已灌測試資料 | key、value |

訂單狀態：`pending` 待處理、`paid` 已付款、`shipped` 已出貨、`completed` 已完成、`cancelled` 已取消。

`total` 必須等於 `subtotal + shipping_fee`。明細的 `line_total` 必須等於 `unit_price * quantity`。

## 測試資料

第一次啟動會寫入：

- 4 個分類：項鍊、戒指、手鍊、耳環
- 5 件商品：月光淡水珍珠項鍊、細金圓鑽戒指、青玉平安扣手鍊、雙色金小圓耳釘、紅瑪瑙穩重手串
- 2 篇文章：第一次買珍珠、金飾日常保養
- 3 個管理員，權限如上表
- 1 筆「建立測試資料」的稽核日誌

## 重設資料庫

測試資料只在資料庫還沒建立時寫入。要恢復成最初狀態：

1. 先停下 `npm start`
2. 執行 `npm run reset`
3. 再執行 `npm start`

`npm run reset` 只刪除這個專案的資料表，不會刪掉整個 MySQL。

## 連接埠與密鑰

複製 `.env.example` 為 `.env` 可改連接埠、JWT 密鑰與 MySQL 連線：

```text
PORT=3000
JWT_SECRET=please-change-this-secret
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=daren_jewelry
```

沒有 `.env` 時使用連接埠 3000、本機 root、資料庫 `daren_jewelry`，以及只適合本機的預設密鑰。cPanel 上的資料庫名稱通常會加上帳號前綴，請填 phpMyAdmin 左側看到的完整名稱。

## API 一覽

前台：

- `GET /api/shop`、`/api/categories`、`/api/products`、`/api/products/:id`
- `GET /api/articles`、`/api/articles/:id`
- `POST /api/members/register`、`/api/members/login`
- `GET /api/members/me`、`/api/members/orders`（需會員登入）
- `POST /api/orders` 建立訂單
- `POST /api/orders/lookup` 用訂單編號與電子郵件查訂單

後台都在 `/api/admin`，除了登入以外都要帶管理員權杖，並依權限拒絕不夠格的操作。回應不會包含密碼雜湊。
