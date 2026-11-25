const ACTION_LABEL = {
  'admin.login': '登入後台',
  'admin.login_failed': '登入失敗',
  'system.seed': '建立測試資料',
  'product.create': '新增商品',
  'product.update': '修改商品',
  'product.delete': '刪除商品',
  'category.create': '新增分類',
  'article.create': '新增文章',
  'article.update': '修改文章',
  'article.delete': '刪除文章',
  'banner.create': '新增主視覺',
  'banner.update': '修改主視覺',
  'banner.delete': '刪除主視覺',
  'inquiry.update': '修改聯絡訊息',
  'inquiry.delete': '刪除聯絡訊息',
  'order.status': '更新訂單狀態',
  'order.tracking': '更新物流單號',
  'order.quantity': '修改訂單數量',
  'order.delete': '刪除訂單',
  'member.update': '修改會員',
  'member.delete': '刪除會員',
  'payment.settings': '更新付款方式',
  'admin.status': '變更管理員狀態',
  'admin.create': '新增管理員',
  'admin.update': '修改管理員',
  'admin.delete': '刪除管理員',
  'role.permissions': '調整角色權限'
};

const state = {
  me: null,
  products: [],
  categories: [],
  articles: [],
  productDraft: null,
  articleDraft: null,
  bannerDraft: null,
  banners: [],
  inquiryDraft: null,
  inquiryQuery: '',
  admins: [],
  adminDraft: null,
  orders: [],
  members: [],
  memberDraft: null
};

const PANELS = [
  { id: 'overview', label: '總覽', allow: () => true },
  { id: 'banners', label: '主視覺', allow: () => can('products.write') },
  { id: 'products', label: '商品管理', allow: () => can('catalog.read') || can('products.write') },
  { id: 'categories', label: '分類', allow: () => can('categories.write') },
  { id: 'articles', label: '文章管理', allow: () => can('articles.read') || can('articles.write') },
  { id: 'orders', label: '訂單管理', allow: () => can('orders.read') },
  { id: 'payment', label: '付款方式', allow: () => can('orders.write') },
  { id: 'members', label: '會員管理', allow: () => can('members.read') },
  { id: 'inquiries', label: '聯絡訊息', allow: () => can('inquiries.read') || can('inquiries.write') },
  { id: 'admins', label: '管理員', allow: () => can('admins.read') },
  { id: 'permissions', label: '權限設定', allow: () => can('permissions.write') },
  { id: 'audit', label: '操作日誌', allow: () => can('audit.read') }
];

function can(code) {
  return state.me.permissions.some((item) => item.code === code);
}

function currentPanel() {
  const id = location.hash.replace('#', '') || 'overview';
  const panel = PANELS.find((item) => item.id === id);
  if (!panel || !panel.allow()) return 'overview';
  return panel.id;
}

function setAlert(error) {
  const box = document.getElementById('admin-alert');
  box.hidden = false;
  box.textContent = readableError(error);
}

function clearAlert() {
  const box = document.getElementById('admin-alert');
  box.hidden = true;
  box.textContent = '';
}

function renderNav() {
  const current = currentPanel();
  document.getElementById('admin-nav').innerHTML = PANELS.filter((item) => item.allow()).map((item) => `
    <a href="#${item.id}" class="${item.id === current ? 'is-active' : ''}">${item.label}</a>
  `).join('');
}

async function render() {
  clearAlert();
  renderNav();
  const panel = document.getElementById('panel');
  panel.innerHTML = '<p class="muted">載入中…</p>';
  try {
    const id = currentPanel();
    if (id === 'overview') await renderOverview();
    if (id === 'banners') await renderBanners();
    if (id === 'products') await renderProducts();
    if (id === 'categories') await renderCategories();
    if (id === 'articles') await renderArticles();
    if (id === 'orders') await renderOrders();
    if (id === 'payment') await renderPayment();
    if (id === 'members') await renderMembers();
    if (id === 'inquiries') await renderInquiries();
    if (id === 'admins') await renderAdmins();
    if (id === 'permissions') await renderPermissions();
    if (id === 'audit') await renderAudit();
  } catch (error) {
    panel.innerHTML = '';
    setAlert(error);
  }
}

async function renderOverview() {
  const permissions = state.me.permissions.map((item) => `
    <li>${esc(item.name)}<span class="muted">　${esc(item.description)}</span></li>
  `).join('');
  document.getElementById('panel').innerHTML = `
    <h1>總覽</h1>
    <p>目前登入：<strong>${esc(state.me.name)}</strong>（${esc(state.me.role.name)}）</p>
    <p class="muted">角色等級 ${state.me.role.level}。數字越小，可以管理的範圍越大。</p>
    <h2>可使用的權限</h2>
    <ul>${permissions}</ul>
    <div id="stats" class="stats"></div>
  `;
  const stats = await api('/admin/summary', { auth: 'admin' });
  const cards = [];
  if (stats.productCount != null) cards.push(['商品', stats.productCount]);
  if (stats.articleCount != null) cards.push(['文章', stats.articleCount]);
  if (stats.orderCount != null) cards.push(['訂單', stats.orderCount]);
  if (stats.pendingOrderCount != null) cards.push(['待處理訂單', stats.pendingOrderCount]);
  if (stats.memberCount != null) cards.push(['會員', stats.memberCount]);
  if (stats.inquiryCount != null) cards.push(['聯絡訊息', stats.inquiryCount]);
  const box = document.getElementById('stats');
  if (box) {
    box.innerHTML = cards.map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${esc(label)}</span></div>`).join('');
  }
}

function bannerForm() {
  const draft = state.bannerDraft;
  return `
    <form id="banner-form" class="panel">
      <h2>${draft ? '修改主視覺' : '新增主視覺'}</h2>
      <input type="hidden" name="bannerId" value="${draft ? draft.id : ''}">
      <div class="form-grid">
        <label class="field">小標<input name="eyebrow" maxlength="40" value="${draft ? esc(draft.eyebrow) : ''}"></label>
        <label class="field">標題<input name="title" required maxlength="80" value="${draft ? esc(draft.title) : ''}"></label>
        <label class="field">按鈕文字<input name="linkLabel" required maxlength="20" value="${draft ? esc(draft.linkLabel) : '查看'}"></label>
        <label class="field">按鈕連結<input name="linkHref" required maxlength="120" value="${draft ? esc(draft.linkHref) : '/shop.html'}"></label>
        <label class="field">排序<input name="sortOrder" type="number" min="0" max="999" required value="${draft ? draft.sortOrder : state.banners.length + 1}"></label>
        <label class="field">圖片寬度（px）<input name="imageWidth" type="number" min="80" max="1600" required value="${draft ? draft.imageWidth : 480}"></label>
        <label class="field">圖片高度（px）<input name="imageHeight" type="number" min="80" max="480" required value="${draft ? draft.imageHeight : 240}"></label>
        <label class="field wide">說明<input name="body" maxlength="200" value="${draft ? esc(draft.body) : ''}"></label>
        <label class="field wide">圖片說明<input name="altText" maxlength="80" value="${draft ? esc(draft.altText) : ''}"></label>
        <label class="field wide">圖片<input data-add-image="#banner-images" data-input-name="image" data-single="1" type="file" accept="image/jpeg,image/png,image/gif,image/webp"></label>
      </div>
      <div id="banner-images" class="preview-row">${draft && draft.image ? imageCard(draft.image, 'image') : ''}</div>
      <p class="muted">連結請填本站路徑，例如 /shop.html。數字越小越靠前。</p>
      <label class="check"><input type="checkbox" name="isPublished" ${!draft || draft.isPublished ? 'checked' : ''}> 顯示在首頁</label>
      <div class="btn-row">
        <button class="btn" type="submit">${draft ? '儲存修改' : '新增主視覺'}</button>
        ${draft ? '<button class="btn secondary" type="button" data-action="cancel-banner">取消</button>' : ''}
      </div>
    </form>
  `;
}

function paintBanners() {
  const rows = state.banners.map((banner) => `
    <tr>
      <td>${banner.sortOrder}</td>
      <td>${esc(banner.title)}</td>
      <td>${esc(banner.linkHref)}</td>
      <td>${banner.isPublished ? '顯示' : '隱藏'}</td>
      <td>
        <button class="btn secondary" type="button" data-action="edit-banner" data-id="${banner.id}">編輯</button>
        <button class="btn danger" type="button" data-action="delete-banner" data-id="${banner.id}" data-name="${esc(banner.title)}">刪除</button>
      </td>
    </tr>
  `).join('');
  document.getElementById('panel').innerHTML = `
    <h1>主視覺</h1>
    <p class="muted">首頁輪播會依排序顯示已勾選的項目，約每 5 秒換一張。每張圖片都可以修改或刪除，寬度與高度以像素計算。</p>
    ${bannerForm()}
    <div class="table-wrap">
      <table>
        <thead><tr><th>排序</th><th>標題</th><th>連結</th><th>狀態</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">還沒有主視覺。</td></tr>'}</tbody>
      </table>
    </div>
  `;
  bindImagePickers(document.getElementById('panel'));
}

async function renderBanners() {
  state.banners = await api('/admin/banners', { auth: 'admin' });
  paintBanners();
}

function productForm() {
  if (!can('products.write')) return '';
  const draft = state.productDraft;
  const options = state.categories.map((category) => `
    <option value="${category.id}" ${draft && draft.categoryId === category.id ? 'selected' : ''}>${esc(category.name)}</option>
  `).join('');
  return `
    <form id="product-form" class="panel">
      <h2>${draft ? '修改商品' : '新增商品'}</h2>
      <input type="hidden" name="productId" value="${draft ? draft.id : ''}">
      <div class="form-grid">
        <label class="field">分類<select name="categoryId" required>${options}</select></label>
        <label class="field">商品名稱<input name="name" required maxlength="80" value="${draft ? esc(draft.name) : ''}"></label>
        <label class="field">價格（新台幣）<input name="price" type="number" min="0" step="1" required value="${draft ? draft.price : ''}"></label>
        <label class="field">庫存<input name="stock" type="number" min="0" step="1" required value="${draft ? draft.stock : ''}"></label>
        <label class="field">顏色<input name="colors" maxlength="80" placeholder="柔白、淺粉" value="${draft ? esc(draft.colors.join('、')) : ''}"></label>
        <label class="field">材質<input name="material" maxlength="80" value="${draft ? esc(draft.material) : ''}"></label>
        <label class="field">重量（公克，可空白）<input name="weightGrams" type="number" min="0" step="0.1" value="${draft && draft.weightGrams != null ? esc(draft.weightGrams) : ''}"></label>
        <label class="field wide">品牌簡介<input name="summary" maxlength="200" value="${draft ? esc(draft.summary) : ''}"></label>
        <label class="field wide">商品說明<textarea name="description">${draft ? esc(draft.description) : ''}</textarea></label>
        <label class="field wide">保養說明<textarea name="care">${draft ? esc(draft.care) : ''}</textarea></label>
        <label class="field wide">主圖<input data-add-image="#main-images" data-input-name="mainImage" data-single="1" type="file" accept="image/jpeg,image/png,image/gif,image/webp"></label>
        <label class="field wide">細節附圖（可多選）<input data-add-image="#detail-images" data-input-name="detailImage" type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple></label>
      </div>
      <div id="main-images" class="preview-row">${draft && draft.mainImage ? imageCard(draft.mainImage, 'mainImage') : ''}</div>
      <div id="detail-images" class="preview-row">${draft && draft.detailImages.length ? draft.detailImages.map((src) => imageCard(src, 'detailImage')).join('') : ''}</div>
      <div class="wide">
        <h3>自訂欄位</h3>
        <p class="muted">可自行新增項目，例如產地、尺寸或克拉。儲存後會顯示在商品頁。</p>
        <div id="extra-fields">${draft && draft.extraFields ? draft.extraFields.map((field) => fieldRow(field)).join('') : ''}</div>
        <button class="btn secondary" type="button" data-action="add-field">新增欄位</button>
      </div>
      <label class="check"><input type="checkbox" name="isPublished" ${!draft || draft.isPublished ? 'checked' : ''}> 上架，前台看得到</label>
      <div class="btn-row">
        <button class="btn" type="submit">${draft ? '儲存修改' : '新增商品'}</button>
        ${draft ? '<button class="btn secondary" type="button" data-action="cancel-product">取消</button>' : ''}
      </div>
    </form>
  `;
}

function paintProducts() {
  const rows = state.products.map((product) => `
    <tr>
      <td>${esc(product.name)}</td>
      <td>${esc(product.categoryName)}</td>
      <td>${money(product.price)}</td>
      <td>${product.stock}</td>
      <td>${product.isPublished ? '上架' : '下架'}</td>
      <td>
        ${can('products.write') ? `
          <button class="btn secondary" type="button" data-action="edit-product" data-id="${product.id}">編輯</button>
          <button class="btn danger" type="button" data-action="delete-product" data-id="${product.id}" data-name="${esc(product.name)}">刪除</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
  document.getElementById('panel').innerHTML = `
    <h1>商品管理</h1>
    ${productForm()}
    <div class="table-wrap">
      <table>
        <thead><tr><th>名稱</th><th>分類</th><th>價格</th><th>庫存</th><th>狀態</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  bindImagePickers(document.getElementById('panel'));
}

async function renderProducts() {
  const [products, categories] = await Promise.all([
    api('/admin/products', { auth: 'admin' }),
    api('/categories')
  ]);
  state.products = products;
  state.categories = categories;
  paintProducts();
}

async function renderCategories() {
  const categories = await api('/categories');
  state.categories = categories;
  const rows = categories.map((category) => `
    <tr>
      <td>${esc(category.name)}</td>
      <td>${esc(category.slug)}</td>
      <td>${esc(category.description)}</td>
    </tr>
  `).join('');
  document.getElementById('panel').innerHTML = `
    <h1>分類</h1>
    ${can('categories.write') ? `
      <form id="category-form" class="panel">
        <h2>新增分類</h2>
        <label class="field">名稱<input name="name" required maxlength="40"></label>
        <label class="field">說明<input name="description" maxlength="200"></label>
        <button class="btn" type="submit">新增分類</button>
      </form>
    ` : ''}
    <div class="table-wrap">
      <table>
        <thead><tr><th>名稱</th><th>代號</th><th>說明</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function todayValue() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function articleForm() {
  if (!can('articles.write')) return '';
  const draft = state.articleDraft;
  const published = draft && draft.publishedAt ? String(draft.publishedAt).slice(0, 10) : todayValue();
  return `
    <form id="article-form" class="panel">
      <h2>${draft ? '修改文章' : '新增文章'}</h2>
      <input type="hidden" name="articleId" value="${draft ? draft.id : ''}">
      <label class="field">標題<input name="title" required maxlength="120" value="${draft ? esc(draft.title) : ''}"></label>
      <label class="field">摘要<input name="summary" maxlength="200" value="${draft ? esc(draft.summary) : ''}"></label>
      <label class="field">內文<textarea name="content" required>${draft ? esc(draft.content) : ''}</textarea></label>
      <p class="muted">段落之間空一行。前台會依空行分段。</p>
      <label class="field">發布日期<input name="publishedAt" type="date" required value="${esc(published)}"></label>
      <label class="field">封面影像<input data-add-image="#cover-images" data-input-name="coverImage" data-single="1" type="file" accept="image/jpeg,image/png,image/gif,image/webp"></label>
      <div id="cover-images" class="preview-row">${draft && draft.coverImage ? imageCard(draft.coverImage, 'coverImage') : ''}</div>
      <label class="check"><input type="checkbox" name="isPublished" ${!draft || draft.isPublished ? 'checked' : ''}> 發佈到前台</label>
      <div class="btn-row">
        <button class="btn" type="submit">${draft ? '儲存修改' : '新增文章'}</button>
        ${draft ? '<button class="btn secondary" type="button" data-action="cancel-article">取消</button>' : ''}
      </div>
    </form>
  `;
}

function paintArticles() {
  const rows = state.articles.map((article) => `
    <tr>
        <td>${esc(article.title)}</td>
        <td>${article.isPublished ? '已發佈' : '未發佈'}</td>
        <td>${esc(String(article.publishedAt || '').slice(0, 10))}</td>
      <td>
        ${can('articles.write') ? `
          <button class="btn secondary" type="button" data-action="edit-article" data-id="${article.id}">編輯</button>
          <button class="btn danger" type="button" data-action="delete-article" data-id="${article.id}" data-name="${esc(article.title)}">刪除</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
  document.getElementById('panel').innerHTML = `
    <h1>文章管理</h1>
    ${articleForm()}
    <div class="table-wrap">
      <table>
        <thead><tr><th>標題</th><th>狀態</th><th>發布日期</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  bindImagePickers(document.getElementById('panel'));
}

async function renderArticles() {
  state.articles = await api('/admin/articles', { auth: 'admin' });
  paintArticles();
}

function selectedOrderIds() {
  return [...document.querySelectorAll('.order-check:checked')].map((box) => Number(box.value));
}

function openOrderQtyEditor() {
  const ids = selectedOrderIds();
  const editor = document.getElementById('order-editor');
  if (!ids.length) {
    setAlert(new Error('請先勾選要修改數量的訂單'));
    return;
  }
  clearAlert();
  const orders = state.orders.filter((order) => ids.includes(order.id));
  const blocks = orders.map((order) => `
    <fieldset class="order-qty-block">
      <legend>${esc(order.orderNo)}</legend>
      ${order.items.length ? order.items.map((item) => `
        <label class="field">${esc(item.productName)}
          <input class="qty" type="number" min="1" max="99" required data-item="${item.id}" value="${item.quantity}">
        </label>
      `).join('') : '<p class="muted">這筆訂單沒有明細。</p>'}
    </fieldset>
  `).join('');
  editor.innerHTML = `
    <form id="order-qty-form" class="panel">
      <h2>修改數量</h2>
      <p class="muted">數量至少 1。已付款、已出貨或已完成的訂單會同步增減庫存。</p>
      ${blocks}
      <div class="btn-row">
        <button class="btn" type="submit">儲存數量</button>
        <button class="btn secondary" type="button" data-action="cancel-order-qty">取消</button>
      </div>
    </form>
  `;
}

async function renderOrders() {
  state.orders = await api('/admin/orders', { auth: 'admin' });
  const writable = can('orders.write');
  const rows = state.orders.map((order) => {
    const items = order.items.map((item) => `${esc(item.productName)} × ${item.quantity}`).join('、');
    const status = writable
      ? `<select data-action="order-status" data-id="${order.id}">
          ${Object.keys(ORDER_STATUS).map((code) => `<option value="${code}" ${order.status === code ? 'selected' : ''}>${ORDER_STATUS[code]}</option>`).join('')}
        </select>`
      : esc(statusLabel(order.status));
    const pay = order.status === 'pending' ? '未付款' : (order.status === 'cancelled' ? '已取消' : '已付款');
    const tracking = writable
      ? `<input data-tracking="${order.id}" value="${esc(order.trackingNo || '')}" maxlength="40" aria-label="物流單號">
         <button class="btn secondary" type="button" data-action="save-tracking" data-id="${order.id}">儲存</button>`
      : esc(order.trackingNo || '—');
    return `
      <tr>
        ${writable ? `<td><input class="order-check" type="checkbox" value="${order.id}" aria-label="選取 ${esc(order.orderNo)}"></td>` : ''}
        <td>${esc(order.orderNo)}<br><span class="muted">${esc(order.createdAt)}</span></td>
        <td>${esc(order.buyerName)}<br><span class="muted">${esc(order.buyerPhone)}</span><br>${order.cvsStoreId
          ? `門市代號 ${esc(order.cvsStoreId)}<br>${esc(order.cvsStoreName)}<br>${esc(order.cvsAddress)}`
          : esc(order.shippingAddress)}</td>
        <td>${money(order.total)}</td>
        <td>${pay}<br><span class="muted">${esc(order.paymentMethod ? paymentLabel(order.paymentMethod) : '尚未選擇')}</span></td>
        <td>${status}</td>
        <td>${tracking}</td>
        <td>${items || '—'}</td>
      </tr>
    `;
  }).join('');
  document.getElementById('panel').innerHTML = `
    <h1>訂單管理</h1>
    <p class="muted">開啟線上金流時，模擬付款成功會變成已付款並扣除庫存。關閉線上金流時，顧客改看匯款資訊；確認入帳後，請把訂單狀態改成已付款。物流單號可另外填寫，不會連到真實物流。勾選訂單後可以修改明細數量，或刪除所選訂單。</p>
    ${writable ? `
      <div class="btn-row">
        <button class="btn secondary" type="button" data-action="edit-order-qty">修改數量</button>
        <button class="btn danger" type="button" data-action="delete-orders">刪除所選</button>
      </div>
      <div id="order-editor"></div>
    ` : ''}
    <div class="table-wrap">
      <table>
        <thead><tr>
          ${writable ? '<th><input id="order-select-all" type="checkbox" aria-label="全選訂單"></th>' : ''}
          <th>訂單</th><th>收件</th><th>合計</th><th>付款狀態</th><th>訂單狀態</th><th>物流單號</th><th>明細</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="${writable ? 8 : 7}">還沒有訂單。</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

async function renderPayment(saved) {
  const payment = await api('/admin/payment-settings', { auth: 'admin' });
  document.getElementById('panel').innerHTML = `
    <h1>付款方式</h1>
    ${saved ? '<p class="alert ok">付款方式已儲存。</p>' : ''}
    <p class="muted">開啟線上金流時，結帳會進入信用卡、ATM 虛擬帳號與 LINE Pay 的模擬付款頁。關閉後，宅配與超商取貨都會改為顯示右側的匯款資訊。正式金流串接會接在模擬付款頁之後。</p>
    <form id="payment-form" class="panel">
      <label class="check"><input type="checkbox" name="online" ${payment.online ? 'checked' : ''}> 開啟線上金流</label>
      <label class="field">銀行名稱（可空白）<input name="bankName" maxlength="40" value="${esc(payment.bankName || '')}"></label>
      <label class="field">收款戶名<input name="payeeName" maxlength="40" value="${esc(payment.payeeName || '')}"></label>
      <label class="field">收款帳號<input name="payeeAccount" maxlength="30" inputmode="numeric" value="${esc(payment.payeeAccount || '')}" placeholder="僅數字或連字號"></label>
      <button class="btn" type="submit">儲存付款方式</button>
    </form>
  `;
}

async function savePayment(form) {
  await api('/admin/payment-settings', {
    method: 'PUT',
    auth: 'admin',
    body: {
      online: form.online.checked,
      bankName: form.bankName.value,
      payeeName: form.payeeName.value,
      payeeAccount: form.payeeAccount.value
    }
  });
  await renderPayment(true);
}

function selectedMemberIds() {
  return [...document.querySelectorAll('.member-check:checked')].map((box) => Number(box.value));
}

function memberForm() {
  const draft = state.memberDraft;
  if (!draft) return '';
  return `
    <form id="member-form" class="panel">
      <h2>編輯會員</h2>
      <input type="hidden" name="memberId" value="${draft.id}">
      <div class="form-grid">
        <label class="field">姓名<input name="name" required maxlength="40" value="${esc(draft.name)}"></label>
        <label class="field">電子郵件<input name="email" type="email" maxlength="120" value="${esc(draft.email || '')}"></label>
        <label class="field">電話<input name="phone" maxlength="20" value="${esc(draft.phone || '')}"></label>
        <label class="field">LINE ID<input name="lineId" maxlength="20" value="${esc(draft.lineId || '')}"></label>
        <label class="field wide">新密碼（可空白）<input name="password" type="password" minlength="8" maxlength="72" autocomplete="new-password"></label>
      </div>
      <p class="muted">密碼留白就不會變更。沒有電子郵件的會員可以保持空白。</p>
      <div class="btn-row">
        <button class="btn" type="submit">儲存會員</button>
        <button class="btn secondary" type="button" data-action="cancel-member">取消</button>
      </div>
    </form>
  `;
}

async function renderMembers() {
  state.members = await api('/admin/members', { auth: 'admin' });
  if (state.memberDraft) {
    state.memberDraft = state.members.find((item) => item.id === state.memberDraft.id) || null;
  }
  const rows = state.members.map((member) => `
    <tr>
      <td><input class="member-check" type="checkbox" value="${member.id}" aria-label="選取 ${esc(member.name)}"></td>
      <td>${esc(member.name)}</td>
      <td>${esc(member.email || '—')}</td>
      <td>${esc(member.phone || '—')}</td>
      <td>${esc(member.lineId || '—')}</td>
      <td>${esc(member.createdAt)}</td>
      <td>
        <button class="btn secondary" type="button" data-action="edit-member" data-id="${member.id}">編輯</button>
        <button class="btn danger" type="button" data-action="delete-member" data-id="${member.id}" data-name="${esc(member.name)}">刪除</button>
      </td>
    </tr>
  `).join('');
  document.getElementById('panel').innerHTML = `
    <h1>會員管理</h1>
    <p class="muted">可編輯單筆會員。勾選一筆或多筆後，可以一次刪除。刪除後訂單仍保留，只是不再標示這位會員。</p>
    <div class="btn-row">
      <button class="btn danger" type="button" data-action="delete-members">刪除所選</button>
    </div>
    ${memberForm()}
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th><input id="member-select-all" type="checkbox" aria-label="全選會員"></th>
          <th>姓名</th><th>電子郵件</th><th>電話</th><th>LINE ID</th><th>註冊時間</th><th></th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="7">還沒有會員。</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function inquiryForm() {
  const draft = state.inquiryDraft;
  if (!draft || !can('inquiries.write')) return '';
  return `
    <form id="inquiry-form" class="panel">
      <h2>修改聯絡訊息</h2>
      <input type="hidden" name="inquiryId" value="${draft.id}">
      <p class="muted">收到時間 ${esc(draft.createdAt)}</p>
      <div class="form-grid">
        <label class="field">姓名<input name="name" required maxlength="40" value="${esc(draft.name)}"></label>
        <label class="field">聯絡電話<input name="phone" required maxlength="20" value="${esc(draft.phone)}"></label>
        <label class="field">Email<input name="email" type="email" required maxlength="120" value="${esc(draft.email)}"></label>
        <label class="field wide">諮詢內容<textarea name="message" required maxlength="1000">${esc(draft.message)}</textarea></label>
      </div>
      <div class="btn-row">
        <button class="btn" type="submit">儲存修改</button>
        <button class="btn secondary" type="button" data-action="cancel-inquiry">取消</button>
      </div>
    </form>
  `;
}

function selectedInquiryIds() {
  return [...document.querySelectorAll('.inquiry-check:checked')].map((box) => Number(box.value));
}

function paintInquiries() {
  const writable = can('inquiries.write');
  const rows = state.inquiries.map((item) => `
    <tr>
      ${writable ? `<td><input class="inquiry-check" type="checkbox" value="${item.id}" aria-label="選取 ${esc(item.name)}"></td>` : ''}
      <td>${esc(item.createdAt)}</td>
      <td>${esc(item.name)}</td>
      <td>${esc(item.phone)}</td>
      <td>${esc(item.email)}</td>
      <td>${esc(item.message)}</td>
      <td>${writable ? `<button class="btn secondary" type="button" data-action="edit-inquiry" data-id="${item.id}">編輯</button> <button class="btn danger" type="button" data-action="delete-inquiry" data-id="${item.id}" data-name="${esc(item.name)}">刪除</button>` : ''}</td>
    </tr>
  `).join('');
  document.getElementById('panel').innerHTML = `
    <h1>聯絡訊息</h1>
    <p class="muted">前台「與我聯絡」送出的內容會存在這裡，最多顯示最近 200 則。可編輯單筆，也可以勾選一筆或多筆後刪除。</p>
    <form id="inquiry-search" class="btn-row">
      <label class="field">查詢<input name="q" maxlength="40" value="${esc(state.inquiryQuery)}" placeholder="姓名、電話、Email 或內容"></label>
      <button class="btn" type="submit">查詢</button>
    </form>
    ${writable ? '<div class="btn-row"><button class="btn danger" type="button" data-action="delete-inquiries">刪除所選</button></div>' : ''}
    ${inquiryForm()}
    <div class="table-wrap">
      <table>
        <thead><tr>
          ${writable ? '<th><input id="inquiry-select-all" type="checkbox" aria-label="全選聯絡訊息"></th>' : ''}
          <th>時間</th><th>姓名</th><th>電話</th><th>Email</th><th>內容</th><th></th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="${writable ? 7 : 6}">沒有符合的聯絡訊息。</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

async function renderInquiries() {
  const query = new URLSearchParams();
  if (state.inquiryQuery) query.set('q', state.inquiryQuery);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  state.inquiries = await api(`/admin/inquiries${suffix}`, { auth: 'admin' });
  paintInquiries();
}

async function renderAdmins() {
  state.admins = await api('/admin/admins', { auth: 'admin' });
  const draft = state.adminDraft;
  const rows = state.admins.map((admin) => {
    const mine = admin.id === state.me.id;
    const actions = can('admins.write') ? `
      <button class="btn secondary" type="button" data-action="edit-admin" data-id="${admin.id}">編輯</button>
      ${mine ? '' : `<button class="btn secondary" type="button" data-action="toggle-admin" data-id="${admin.id}" data-active="${admin.isActive ? '1' : '0'}" data-name="${esc(admin.name)}">${admin.isActive ? '停用' : '啟用'}</button>`}
      ${mine ? '' : `<button class="btn danger" type="button" data-action="delete-admin" data-id="${admin.id}" data-name="${esc(admin.name)}">刪除</button>`}
    ` : '';
    return `
      <tr>
        <td>${esc(admin.name)}${mine ? '（自己）' : ''}</td>
        <td>${esc(admin.username)}</td>
        <td>${esc(admin.roleName)}</td>
        <td>${admin.isActive ? '啟用' : '停用'}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');
  const roles = can('admins.write') ? await api('/admin/roles', { auth: 'admin' }) : { roles: [] };
  const roleOptions = roles.roles.map((role) => `<option value="${role.id}" ${draft && draft.roleId === role.id ? 'selected' : ''}>${esc(role.name)}</option>`).join('');
  const editingSelf = draft && draft.id === state.me.id;
  document.getElementById('panel').innerHTML = `
    <h1>管理員</h1>
    ${can('admins.write') ? `
      <form id="admin-form" class="panel">
        <h2>${draft ? '編輯管理員' : '新增管理員'}</h2>
        <input type="hidden" name="adminId" value="${draft ? draft.id : ''}">
        <div class="form-grid">
          <label class="field">名稱<input name="name" required maxlength="40" value="${draft ? esc(draft.name) : ''}"></label>
          <label class="field">帳號<input name="username" required maxlength="20" autocomplete="off" value="${draft ? esc(draft.username) : ''}"></label>
          <label class="field">電子郵件<input name="email" type="email" required maxlength="120" value="${draft ? esc(draft.email) : ''}"></label>
          <label class="field">密碼<input name="password" type="password" ${draft ? '' : 'required minlength="8"'} maxlength="72" autocomplete="new-password" placeholder="${draft ? '不修改請留空' : ''}"></label>
          ${editingSelf
            ? `<input type="hidden" name="roleId" value="${draft.roleId}"><p class="muted">不能修改自己的角色。</p>`
            : `<label class="field">角色<select name="roleId" required>${roleOptions}</select></label>`}
        </div>
        <div class="btn-row">
          <button class="btn" type="submit">${draft ? '儲存修改' : '新增管理員'}</button>
          ${draft ? '<button class="btn secondary" type="button" data-action="cancel-admin">取消</button>' : ''}
        </div>
      </form>
    ` : ''}
    <div class="table-wrap">
      <table>
        <thead><tr><th>名稱</th><th>帳號</th><th>角色</th><th>狀態</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function renderPermissions() {
  const data = await api('/admin/roles', { auth: 'admin' });
  const forms = data.roles.map((role) => `
    <form class="panel role-form" data-role-id="${role.id}">
      <h2>${esc(role.name)}</h2>
      <p class="muted">${esc(role.description)}</p>
      <div class="check-grid">
        ${data.modules.map((item) => `
          <label class="check">
            <input type="checkbox" name="module" value="${esc(item.code)}"
              ${role.modules.includes(item.code) ? 'checked' : ''}
              ${role.locked ? 'disabled' : ''}>
            ${esc(item.name)}
          </label>
        `).join('')}
      </div>
      ${role.locked
        ? '<p class="muted">最大管理者固定擁有全部模組。</p>'
        : '<button class="btn" type="submit">儲存這個角色</button>'}
    </form>
  `).join('');
  document.getElementById('panel').innerHTML = `
    <h1>權限設定</h1>
    <p class="muted">勾選後，該角色登入時只看得到對應選單，後端也會拒絕沒有勾選的操作。</p>
    ${forms}
  `;
}

async function renderAudit() {
  const logs = await api('/admin/audit-logs', { auth: 'admin' });
  const rows = logs.map((log) => {
    const detail = log.detail || '';
    const brief = detail.length > 180 ? `${detail.slice(0, 180)}…` : detail;
    return `
      <tr>
        <td>${esc(log.createdAt)}</td>
        <td>${esc(log.adminName)}</td>
        <td title="${esc(log.action)}">${esc(ACTION_LABEL[log.action] || log.action)}</td>
        <td>${esc(log.targetType || '')} ${esc(log.targetId || '')}</td>
        <td>${esc(brief)}</td>
        <td>${esc(log.ipAddress || '')}</td>
      </tr>
    `;
  }).join('');
  document.getElementById('panel').innerHTML = `
    <h1>操作日誌</h1>
    <p class="muted">最近 100 筆。商品與文章的新增、修改、刪除都會記下管理員與時間。</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>時間</th><th>人員</th><th>動作</th><th>對象</th><th>內容</th><th>IP</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function uploadImage(file) {
  const data = new FormData();
  data.append('file', file);
  const token = localStorage.getItem('daren-admin-token');
  const response = await fetch(siteUrl('/api/admin/uploads'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: data
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || '圖片上傳失敗');
  return payload.url;
}

function fieldRow(field = { label: '', value: '' }) {
  return `
    <div class="field-row">
      <label class="field">欄位名稱<input name="fieldLabel" maxlength="20" value="${esc(field.label || '')}"></label>
      <label class="field">欄位內容<input name="fieldValue" maxlength="200" value="${esc(field.value || '')}"></label>
      <button class="btn danger" type="button" data-action="remove-field">刪除</button>
    </div>
  `;
}

function imageCard(src, inputName) {
  return `
    <div class="image-card">
      <img src="${esc(siteUrl(src))}" alt="">
      <input type="hidden" name="${inputName}" value="${esc(src)}">
      <button class="btn secondary" type="button" data-action="replace-image">修改</button>
      <button class="btn danger" type="button" data-action="remove-image">刪除</button>
    </div>
  `;
}

function bindImagePickers(root) {
  root.querySelectorAll('[data-add-image]').forEach((input) => {
    input.addEventListener('change', async () => {
      const target = root.querySelector(input.dataset.addImage);
      if (!target || !input.files.length) return;
      try {
        for (const file of input.files) {
          const url = await uploadImage(file);
          const html = imageCard(url, input.dataset.inputName);
          if (input.dataset.single === '1') target.innerHTML = html;
          else target.insertAdjacentHTML('beforeend', html);
        }
        input.value = '';
        clearAlert();
      } catch (error) {
        setAlert(error);
      }
    });
  });
}

async function saveBanner(form) {
  const imageInput = form.querySelector('input[name="image"]');
  const image = imageInput ? imageInput.value : '';
  const body = {
    eyebrow: form.eyebrow.value,
    title: form.title.value,
    body: form.body.value,
    linkLabel: form.linkLabel.value,
    linkHref: form.linkHref.value,
    sortOrder: Number(form.sortOrder.value),
    imageWidth: Number(form.imageWidth.value),
    imageHeight: Number(form.imageHeight.value),
    altText: form.altText.value,
    image,
    isPublished: form.isPublished.checked
  };
  const bannerId = form.bannerId.value;
  if (bannerId) {
    await api(`/admin/banners/${bannerId}`, { method: 'PUT', auth: 'admin', body });
  } else {
    await api('/admin/banners', { method: 'POST', auth: 'admin', body });
  }
  state.bannerDraft = null;
  await renderBanners();
}

async function saveProduct(form) {
  const mainInput = form.querySelector('input[name="mainImage"]');
  const mainImage = mainInput ? mainInput.value : '';
  const detailImages = [...form.querySelectorAll('input[name="detailImage"]')].map((item) => item.value);
  const extraFields = [...form.querySelectorAll('.field-row')].map((row) => ({
    label: row.querySelector('[name="fieldLabel"]').value.trim(),
    value: row.querySelector('[name="fieldValue"]').value.trim()
  })).filter((field) => field.label || field.value);
  const body = {
    categoryId: Number(form.categoryId.value),
    name: form.name.value,
    summary: form.summary.value,
    description: form.description.value,
    price: Number(form.price.value),
    material: form.material.value,
    weightGrams: form.weightGrams.value,
    stock: Number(form.stock.value),
    colors: form.colors.value,
    care: form.care.value,
    extraFields,
    mainImage,
    detailImages,
    isPublished: form.isPublished.checked
  };
  const productId = form.productId.value;
  if (productId) {
    await api(`/admin/products/${productId}`, { method: 'PUT', auth: 'admin', body });
  } else {
    await api('/admin/products', { method: 'POST', auth: 'admin', body });
  }
  state.productDraft = null;
  await renderProducts();
}

async function saveArticle(form) {
  const coverInput = form.querySelector('input[name="coverImage"]');
  const coverImage = coverInput ? coverInput.value : '';
  const body = {
    title: form.title.value,
    summary: form.summary.value,
    content: form.content.value,
    coverImage,
    publishedAt: form.publishedAt.value,
    isPublished: form.isPublished.checked
  };
  const articleId = form.articleId.value;
  if (articleId) {
    await api(`/admin/articles/${articleId}`, { method: 'PUT', auth: 'admin', body });
  } else {
    await api('/admin/articles', { method: 'POST', auth: 'admin', body });
  }
  state.articleDraft = null;
  await renderArticles();
}

async function saveInquiry(form) {
  await api(`/admin/inquiries/${form.inquiryId.value}`, {
    method: 'PUT',
    auth: 'admin',
    body: {
      name: form.name.value,
      phone: form.phone.value,
      email: form.email.value,
      message: form.message.value
    }
  });
  state.inquiryDraft = null;
  await renderInquiries();
}

async function saveAdmin(form) {
  const body = {
    name: form.name.value,
    username: form.username.value,
    email: form.email.value,
    password: form.password.value,
    roleId: Number(form.roleId.value)
  };
  const adminId = form.adminId.value;
  if (adminId) {
    await api(`/admin/admins/${adminId}`, { method: 'PUT', auth: 'admin', body });
  } else {
    await api('/admin/admins', { method: 'POST', auth: 'admin', body });
  }
  state.adminDraft = null;
  await renderAdmins();
}

async function saveRole(form) {
  const modules = [...form.querySelectorAll('input[name="module"]:checked')].map((item) => item.value);
  await api(`/admin/roles/${form.dataset.roleId}/modules`, {
    method: 'PUT',
    auth: 'admin',
    body: { modules }
  });
  await renderPermissions();
}

async function saveCategory(form) {
  await api('/admin/categories', {
    method: 'POST',
    auth: 'admin',
    body: { name: form.name.value, description: form.description.value }
  });
  await renderCategories();
}

async function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    if (form.id === 'banner-form') await saveBanner(form);
    else if (form.id === 'product-form') await saveProduct(form);
    else if (form.id === 'article-form') await saveArticle(form);
    else if (form.id === 'category-form') await saveCategory(form);
    else if (form.id === 'inquiry-search') {
      state.inquiryQuery = form.q.value.trim();
      state.inquiryDraft = null;
      await renderInquiries();
    }
    else if (form.id === 'inquiry-form') await saveInquiry(form);
    else if (form.id === 'admin-form') await saveAdmin(form);
    else if (form.id === 'payment-form') await savePayment(form);
    else if (form.id === 'order-qty-form') await saveOrderQuantities(form);
    else if (form.id === 'member-form') await saveMember(form);
    else if (form.classList.contains('role-form')) await saveRole(form);
    clearAlert();
  } catch (error) {
    setAlert(error);
    if (button) button.disabled = false;
  }
}

async function onClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const id = Number(button.dataset.id);
  try {
    if (action === 'replace-image') {
      const card = button.closest('.image-card');
      const picker = document.createElement('input');
      picker.type = 'file';
      picker.accept = 'image/jpeg,image/png,image/gif,image/webp';
      picker.addEventListener('change', async () => {
        const file = picker.files && picker.files[0];
        if (!file) return;
        try {
          const url = await uploadImage(file);
          card.querySelector('img').src = siteUrl(url);
          card.querySelector('input').value = url;
          clearAlert();
        } catch (error) {
          setAlert(error);
        }
      });
      picker.click();
    }
    if (action === 'remove-image') {
      const card = button.closest('.image-card');
      const src = card.querySelector('input').value;
      const form = card.closest('form');
      const bannerId = form && form.id === 'banner-form' ? form.bannerId.value : '';
      const saved = bannerId && state.bannerDraft && state.bannerDraft.image === src;
      if (saved) {
        await api(`/admin/banners/${bannerId}/image`, { method: 'DELETE', auth: 'admin' });
        state.bannerDraft.image = '';
        const listed = state.banners.find((item) => item.id === Number(bannerId));
        if (listed) listed.image = '';
      } else if (src.startsWith('/uploads/')) {
        await api('/admin/uploads', { method: 'DELETE', auth: 'admin', body: { image: src } });
      }
      card.remove();
    }
    if (action === 'add-field') {
      const list = document.getElementById('extra-fields');
      if (list.querySelectorAll('.field-row').length >= 12) {
        setAlert(new Error('自訂欄位最多 12 個'));
        return;
      }
      list.insertAdjacentHTML('beforeend', fieldRow());
    }
    if (action === 'remove-field') {
      button.closest('.field-row').remove();
    }
    if (action === 'edit-banner') {
      state.bannerDraft = state.banners.find((item) => item.id === id) || null;
      paintBanners();
    }
    if (action === 'cancel-banner') {
      state.bannerDraft = null;
      paintBanners();
    }
    if (action === 'delete-banner') {
      if (!confirm(`確定刪除「${button.dataset.name}」？`)) return;
      await api(`/admin/banners/${id}`, { method: 'DELETE', auth: 'admin' });
      state.bannerDraft = null;
      await renderBanners();
    }
    if (action === 'edit-product') {
      state.productDraft = state.products.find((item) => item.id === id) || null;
      paintProducts();
    }
    if (action === 'cancel-product') {
      state.productDraft = null;
      paintProducts();
    }
    if (action === 'delete-product') {
      if (!confirm(`確定刪除「${button.dataset.name}」？已成立的訂單仍會保留當時的商品名稱。`)) return;
      await api(`/admin/products/${id}`, { method: 'DELETE', auth: 'admin' });
      state.productDraft = null;
      await renderProducts();
    }
    if (action === 'edit-article') {
      state.articleDraft = state.articles.find((item) => item.id === id) || null;
      paintArticles();
    }
    if (action === 'cancel-article') {
      state.articleDraft = null;
      paintArticles();
    }
    if (action === 'delete-article') {
      if (!confirm(`確定刪除「${button.dataset.name}」？`)) return;
      await api(`/admin/articles/${id}`, { method: 'DELETE', auth: 'admin' });
      state.articleDraft = null;
      await renderArticles();
    }
    if (action === 'edit-member') {
      state.memberDraft = state.members.find((item) => item.id === id) || null;
      await renderMembers();
    }
    if (action === 'cancel-member') {
      state.memberDraft = null;
      await renderMembers();
    }
    if (action === 'delete-member') {
      if (!confirm(`確定刪除「${button.dataset.name}」？刪除後無法復原。`)) return;
      await api('/admin/members/delete', { method: 'POST', auth: 'admin', body: { ids: [id] } });
      if (state.memberDraft && state.memberDraft.id === id) state.memberDraft = null;
      clearAlert();
      await renderMembers();
    }
    if (action === 'delete-members') {
      const ids = selectedMemberIds();
      if (!ids.length) {
        setAlert(new Error('請先勾選要刪除的會員'));
        return;
      }
      if (!confirm(`確定刪除勾選的 ${ids.length} 位會員？刪除後無法復原。`)) return;
      await api('/admin/members/delete', { method: 'POST', auth: 'admin', body: { ids } });
      state.memberDraft = null;
      clearAlert();
      await renderMembers();
    }
    if (action === 'edit-order-qty') openOrderQtyEditor();
    if (action === 'cancel-order-qty') {
      const editor = document.getElementById('order-editor');
      if (editor) editor.innerHTML = '';
    }
    if (action === 'delete-orders') {
      const ids = selectedOrderIds();
      if (!ids.length) {
        setAlert(new Error('請先勾選要刪除的訂單'));
        return;
      }
      if (!confirm(`確定刪除勾選的 ${ids.length} 筆訂單？刪除後無法復原。已付款的訂單會把數量加回庫存。`)) return;
      await api('/admin/orders/delete', { method: 'POST', auth: 'admin', body: { ids } });
      clearAlert();
      await renderOrders();
    }
    if (action === 'save-tracking') {
      const input = document.querySelector(`[data-tracking="${id}"]`);
      await api(`/admin/orders/${id}/tracking`, {
        method: 'PATCH',
        auth: 'admin',
        body: { trackingNo: input ? input.value : '' }
      });
      await renderOrders();
    }
    if (action === 'edit-inquiry') {
      state.inquiryDraft = state.inquiries.find((item) => item.id === id) || null;
      paintInquiries();
    }
    if (action === 'cancel-inquiry') {
      state.inquiryDraft = null;
      paintInquiries();
    }
    if (action === 'delete-inquiry') {
      if (!confirm(`確定刪除「${button.dataset.name}」的聯絡訊息？刪除後無法復原。`)) return;
      await api('/admin/inquiries/delete', { method: 'POST', auth: 'admin', body: { ids: [id] } });
      if (state.inquiryDraft && state.inquiryDraft.id === id) state.inquiryDraft = null;
      clearAlert();
      await renderInquiries();
    }
    if (action === 'delete-inquiries') {
      const ids = selectedInquiryIds();
      if (!ids.length) {
        setAlert(new Error('請先勾選要刪除的聯絡訊息'));
        return;
      }
      if (!confirm(`確定刪除勾選的 ${ids.length} 則聯絡訊息？刪除後無法復原。`)) return;
      await api('/admin/inquiries/delete', { method: 'POST', auth: 'admin', body: { ids } });
      state.inquiryDraft = null;
      clearAlert();
      await renderInquiries();
    }
    if (action === 'edit-admin') {
      state.adminDraft = state.admins.find((item) => item.id === id) || null;
      await renderAdmins();
    }
    if (action === 'cancel-admin') {
      state.adminDraft = null;
      await renderAdmins();
    }
    if (action === 'delete-admin') {
      if (!confirm(`確定刪除「${button.dataset.name}」？刪除後無法復原。`)) return;
      await api(`/admin/admins/${id}`, { method: 'DELETE', auth: 'admin' });
      if (state.adminDraft && state.adminDraft.id === id) state.adminDraft = null;
      await renderAdmins();
    }
    if (action === 'toggle-admin') {
      const active = button.dataset.active === '1';
      const next = !active;
      if (!next && !confirm(`確定停用「${button.dataset.name}」？`)) return;
      await api(`/admin/admins/${id}`, { method: 'PATCH', auth: 'admin', body: { isActive: next } });
      await renderAdmins();
    }
  } catch (error) {
    setAlert(error);
  }
}

async function saveMember(form) {
  await api(`/admin/members/${form.memberId.value}`, {
    method: 'PUT',
    auth: 'admin',
    body: {
      name: form.name.value,
      email: form.email.value,
      phone: form.phone.value,
      lineId: form.lineId.value,
      password: form.password.value
    }
  });
  state.memberDraft = null;
  await renderMembers();
}

async function saveOrderQuantities(form) {
  const items = [...form.querySelectorAll('[data-item]')].map((input) => ({
    id: Number(input.dataset.item),
    quantity: Number(input.value)
  }));
  await api('/admin/orders/quantities', { method: 'PUT', auth: 'admin', body: { items } });
  await renderOrders();
}

async function onChange(event) {
  const select = event.target;
  if (select.id === 'order-select-all') {
    document.querySelectorAll('.order-check').forEach((box) => { box.checked = select.checked; });
    return;
  }
  if (select.id === 'member-select-all') {
    document.querySelectorAll('.member-check').forEach((box) => { box.checked = select.checked; });
    return;
  }
  if (select.id === 'inquiry-select-all') {
    document.querySelectorAll('.inquiry-check').forEach((box) => { box.checked = select.checked; });
    return;
  }
  if (select.classList.contains('member-check')) {
    const boxes = [...document.querySelectorAll('.member-check')];
    const all = document.getElementById('member-select-all');
    if (all) all.checked = boxes.length > 0 && boxes.every((box) => box.checked);
    return;
  }
  if (select.classList.contains('inquiry-check')) {
    const boxes = [...document.querySelectorAll('.inquiry-check')];
    const all = document.getElementById('inquiry-select-all');
    if (all) all.checked = boxes.length > 0 && boxes.every((box) => box.checked);
    return;
  }
  if (select.classList.contains('order-check')) {
    const boxes = [...document.querySelectorAll('.order-check')];
    const all = document.getElementById('order-select-all');
    if (all) all.checked = boxes.length > 0 && boxes.every((box) => box.checked);
    return;
  }
  if (select.dataset.action !== 'order-status') return;
  select.disabled = true;
  try {
    await api(`/admin/orders/${select.dataset.id}/status`, {
      method: 'PATCH',
      auth: 'admin',
      body: { status: select.value }
    });
    await renderOrders();
  } catch (error) {
    setAlert(error);
    await renderOrders();
  }
}

async function boot() {
  if (!localStorage.getItem('daren-admin-token')) {
    location.replace(siteUrl('/admin/login.html'));
    return;
  }
  try {
    state.me = await api('/admin/me', { auth: 'admin' });
  } catch (error) {
    localStorage.removeItem('daren-admin-token');
    location.replace(siteUrl('/admin/login.html'));
    return;
  }
  document.getElementById('admin-who').textContent = `${state.me.name}．${state.me.role.name}`;
  document.getElementById('admin-logout').addEventListener('click', () => {
    localStorage.removeItem('daren-admin-token');
    location.href = siteUrl('/admin/login.html');
  });
  const panel = document.getElementById('panel');
  panel.addEventListener('submit', onSubmit);
  panel.addEventListener('click', onClick);
  panel.addEventListener('change', onChange);
  window.addEventListener('hashchange', () => { render(); });
  render();
}

boot();
