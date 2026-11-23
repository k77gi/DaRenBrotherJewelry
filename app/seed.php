<?php

function permission_codes_for($modules) {
    $catalog = array(
        'products' => array('catalog.read', 'products.write', 'categories.write'),
        'articles' => array('articles.read', 'articles.write'),
        'orders' => array('orders.read', 'orders.write'),
        'members' => array('members.read'),
        'inquiries' => array('inquiries.read', 'inquiries.write'),
        'admins' => array('admins.read', 'admins.write', 'permissions.write'),
        'audit' => array('audit.read')
    );
    $selected = in_array('*', $modules, true) ? array_keys($catalog) : $modules;
    $codes = array();
    foreach ($selected as $module) {
        foreach ($catalog[$module] as $code) $codes[$code] = true;
    }
    return array_keys($codes);
}

function seed_database() {
    $permissions = array(
        array('catalog.read', '檢視商品分類', '可查看商品與分類'),
        array('products.write', '管理商品', '可新增、修改與刪除商品'),
        array('categories.write', '管理分類', '可新增商品分類'),
        array('articles.read', '檢視文章', '可查看小白教室文章'),
        array('articles.write', '管理文章', '可新增、修改與刪除文章'),
        array('orders.read', '檢視訂單', '可查看訂單與明細'),
        array('orders.write', '更新訂單', '可變更訂單狀態與物流單號'),
        array('members.read', '檢視會員', '可查看會員名單'),
        array('inquiries.read', '檢視聯絡訊息', '可查看與我聯絡的表單'),
        array('inquiries.write', '編輯聯絡訊息', '可修改與我聯絡的表單內容'),
        array('admins.read', '檢視管理員', '可查看管理員與角色'),
        array('admins.write', '管理管理員', '可新增、停用或啟用管理員'),
        array('permissions.write', '設定權限', '可勾選各角色可使用的模組'),
        array('audit.read', '檢視操作日誌', '可查看後台操作紀錄')
    );
    $roles = array(
        array('super_admin', '最大管理者', '可編輯任何資料，並可新增管理員與勾選分配權限', 1, array('*')),
        array('product_manager', '主要管理者', '可管理商品、文章與訂單，不可更改權限設定', 2, array('products', 'articles', 'orders', 'inquiries')),
        array('content_editor', '助理管理者', '只可管理小白教室文章', 3, array('articles'))
    );
    $accounts = array(
        array('大仁哥', 'daren', 'daren@shop.local', 'Daren#2026', 'super_admin'),
        array('主要管理者', 'merch', 'merch@shop.local', 'Merch#2026', 'product_manager'),
        array('助理管理者', 'editor', 'editor@shop.local', 'Editor#2026', 'content_editor')
    );
    $categories = array(
        array('項鍊', 'necklace', '珍珠與細鍊為主，適合日常佩戴。', 1),
        array('戒指', 'ring', '下單前請先量好戒圍，本店示範款為固定尺寸。', 2),
        array('手鍊', 'bracelet', '玉石與瑪瑙，選購時請對一下手圍。', 3),
        array('耳環', 'earring', '以貼耳、輕量的款式為主。', 4)
    );
    $products = array(
        array('necklace', '月光淡水珍珠項鍊', 'pearl-necklace', '圓潤白珍珠配細緻銀鏈，日常與聚餐都戴得住。', "這條項鍊以約 8 毫米的淡水珍珠為主體，光澤偏柔白，配上細銀鏈。鏈長約 42 公分，另附 5 公分延長鏈。\n\n珍珠會因皮膚油脂而更潤，平常用軟布擦拭即可。鏈身是 925 銀鍍金，請避免長時間碰水與香水。\n\n適合第一次買珍珠、想先戴看看的人。頁面上的庫存就是目前可售數量。", 6800, '淡水珍珠、925 銀鍍金', 12.6, 8, '柔白|淺粉', '用乾軟布擦去汗水與油脂即可。鏈身是鍍金銀鏈，請避免長時間碰水、游泳池與香水。收納時不要跟其他鍊子纏在一起。'),
        array('ring', '細金圓鑽戒指', 'gold-diamond-ring', '14K 金單鑽，戒身細、鑽石小而清楚。', "戒身約 1.5 毫米寬，鑽石約 0.05 克拉，四爪鑲法，側面看得到金的厚度，比較不容易勾到衣物。\n\n固定戒圍 11 號，內徑約 16.5 毫米。下單前請先量好常用戒圍，這個示範站不提供改圈。\n\n14K 金適合每天戴。洗手與做家事時建議取下。", 12800, '14K 黃金、圓形鑽石', 2.3, 4, '黃金色', '14K 金可用中性清潔劑輕刷後擦乾。洗手、做家事與運動時先取下。不要用牙膏磨，以免留下細痕。'),
        array('bracelet', '青玉平安扣手鍊', 'jade-bracelet', '小顆青玉平安扣，彈力繩可直接套上手腕。', "平安扣直徑約 15 毫米，顏色是淡青綠色，帶一點天然紋路。每顆紋路不會完全一樣。\n\n手圍以 14 到 16 公分為主。彈力繩戴久了會鬆，鬆了就不要再硬撐。\n\n玉石怕碰撞，收納時不要跟金屬鍊堆在一起。", 4200, '天然青玉、彈力繩', 16.8, 10, '淡青', '玉石怕碰撞，請分開收納。彈力繩沾到乳液或汗水後用乾布擦乾，變鬆就不要再硬戴。避免長時間暴曬。'),
        array('earring', '雙色金小圓耳釘', 'two-tone-studs', '黃金與白金交錯的小圓片，沒有垂墜，上班也好戴。', "耳釘直徑約 6 毫米，正面是黃白金相間的圓形。耳針為 14K 金，附矽膠耳迫。\n\n這款沒有鑲石，重量輕。剛打耳洞、還在恢復期的人不建議佩戴。對金屬過敏的人，請先確認自己能戴 14K 金。\n\n庫存 1 件代表一對。", 3600, '14K 雙色金', 1.6, 14, '黃白雙色', '耳釘可在卸下後用乾布擦過。剛打耳洞、尚在恢復期的人不建議佩戴。對金屬過敏時請先確認能配戴 14K 金。'),
        array('bracelet', '紅瑪瑙穩重手串', 'agate-bracelet', '顆粒清楚的紅瑪瑙，顏色穩，男女都能戴。', "珠子直徑約 10 毫米，中間夾小顆黃銅隔珠，手圍約 16 到 17 公分。\n\n瑪瑙硬度高，但仍建議避免摔到硬地。流汗後用乾布擦過再收進布袋。\n\n這是店裡單價最親民的一款，適合想先熟悉天然石的人。", 2680, '天然紅瑪瑙、黃銅隔珠', 32, 12, '赭紅', '瑪瑙硬度高，仍要避免摔到硬地。流汗後用乾布擦過再收進布袋，不要與香水、保養品一起存放。')
    );

    db()->beginTransaction();
    try {
        $permissionIds = array();
        foreach ($permissions as $item) {
            $info = db_run('INSERT INTO permissions (code, name, description) VALUES (?, ?, ?)', $item);
            $permissionIds[$item[0]] = $info['id'];
        }
        $roleIds = array();
        foreach ($roles as $role) {
            $info = db_run(
                'INSERT INTO roles (code, name, description, role_level) VALUES (?, ?, ?, ?)',
                array($role[0], $role[1], $role[2], $role[3])
            );
            $roleIds[$role[0]] = $info['id'];
            foreach (permission_codes_for($role[4]) as $code) {
                db_run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', array($info['id'], $permissionIds[$code]));
            }
        }
        $adminIds = array();
        foreach ($accounts as $account) {
            $info = db_run(
                'INSERT INTO admins (role_id, name, username, email, password_hash) VALUES (?, ?, ?, ?, ?)',
                array($roleIds[$account[4]], $account[0], $account[1], $account[2], hash_pw($account[3]))
            );
            $adminIds[$account[1]] = $info['id'];
        }
        $categoryIds = array();
        foreach ($categories as $category) {
            $info = db_run(
                'INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)',
                $category
            );
            $categoryIds[$category[1]] = $info['id'];
        }
        foreach ($products as $product) {
            db_run(
                'INSERT INTO products (category_id, name, slug, summary, description, price, material, weight_grams, stock, colors, care, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
                array($categoryIds[$product[0]], $product[1], $product[2], $product[3], $product[4], $product[5], $product[6], $product[7], $product[8], $product[9], $product[10])
            );
        }
        $now = timestamp();
        db_run(
            'INSERT INTO articles (title, slug, summary, content, is_published, author_admin_id, published_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
            array('第一次買珍珠，怎麼看光澤與大小', 'pearl-basics', '珍珠好不好看，先看光澤，再決定大小。這篇只講買第一條時用得到的判斷。', "很多第一次買珍珠的人，會先被「很大顆」吸引。其實珍珠好不好看，光澤通常比尺寸更重要。\n\n怎麼看光澤\n把珍珠放在自然光下，表面應該像水面一樣，能映出清楚的反光。反光模糊、看起來霧霧的，多半是光澤較弱。\n\n尺寸怎麼選\n日常項鍊常見約 7 到 9 毫米。小於 7 毫米較秀氣，大於 9 毫米存在感高，價格也會明顯上升。先決定穿搭場合，再決定大小。\n\n顏色\n白珍珠、粉珍珠、淺金珍珠都適合日常。選跟膚色接近、或略亮一階的顏色，通常最不容易出錯。\n\n本舖商品頁會標示材質與參考重量。收到後若要搭配正式場合，建議先在自然光下再看一次光澤。", $adminIds['daren'], $now)
        );
        db_run(
            'INSERT INTO articles (title, slug, summary, content, is_published, author_admin_id, published_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
            array('金飾日常保養：五個避免變色的習慣', 'gold-care', '金飾變暗，常常是清潔劑、汗水或保養品造成的。五個習慣就夠日常使用。', "金飾變暗，常常不是金本身壞掉，而是接觸到清潔劑、汗水或保養品。下面五個習慣就夠用。\n\n1. 化妝、噴香水之後再戴\n化學成分留在金屬表面，時間久了會讓顏色看起來髒髒的。\n\n2. 洗手、游泳、泡溫泉先取下\n氯氣和溫泉水對細鏈、電鍍層特別不友善。\n\n3. 分開收納\n跟其他飾品堆在一起，容易刮傷。軟布袋或獨立小盒就好。\n\n4. 用軟布擦，不要用牙膏\n牙膏的磨粉會留下細痕。平常乾布輕擦即可。\n\n5. 很髒再交給專業清洗\n自己可以用清水加中性清潔劑輕刷，但鑲石飾品不建議泡太久。\n\n14K 金比 24K 金硬，比較適合每天戴。純金較軟，要避免拉扯細鏈。", $adminIds['daren'], $now)
        );
        $banners = array(
            array('現貨飾品', '把日常戴得剛剛好', '珍珠、金飾與玉石，價格、材質和庫存都寫在商品頁。', '/shop.html', '進入珠寶小舖', '/images/banners/banner-1.svg', '珍珠項鍊', 1),
            array('小白教室', '第一次買，先看再決定', '珍珠怎麼看光澤，金飾怎麼保養，兩篇就夠入門。', '/blog.html', '去小白教室', '/images/banners/banner-2.svg', '金飾保養', 2),
            array('門市與配送', '滿 3,000 元免運', '未滿收取 80 元。也可以到大安區門市看看實品。', '/contact.html', '與我聯絡', '/images/banners/banner-3.svg', '門市', 3)
        );
        foreach ($banners as $banner) {
            db_run(
                'INSERT INTO banners (eyebrow, title, body, link_href, link_label, image, alt_text, sort_order, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
                $banner
            );
        }
        db_run("INSERT INTO schema_meta (meta_key, `value`) VALUES ('version', '1')");
        db_run("INSERT INTO schema_meta (meta_key, `value`) VALUES ('seeded_at', ?)", array($now));
        db_run("INSERT INTO schema_meta (meta_key, `value`) VALUES ('roles_v2', ?)", array($now));
        db_run("INSERT INTO schema_meta (meta_key, `value`) VALUES ('banners_seeded', ?)", array($now));
        db_run("INSERT INTO schema_meta (meta_key, `value`) VALUES ('inquiries_admin', ?)", array($now));
        db_run("INSERT INTO schema_meta (meta_key, `value`) VALUES ('banner_width_px', ?)", array($now));
        write_audit(array(
            'adminId' => $adminIds['daren'],
            'action' => 'system.seed',
            'targetType' => 'database',
            'targetId' => '1',
            'detail' => array('products' => count($products), 'articles' => 2, 'admins' => count($accounts)),
            'ip' => 'system'
        ));
        db()->commit();
    } catch (Exception $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
}
