const METHOD_COPY = {
  card: {
    title: '信用卡刷卡',
    text: '這是模擬刷卡頁，不會收集或儲存卡號。按下完成付款後，訂單會改為已付款並扣除庫存。'
  },
  atm: {
    title: 'ATM 虛擬帳號',
    text: '這是模擬轉帳頁。下方帳號只供畫面展示，不是真實銀行帳號。'
  },
  linepay: {
    title: 'LINE Pay',
    text: '這是模擬 LINE Pay 付款頁，不會連到 LINE。按下完成付款即代表模擬付款成功。'
  }
};

function virtualAccount(orderNo) {
  const digits = String(orderNo).replace(/\D/g, '').padEnd(14, '0').slice(0, 14);
  return digits;
}

async function loadPayment() {
  const orderNo = queryParam('no') || '';
  const method = queryParam('method') || '';
  const box = document.getElementById('payment-box');
  const email = sessionStorage.getItem('daren-order-email') || '';
  if (!orderNo) {
    box.innerHTML = '<p class="alert error">找不到訂單編號。</p>';
    return;
  }
  let order = null;
  try {
    if (localStorage.getItem('daren-member-token')) {
      try {
        order = await api(`/orders/${encodeURIComponent(orderNo)}`, { auth: 'member' });
      } catch (error) { /* 改以電子郵件查 */ }
    }
    if (!order && email) {
      order = await api('/orders/lookup', { method: 'POST', body: { orderNo, email } });
    }
  } catch (error) {
    box.innerHTML = `<p class="alert error">${esc(readableError(error))}</p>`;
    return;
  }
  if (!order) {
    box.innerHTML = '<p>請先用訂單編號與電子郵件查詢，再進行付款。</p>';
    return;
  }
  const shop = await api('/shop');
  if (shop.payment && shop.payment.online === false) {
    location.replace(siteUrl(`/remittance.html?no=${encodeURIComponent(order.orderNo)}`));
    return;
  }
  if (order.paymentMethod === 'transfer') {
    location.replace(siteUrl(`/remittance.html?no=${encodeURIComponent(order.orderNo)}`));
    return;
  }
  sessionStorage.setItem('daren-order-email', order.buyerEmail);
  const links = ['card', 'atm', 'linepay'].map((item) => `
    <a class="pay-card ${method === item ? 'is-active' : ''}" href="${siteUrl(`/payment.html?no=${encodeURIComponent(order.orderNo)}&method=${item}`)}">
      <strong>${METHOD_COPY[item].title}</strong>
      <p class="muted">模擬付款連結</p>
    </a>
  `).join('');
  const panel = METHOD_COPY[method];
  box.innerHTML = `
    <p>訂單 ${esc(order.orderNo)}，應付 <strong>${money(order.total)}</strong>，狀態 ${esc(statusLabel(order.status))}</p>
    <div class="pay-grid">${links}</div>
    ${panel && order.status === 'pending' ? `
      <section class="panel">
        <h2>${panel.title}</h2>
        <p>${panel.text}</p>
        ${method === 'atm' ? `<p>銀行代碼 812<br>虛擬帳號 ${virtualAccount(order.orderNo)}</p>` : ''}
        <button class="btn" id="confirm-pay" type="button">完成模擬付款</button>
        <p id="pay-alert" class="alert error" hidden></p>
      </section>
    ` : ''}
    ${order.status !== 'pending' ? `<p><a href="${siteUrl(`/order.html?no=${encodeURIComponent(order.orderNo)}`)}">查看訂單</a></p>` : ''}
  `;
  const button = document.getElementById('confirm-pay');
  if (!button) return;
  button.addEventListener('click', async () => {
    const alertBox = document.getElementById('pay-alert');
    button.disabled = true;
    try {
      await api(`/orders/${encodeURIComponent(order.orderNo)}/pay`, {
        method: 'POST',
        auth: 'member',
        body: { method, email: order.buyerEmail }
      });
      location.href = siteUrl(`/order.html?no=${encodeURIComponent(order.orderNo)}&paid=1`);
    } catch (error) {
      alertBox.hidden = false;
      alertBox.textContent = readableError(error);
      button.disabled = false;
    }
  });
}

loadPayment();
