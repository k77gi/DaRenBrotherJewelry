async function showOrder(order) {
  document.getElementById('order-title').textContent = queryParam('paid') === '1' ? '付款完成' : '訂單明細';
  document.getElementById('order-box').innerHTML = renderOrder(order);
  document.getElementById('lookup-form').hidden = true;
}

async function loadOrder() {
  const orderNo = queryParam('no') || '';
  const form = document.getElementById('lookup-form');
  const alertBox = document.getElementById('lookup-alert');
  if (orderNo) form.orderNo.value = orderNo;

  if (orderNo && localStorage.getItem('daren-member-token')) {
    try {
      await showOrder(await api(`/orders/${encodeURIComponent(orderNo)}`, { auth: 'member' }));
      return;
    } catch (error) { /* 改以電子郵件查詢 */ }
  }

  const savedEmail = sessionStorage.getItem('daren-order-email');
  if (orderNo && savedEmail) {
    try {
      await showOrder(await api('/orders/lookup', {
        method: 'POST',
        body: { orderNo, email: savedEmail }
      }));
      return;
    } catch (error) { /* 顯示查詢表單 */ }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertBox.hidden = true;
    try {
      const order = await api('/orders/lookup', {
        method: 'POST',
        body: { orderNo: form.orderNo.value, email: form.email.value }
      });
      sessionStorage.setItem('daren-order-email', order.buyerEmail);
      await showOrder(order);
    } catch (error) {
      alertBox.hidden = false;
      alertBox.textContent = readableError(error);
    }
  });
}

loadOrder();
