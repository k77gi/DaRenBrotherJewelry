const ORDER_STATUS = {
  pending: '待處理',
  paid: '已付款',
  shipped: '已出貨',
  completed: '已完成',
  cancelled: '已取消'
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function money(amount) {
  return `NT$ ${Number(amount).toLocaleString('zh-TW')}`;
}

function statusLabel(code) {
  return ORDER_STATUS[code] || code;
}

function paragraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((block) => `<p>${esc(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function readableError(error) {
  if (error instanceof TypeError) return '無法連上伺服器，請確認已經執行 npm start';
  return error.message || '發生錯誤';
}

function queryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

async function api(path, options = {}) {
  const headers = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth) {
    const key = options.auth === 'admin' ? 'daren-admin-token' : 'daren-member-token';
    const token = localStorage.getItem(key);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || '請求失敗');
    error.status = response.status;
    throw error;
  }
  return data;
}

function cartItems() {
  try {
    const items = JSON.parse(localStorage.getItem('daren-cart') || '[]');
    if (!Array.isArray(items)) return [];
    return items
      .filter((item) => Number.isInteger(item.productId) && Number.isInteger(item.quantity))
      .map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        color: String(item.color || '')
      }));
  } catch (error) {
    return [];
  }
}

function cartCount() {
  return cartItems().reduce((sum, item) => sum + item.quantity, 0);
}

function saveCart(items) {
  localStorage.setItem('daren-cart', JSON.stringify(items));
  const count = document.getElementById('cart-count');
  if (count) count.textContent = String(cartCount());
}

function sameLine(item, productId, color) {
  return item.productId === productId && item.color === (color || '');
}

function addToCart(productId, quantity, color = '') {
  const items = cartItems();
  const found = items.find((item) => sameLine(item, productId, color));
  const nextQuantity = (found ? found.quantity : 0) + quantity;
  if (nextQuantity > 99) throw new Error('同一商品最多 99 件');
  if (found) found.quantity = nextQuantity;
  else items.push({ productId, quantity, color: color || '' });
  saveCart(items);
}

function setCartQty(productId, quantity, color = '') {
  const items = cartItems().flatMap((item) => {
    if (!sameLine(item, productId, color)) return [item];
    if (quantity <= 0) return [];
    return [{ productId, quantity, color: color || '' }];
  });
  saveCart(items);
}

function productCard(product) {
  const stock = product.stock > 0 ? `庫存 ${product.stock} 件` : '暫時缺貨';
  const image = product.images && product.images[0] ? product.images[0].src : '/images/products/generic.svg';
  return `
    <a class="product-card" href="/product.html?id=${product.id}">
      <img src="${esc(image)}" alt="${esc(product.name)}">
      <div class="body">
        <p class="product-meta">${esc(product.categoryName)}</p>
        <h3>${esc(product.name)}</h3>
        <p class="product-meta">${esc(product.summary)}</p>
        <p class="price">${money(product.price)}</p>
        <p class="product-meta">${stock}</p>
      </div>
    </a>
  `;
}

function articleCard(article) {
  const date = String(article.publishedAt || article.createdAt || '').slice(0, 10);
  return `
    <a class="article-card" href="/article.html?id=${article.id}">
      <img src="${esc(article.thumbnail)}" alt="">
      <div>
        <p class="eyebrow">${esc(date)}</p>
        <h3>${esc(article.title)}</h3>
        <p>${esc(article.summary)}</p>
      </div>
    </a>
  `;
}

function renderOrder(order) {
  const items = order.items.map((item) => `
    <li>${esc(item.productName)} × ${item.quantity}，${money(item.lineTotal)}</li>
  `).join('');
  return `
    <article class="order-card">
      <header>
        <strong>${esc(order.orderNo)}</strong>
        <span>${esc(statusLabel(order.status))}</span>
      </header>
      <p class="muted">${esc(order.createdAt)}</p>
      <ul>${items}</ul>
      <p>商品 ${money(order.subtotal)}，運費 ${money(order.shippingFee)}，合計 <strong>${money(order.total)}</strong></p>
      <p>收件人 ${esc(order.buyerName)}，${esc(order.buyerPhone)}</p>
      <p>${esc(order.shippingAddress)}</p>
      ${order.note ? `<p>備註：${esc(order.note)}</p>` : ''}
      ${order.paymentMethod ? `<p>付款方式：${esc(paymentLabel(order.paymentMethod))}</p>` : ''}
      ${order.trackingNo ? `<p>物流單號：${esc(order.trackingNo)}</p>` : ''}
      ${order.status === 'pending' ? `<p><a href="/payment.html?no=${encodeURIComponent(order.orderNo)}">前往付款</a></p>` : ''}
    </article>
  `;
}

function paymentLabel(method) {
  return { card: '信用卡刷卡', atm: 'ATM 虛擬帳號', linepay: 'LINE Pay' }[method] || method;
}

function mountChrome() {
  const page = document.body.dataset.page;
  const name = localStorage.getItem('daren-member-name');
  const token = localStorage.getItem('daren-member-token');
  const accountText = token && name ? name : '會員登入/註冊';
  const header = document.getElementById('site-header');
  if (header) {
    header.className = 'site-header';
    header.innerHTML = `
      <div class="wrap header-inner">
        <a class="brand" href="/">大仁哥的珠寶小舖</a>
        <nav class="nav" aria-label="主要選單">
          <a class="nav-btn" href="/shop.html" data-nav="shop">珠寶小舖</a>
          <a class="nav-btn" href="/blog.html" data-nav="blog">小白教室</a>
          <a class="nav-btn" href="/contact.html" data-nav="contact">與我聯絡</a>
          <a class="nav-btn" href="/member.html" data-nav="member" id="account-link">${esc(accountText)}</a>
          <a class="cart-link" href="/cart.html" data-nav="cart" aria-label="購物車">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h15l-1.5 9h-12z"/><path d="M6 7 5 4H2"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>
            <span id="cart-count">${cartCount()}</span>
          </a>
        </nav>
      </div>
    `;
  }
  const footer = document.getElementById('site-footer');
  if (footer) {
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="wrap footer-grid">
        <div>
          <strong>大仁哥的珠寶小舖</strong>
          <p>客服電話 02-2345-6789</p>
          <p>實體店面 台北市大安區仁愛路四段 100 號 1 樓</p>
        </div>
        <div>
          <p id="shipping-note">滿 NT$ 3,000 免運，未滿收取 NT$ 80。</p>
          <p>© 2026 大仁哥的珠寶小舖。版權所有。</p>
        </div>
      </div>
    `;
  }
  document.querySelectorAll('[data-nav]').forEach((link) => {
    const active = link.dataset.nav === page;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
  });
  if (header && !document.getElementById('back-to-top')) {
    const button = document.createElement('button');
    button.id = 'back-to-top';
    button.type = 'button';
    button.textContent = '向上';
    button.setAttribute('aria-label', '回到頁面頂端');
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.appendChild(button);
    const toggle = () => button.classList.toggle('is-visible', window.scrollY > 280);
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }
  const note = document.getElementById('shipping-note');
  if (note) {
    api('/shop').then((shop) => {
      note.textContent = `滿 ${money(shop.freeShippingThreshold)} 免運，未滿收取 ${money(shop.shippingFee)}。`;
      const phone = footer.querySelector('p');
      if (shop.phone) footer.querySelectorAll('p')[0].textContent = `客服電話 ${shop.phone}`;
      if (shop.address) footer.querySelectorAll('p')[1].textContent = `實體店面 ${shop.address}`;
    }).catch(() => {});
  }
}

mountChrome();
