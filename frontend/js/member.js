function saveMember(result) {
  localStorage.setItem('daren-member-token', result.token);
  localStorage.setItem('daren-member-name', result.member.name);
  location.reload();
}

function bindGuestForms() {
  const loginAlert = document.getElementById('login-alert');
  const registerAlert = document.getElementById('register-alert');
  document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    loginAlert.hidden = true;
    const form = event.target;
    try {
      const result = await api('/members/login', {
        method: 'POST',
        body: { account: form.account.value, password: form.password.value }
      });
      saveMember(result);
    } catch (error) {
      loginAlert.hidden = false;
      loginAlert.textContent = readableError(error);
    }
  });
  const registerForm = document.getElementById('register-form');
  const syncMethod = () => {
    const method = registerForm.method.value;
    registerForm.querySelectorAll('[data-method]').forEach((field) => {
      const active = field.dataset.method === method;
      field.hidden = !active;
      const input = field.querySelector('input');
      input.required = active;
      if (!active) input.value = '';
    });
  };
  registerForm.addEventListener('change', syncMethod);
  syncMethod();
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    registerAlert.hidden = true;
    const form = event.target;
    try {
      const result = await api('/members/register', {
        method: 'POST',
        body: {
          method: form.method.value,
          name: form.name.value,
          email: form.email.value,
          phone: form.phone.value,
          lineId: form.lineId.value,
          password: form.password.value
        }
      });
      saveMember(result);
    } catch (error) {
      registerAlert.hidden = false;
      registerAlert.textContent = readableError(error);
    }
  });
}

async function loadMember() {
  const token = localStorage.getItem('daren-member-token');
  if (!token) {
    bindGuestForms();
    return;
  }
  try {
    const member = await api('/members/me', { auth: 'member' });
    const orders = await api('/members/orders', { auth: 'member' });
    localStorage.setItem('daren-member-name', member.name);
    mountChrome();
    document.getElementById('guest-panel').hidden = true;
    const panel = document.getElementById('member-panel');
    panel.hidden = false;
    document.getElementById('member-title').textContent = `${member.name} 的訂單`;
    const contact = [
      member.email,
      member.phone,
      member.lineId ? `LINE ${member.lineId}` : ''
    ].filter(Boolean).join('　');
    document.getElementById('member-meta').textContent = contact;
    document.getElementById('member-orders').innerHTML = orders.length
      ? orders.map(renderOrder).join('')
      : '<p>還沒有訂單。</p>';
    document.getElementById('logout').addEventListener('click', () => {
      localStorage.removeItem('daren-member-token');
      localStorage.removeItem('daren-member-name');
      location.reload();
    });
  } catch (error) {
    localStorage.removeItem('daren-member-token');
    localStorage.removeItem('daren-member-name');
    bindGuestForms();
    const loginAlert = document.getElementById('login-alert');
    loginAlert.hidden = false;
    loginAlert.textContent = readableError(error);
  }
}

loadMember();
