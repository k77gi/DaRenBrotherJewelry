const DRAFT_KEY = 'daren-checkout-draft';

function saveDraft(form) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
    buyerName: form.buyerName.value,
    buyerEmail: form.buyerEmail.value,
    buyerPhone: form.buyerPhone.value,
    shippingAddress: form.shippingAddress.value,
    note: form.note.value,
    delivery: form.delivery.value,
    cvsType: form.cvsType.value
  }));
}

function restoreDraft(form) {
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    form.buyerName.value = draft.buyerName || form.buyerName.value;
    form.buyerEmail.value = draft.buyerEmail || form.buyerEmail.value;
    form.buyerPhone.value = draft.buyerPhone || form.buyerPhone.value;
    form.shippingAddress.value = draft.shippingAddress || '';
    form.note.value = draft.note || '';
    if (draft.delivery) form.delivery.value = draft.delivery;
    if (draft.cvsType) form.cvsType.value = draft.cvsType;
  } catch (error) {
    sessionStorage.removeItem(DRAFT_KEY);
  }
}

function syncDelivery(form) {
  const cvs = form.delivery.value === 'cvs';
  document.getElementById('cvs-panel').hidden = !cvs;
  const address = document.getElementById('address-field');
  address.hidden = cvs;
  form.shippingAddress.required = !cvs;
  if (cvs) form.shippingAddress.value = '';
}

function showStore(store) {
  document.getElementById('cvs-id').textContent = store.storeId;
  document.getElementById('cvs-name').textContent = store.storeName;
  document.getElementById('cvs-address').textContent = store.address;
  document.getElementById('cvs-result').hidden = false;
}

async function loadStore(form, token) {
  const store = await api(`/logistics/cvs-map/${encodeURIComponent(token)}`);
  form.delivery.value = 'cvs';
  form.cvsType.value = store.subtype;
  form.cvsToken.value = token;
  syncDelivery(form);
  showStore(store);
}

async function loadCheckout() {
  const form = document.getElementById('checkout-form');
  const summary = document.getElementById('checkout-summary');
  const alertBox = document.getElementById('checkout-alert');
  const items = cartItems();
  if (items.length === 0) {
    summary.innerHTML = `<p>購物車是空的。<a href="${siteUrl('/shop.html')}">去珠寶小舖</a></p>`;
    form.hidden = true;
    return;
  }

  try {
    const [products, shop] = await Promise.all([api('/products'), api('/shop')]);
    let subtotal = 0;
    let blocked = false;
    const lines = items.map((item) => {
      const product = products.find((row) => row.id === item.productId);
      if (!product) {
        blocked = true;
        return '<li>有商品已下架，請回購物車確認。</li>';
      }
      if (item.quantity > product.stock) blocked = true;
      const quantity = Math.min(item.quantity, product.stock);
      subtotal += product.price * quantity;
      return `<li>${esc(product.name)}${item.color ? `（${esc(item.color)}）` : ''} × ${quantity}，${money(product.price * quantity)}</li>`;
    }).join('');
    const shipping = subtotal >= shop.freeShippingThreshold || subtotal === 0 ? 0 : shop.shippingFee;
    summary.innerHTML = `
      <h2>訂單內容</h2>
      <ul>${lines}</ul>
      <p>商品 ${money(subtotal)}</p>
      <p>運費 ${money(shipping)}</p>
      <p>合計 <strong>${money(subtotal + shipping)}</strong></p>
      <p class="muted">送出後會建立待處理訂單，並前往模擬付款。付款成功才扣庫存。</p>
      ${blocked ? '<p class="alert error">數量超過庫存，請回購物車調整。</p>' : ''}
    `;
    if (blocked) form.hidden = true;
  } catch (error) {
    summary.innerHTML = `<p class="alert error">${esc(readableError(error))}</p>`;
  }

  if (localStorage.getItem('daren-member-token')) {
    try {
      const member = await api('/members/me', { auth: 'member' });
      form.buyerName.value = member.name;
      if (member.email) form.buyerEmail.value = member.email;
      form.buyerPhone.value = member.phone || '';
    } catch (error) {
      localStorage.removeItem('daren-member-token');
      localStorage.removeItem('daren-member-name');
    }
  }

  restoreDraft(form);
  syncDelivery(form);
  form.addEventListener('change', (event) => {
    if (form.delivery.value === 'home' || event.target.name === 'cvsType') {
      form.cvsToken.value = '';
      document.getElementById('cvs-result').hidden = true;
    }
    syncDelivery(form);
  });
  document.getElementById('open-map').addEventListener('click', async () => {
    alertBox.hidden = true;
    saveDraft(form);
    try {
      const result = await api('/logistics/cvs-map', {
        method: 'POST',
        body: {
          subtype: form.cvsType.value,
          device: window.matchMedia('(max-width: 800px)').matches ? '1' : '0'
        }
      });
      const gate = document.createElement('form');
      gate.method = 'POST';
      gate.action = result.action;
      Object.entries(result.fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        gate.appendChild(input);
      });
      document.body.appendChild(gate);
      gate.submit();
    } catch (error) {
      alertBox.hidden = false;
      alertBox.textContent = readableError(error);
    }
  });
  const cvsToken = new URLSearchParams(location.search).get('cvs');
  if (cvsToken) {
    try {
      await loadStore(form, cvsToken);
      history.replaceState(null, '', '/checkout.html');
    } catch (error) {
      alertBox.hidden = false;
      alertBox.textContent = readableError(error);
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertBox.hidden = true;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      if (form.delivery.value === 'cvs' && !form.cvsToken.value) {
        throw new Error('請先用電子地圖選擇超商');
      }
      const order = await api('/orders', {
        method: 'POST',
        auth: 'member',
        body: {
          buyerName: form.buyerName.value,
          buyerEmail: form.buyerEmail.value,
          buyerPhone: form.buyerPhone.value,
          shippingAddress: form.shippingAddress.value,
          note: form.note.value,
          delivery: form.delivery.value,
          cvsToken: form.cvsToken.value,
          items: cartItems()
        }
      });
      saveCart([]);
      sessionStorage.setItem('daren-order-email', order.buyerEmail);
      location.href = siteUrl(`/payment.html?no=${encodeURIComponent(order.orderNo)}`);
    } catch (error) {
      alertBox.hidden = false;
      alertBox.textContent = readableError(error);
      button.disabled = false;
    }
  });
}

loadCheckout();
