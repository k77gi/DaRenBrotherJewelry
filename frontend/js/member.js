function saveMember(result) {
  localStorage.setItem('daren-member-token', result.token);
  localStorage.setItem('daren-member-name', result.member.name);
  goAfterLogin();
}

function bindEnterForm() {
  const form = document.getElementById('enter-form');
  const alertBox = document.getElementById('login-alert');
  const facebookError = queryParam('facebook');
  if (facebookError) {
    alertBox.hidden = false;
    alertBox.textContent = facebookError;
  }
  const emailField = document.getElementById('email-field');
  const phoneField = document.getElementById('phone-field');
  const lineField = document.getElementById('line-field');
  const phoneButton = document.getElementById('use-phone');
  const lineButton = document.getElementById('use-line');
  const submitButton = document.getElementById('submit-enter');
  const setMethod = (method) => {
    form.method.value = method;
    emailField.hidden = method !== 'email';
    phoneField.hidden = method !== 'phone';
    lineField.hidden = method !== 'line';
    emailField.querySelector('input').required = method === 'email';
    phoneField.querySelector('input').required = method === 'phone';
    lineField.querySelector('input').required = method === 'line';
    if (method !== 'email') emailField.querySelector('input').value = '';
    if (method !== 'phone') phoneField.querySelector('input').value = '';
    if (method !== 'line') lineField.querySelector('input').value = '';
    phoneButton.textContent = method === 'phone' ? '改用電子郵件登入或註冊' : '以電話號碼登入或註冊';
    phoneButton.classList.toggle('is-active', method === 'phone');
    lineButton.textContent = method === 'line' ? '改用電子郵件登入或註冊' : '使用 LINE ID 登入或註冊';
    submitButton.textContent = '登入或註冊';
  };
  phoneButton.addEventListener('click', () => {
    setMethod(form.method.value === 'phone' ? 'email' : 'phone');
  });
  lineButton.addEventListener('click', () => {
    setMethod(form.method.value === 'line' ? 'email' : 'line');
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertBox.hidden = true;
    const method = form.method.value;
    try {
      const account = method === 'phone' ? form.phone.value : (method === 'line' ? form.lineId.value : form.email.value);
      const result = await api('/members/enter', {
        method: 'POST',
        body: {
          method,
          name: form.name.value,
          account,
          password: form.password.value
        }
      });
      saveMember(result);
    } catch (error) {
      alertBox.hidden = false;
      alertBox.textContent = readableError(error);
    }
  });
}

if (localStorage.getItem('daren-member-token')) {
  location.replace(siteUrl('/profile.html'));
} else {
  bindEnterForm();
}
