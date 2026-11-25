async function loadContact() {
  const info = document.getElementById('store-info');
  const form = document.getElementById('contact-form');
  const alertBox = document.getElementById('contact-alert');
  try {
    const shop = await api('/shop');
    info.innerHTML = `
      <h2>店面資訊</h2>
      <p>大仁哥的珠寶小舖</p>
      <p>電話 ${esc(shop.phone)}</p>
      <p>地址 ${esc(shop.address)}</p>
      <p>營業時間 ${esc(shop.hours)}</p>
    `;
  } catch (error) {
    info.innerHTML = `<p class="alert error">${esc(readableError(error))}</p>`;
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertBox.hidden = true;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await api('/inquiries', {
        method: 'POST',
        body: {
          name: form.name.value,
          phone: form.phone.value,
          email: form.email.value,
          message: form.message.value
        }
      });
      form.reset();
      alertBox.hidden = false;
      alertBox.className = 'alert ok';
      alertBox.textContent = '已收到並儲存你的訊息，感謝您的留言，將儘快與您聯繫。';
    } catch (error) {
      alertBox.hidden = false;
      alertBox.className = 'alert error';
      alertBox.textContent = readableError(error);
    } finally {
      button.disabled = false;
    }
  });
}

loadContact();
