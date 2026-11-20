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
        body: { email: form.email.value, password: form.password.value }
      });
      saveMember(result);
    } catch (error) {
      loginAlert.hidden = false;
      loginAlert.textContent = readableError(error);
    }
  });
  document.getElementById('register-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    registerAlert.hidden = true;
    const form = event.target;
    try {
      const result = await api('/members/register', {
        method: 'POST',
        body: {
          name: form.name.value,
          email: form.email.value,
          password: form.password.value,
          phone: form.phone.value
        }
      });
      saveMember(result);
    } catch (error) {
      registerAlert.hidden = false;
      registerAlert.textContent = readableError(error);
    }
  });
}

async function loadAccount() {
  const token = localStorage.getItem('daren-member-token');
  if (!token) {
    bindGuestForms();
    return;
  }
  try {
    const member = await api('/members/me', { auth: 'member' });
    const orders = await api('/members/orders', { auth: 'member' });
    localStorage.setItem('daren-member-name', member.name);
    initCommon();
    document.getElementById('guest-panel').hidden = true;
    const panel = document.getElementById('member-panel');
    panel.hidden = false;
    document.getElementById('member-title').textContent = `${member.name} 的訂單`;
    document.getElementById('member-meta').textContent = `${member.email}${member.phone ? `　${member.phone}` : ''}`;
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

loadAccount();
