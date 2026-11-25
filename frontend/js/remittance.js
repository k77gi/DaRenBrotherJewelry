async function loadOrder(orderNo) {
  const email = sessionStorage.getItem('daren-order-email') || '';
  if (localStorage.getItem('daren-member-token')) {
    try {
      return await api(`/orders/${encodeURIComponent(orderNo)}`, { auth: 'member' });
    } catch (error) { /* 改以電子郵件查 */ }
  }
  if (!email) return null;
  return api('/orders/lookup', { method: 'POST', body: { orderNo, email } });
}

async function loadRemittance() {
  const box = document.getElementById('remit-box');
  const orderNo = queryParam('no') || '';
  if (!orderNo) {
    box.innerHTML = '<p class="alert error">找不到訂單編號。</p>';
    return;
  }
  try {
    const [shop, order] = await Promise.all([api('/shop'), loadOrder(orderNo)]);
    if (!order) {
      box.innerHTML = '<p>請先用訂單編號與電子郵件查詢，再查看匯款資訊。</p>';
      return;
    }
    if (shop.payment && shop.payment.online && order.paymentMethod !== 'transfer') {
      location.replace(siteUrl(`/payment.html?no=${encodeURIComponent(order.orderNo)}`));
      return;
    }
    sessionStorage.setItem('daren-order-email', order.buyerEmail);
    const payment = shop.payment || {};
    const lines = order.items.map((item) => `<li>${esc(item.productName)} × ${item.quantity}，${money(item.lineTotal)}</li>`).join('');
    const accountReady = payment.payeeName && payment.payeeAccount;
    box.innerHTML = `
      <div class="checkout-grid">
        <section class="panel summary">
          <h2>訂單內容</h2>
          <p>訂單 ${esc(order.orderNo)}，購買者 ${esc(order.buyerName)}</p>
          <ul>${lines}</ul>
          <p>商品 ${money(order.subtotal)}</p>
          <p>運費 ${money(order.shippingFee)}</p>
          <p>合計 <strong>${money(order.total)}</strong></p>
          <p class="muted">狀態 ${esc(statusLabel(order.status))}</p>
        </section>
        <aside class="panel">
          <h2>匯款資訊</h2>
          ${accountReady ? `
            ${payment.bankName ? `<p>銀行名稱<br><strong>${esc(payment.bankName)}</strong></p>` : ''}
            <p>收款戶名<br><strong>${esc(payment.payeeName)}</strong></p>
            <p>收款帳號<br><strong class="remit-account">${esc(payment.payeeAccount)}</strong></p>
            <p>應付金額<br><strong>${money(order.total)}</strong></p>
            <p class="muted">請匯入與合計相同的金額，並保留明細。款項確認後，訂單才會改為已付款。</p>
          ` : '<p class="alert error">商店尚未填寫匯款帳戶，請改以電話與我們聯絡。</p>'}
          <p><a href="${siteUrl(`/order.html?no=${encodeURIComponent(order.orderNo)}`)}">查看訂單</a></p>
        </aside>
      </div>
    `;
  } catch (error) {
    box.innerHTML = `<p class="alert error">${esc(readableError(error))}</p>`;
  }
}

loadRemittance();
