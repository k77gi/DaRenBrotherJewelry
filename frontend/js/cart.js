async function loadCart() {
  const root = document.getElementById('cart-lines');
  const summary = document.getElementById('cart-summary');
  try {
    const [products, shop] = await Promise.all([api('/products'), api('/shop')]);
    const items = cartItems();
    if (items.length === 0) {
      root.innerHTML = `<p>購物車還沒有商品。<a href="${siteUrl('/shop.html')}">去珠寶小舖</a></p>`;
      summary.innerHTML = '';
      return;
    }
    let blocked = false;
    root.innerHTML = items.map((item) => {
      const product = products.find((row) => row.id === item.productId);
      if (!product) {
        blocked = true;
        return `
          <div class="cart-line">
            <div><strong>此商品已下架</strong></div>
            <span></span><span></span>
            <button class="btn secondary" type="button" data-remove="${item.productId}" data-color="${esc(item.color)}">刪除</button>
          </div>
        `;
      }
      const over = item.quantity > product.stock;
      if (over || product.stock < 1) blocked = true;
      const quantity = Math.min(item.quantity, product.stock);
      return `
        <div class="cart-line">
          <div>
            <h3><a href="${siteUrl(`/product.html?id=${product.id}`)}">${esc(product.name)}</a></h3>
            <p class="product-meta">${esc(item.color || product.material)}，庫存 ${product.stock} 件${over ? '，數量已超過庫存' : ''}</p>
          </div>
          <div class="stepper">
            <button type="button" data-dec="${product.id}" data-color="${esc(item.color)}" aria-label="減少數量">-</button>
            <input value="${Math.max(quantity, product.stock > 0 ? 1 : 0)}" data-qty="${product.id}" data-color="${esc(item.color)}" aria-label="數量" ${product.stock > 0 ? '' : 'disabled'}>
            <button type="button" data-inc="${product.id}" data-color="${esc(item.color)}" aria-label="增加數量">+</button>
          </div>
          <strong>${money(product.price * (product.stock > 0 ? quantity : 0))}</strong>
          <button class="btn secondary" type="button" data-remove="${product.id}" data-color="${esc(item.color)}">刪除</button>
        </div>
      `;
    }).join('');

    let subtotal = 0;
    items.forEach((item) => {
      const product = products.find((row) => row.id === item.productId);
      if (!product || product.stock < 1) return;
      subtotal += product.price * Math.min(item.quantity, product.stock);
    });
    const shipping = subtotal === 0 ? 0 : (subtotal >= shop.freeShippingThreshold ? 0 : shop.shippingFee);
    summary.innerHTML = `
      <p>商品小計 ${money(subtotal)}</p>
      <p>運費 ${money(shipping)}</p>
      <p>合計 <strong>${money(subtotal + shipping)}</strong></p>
      <p class="muted">滿 ${money(shop.freeShippingThreshold)} 免運。庫存不足的品項需先調整數量。</p>
      ${blocked ? '<p class="alert error">有商品超過庫存或已下架，請先調整。</p>' : `<a class="btn" id="go-checkout" href="${siteUrl('/checkout.html')}">前往結帳</a>`}
    `;
    const go = document.getElementById('go-checkout');
    if (go) {
      go.addEventListener('click', (event) => {
        if (localStorage.getItem('daren-member-token')) return;
        event.preventDefault();
        rememberCheckout();
        location.href = siteUrl('/member.html');
      });
    }

    const change = (productId, color, quantity) => {
      const product = products.find((row) => row.id === productId);
      let next = quantity;
      if (!Number.isInteger(next) || next < 1) next = 0;
      if (product && next > product.stock) next = product.stock;
      if (next > 99) next = 99;
      setCartQty(productId, next, color);
      loadCart();
    };
    root.querySelectorAll('[data-remove]').forEach((button) => {
      button.addEventListener('click', () => change(Number(button.dataset.remove), button.dataset.color, 0));
    });
    root.querySelectorAll('[data-dec]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = root.querySelector(`[data-qty="${button.dataset.dec}"][data-color="${button.dataset.color}"]`);
        change(Number(button.dataset.dec), button.dataset.color, Number(input.value) - 1);
      });
    });
    root.querySelectorAll('[data-inc]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = root.querySelector(`[data-qty="${button.dataset.inc}"][data-color="${button.dataset.color}"]`);
        change(Number(button.dataset.inc), button.dataset.color, Number(input.value) + 1);
      });
    });
    root.querySelectorAll('[data-qty]').forEach((input) => {
      input.addEventListener('change', () => change(Number(input.dataset.qty), input.dataset.color, Number(input.value)));
    });
  } catch (error) {
    root.innerHTML = `<p class="alert error">${esc(readableError(error))}</p>`;
  }
}

loadCart();
