function logout() {
  localStorage.removeItem('daren-member-token');
  localStorage.removeItem('daren-member-name');
  location.href = siteUrl('/member.html');
}

function purchaseOf(purchases, productId) {
  return purchases.find((item) => item.productId === productId) || null;
}

function historyRows(orders, purchases) {
  const rows = [];
  orders.forEach((order) => {
    const when = String(order.createdAt || '').slice(0, 16).replace('T', ' ');
    const items = order.items.length ? order.items : [{ productName: '—', quantity: '', lineTotal: order.total, productId: null }];
    items.forEach((item) => {
      const bought = purchaseOf(purchases, item.productId);
      let action = '—';
      if (bought && bought.canBuy) {
        action = `<button class="btn" type="button" data-rebuy="${bought.productId}" data-color="${esc(bought.color || '')}" data-stock="${bought.stock}">再次選購</button>`;
      } else if (bought) {
        action = `<button class="btn" type="button" disabled>${esc(bought.unavailableReason || '商品已售完，無法購買')}</button>`;
      }
      rows.push(`
        <tr>
          <td>${esc(when)}</td>
          <td><a href="${siteUrl(`/order.html?no=${encodeURIComponent(order.orderNo)}`)}">${esc(order.orderNo)}</a></td>
          <td>${item.productId ? `<a href="${siteUrl(`/product.html?id=${item.productId}`)}">${esc(item.productName)}</a>` : esc(item.productName)}</td>
          <td>${item.quantity === '' ? '—' : item.quantity}</td>
          <td>${money(item.lineTotal)}</td>
          <td>${esc(statusLabel(order.status))}</td>
          <td>${action}</td>
        </tr>
      `);
    });
  });
  return rows;
}

function bindRepurchase() {
  const alertBox = document.getElementById('purchase-alert');
  document.getElementById('history-body').addEventListener('click', (event) => {
    const button = event.target.closest('[data-rebuy]');
    if (!button || button.disabled) return;
    const productId = Number(button.dataset.rebuy);
    const color = button.dataset.color || '';
    const stock = Number(button.dataset.stock);
    const inCart = cartItems()
      .filter((item) => item.productId === productId && item.color === color)
      .reduce((sum, item) => sum + item.quantity, 0);
    alertBox.hidden = false;
    if (!Number.isInteger(stock) || stock <= 0 || inCart >= stock) {
      alertBox.className = 'alert error';
      alertBox.textContent = '商品已售完，無法購買';
      button.disabled = true;
      button.textContent = '商品已售完，無法購買';
      return;
    }
    addToCart(productId, 1, color);
    alertBox.className = 'alert ok';
    alertBox.textContent = '已加入購物車，可以前往結帳。';
  });
}

async function loadProfile() {
  if (localStorage.getItem('daren-member-token') && sessionStorage.getItem('daren-after-login') === '/checkout.html') {
    sessionStorage.removeItem('daren-after-login');
    const loggedIn = queryParam('logged_in') === '1' ? '?logged_in=1' : '';
    location.replace(siteUrl(`/checkout.html${loggedIn}`));
    return;
  }
  if (!localStorage.getItem('daren-member-token')) {
    location.replace(siteUrl('/member.html'));
    return;
  }
  document.getElementById('logout').addEventListener('click', logout);
  const alertBox = document.getElementById('profile-alert');
  try {
    const member = await api('/members/me', { auth: 'member' });
    const [orders, purchases] = await Promise.all([
      api('/members/orders', { auth: 'member' }),
      api('/members/purchases', { auth: 'member' })
    ]);
    localStorage.setItem('daren-member-name', member.name);
    mountChrome();
    const rows = [
      ['姓名', member.name || '—'],
      ['電子郵件', member.email || '未提供'],
      ['電話', member.phone || '未提供'],
      ['LINE ID', member.lineId || '未提供'],
      ['加入日期', String(member.createdAt || '').slice(0, 10) || '—']
    ];
    document.getElementById('member-info').innerHTML = rows.map(([label, value]) => `
      <dt>${esc(label)}</dt><dd>${esc(value)}</dd>
    `).join('');
    const body = document.getElementById('history-body');
    const lines = historyRows(orders, purchases);
    body.innerHTML = lines.length ? lines.join('') : '<tr><td colspan="7">還沒有購買紀錄。</td></tr>';
    bindRepurchase();
  } catch (error) {
    logout();
    alertBox.hidden = false;
    alertBox.textContent = readableError(error);
  }
}

loadProfile();
