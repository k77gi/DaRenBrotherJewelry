async function loadCheckout() {
  const form = document.getElementById('checkout-form');
  const summary = document.getElementById('checkout-summary');
  const alertBox = document.getElementById('checkout-alert');
  const items = cartItems();
  if (items.length === 0) {
    summary.innerHTML = '<p>購物車是空的。<a href="/shop.html">去珠寶小舖</a></p>';
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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertBox.hidden = true;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const order = await api('/orders', {
        method: 'POST',
        auth: 'member',
        body: {
          buyerName: form.buyerName.value,
          buyerEmail: form.buyerEmail.value,
          buyerPhone: form.buyerPhone.value,
          shippingAddress: form.shippingAddress.value,
          note: form.note.value,
          items: cartItems()
        }
      });
      saveCart([]);
      sessionStorage.setItem('daren-order-email', order.buyerEmail);
      location.href = `/payment.html?no=${encodeURIComponent(order.orderNo)}`;
    } catch (error) {
      alertBox.hidden = false;
      alertBox.textContent = readableError(error);
      button.disabled = false;
    }
  });
}

loadCheckout();
