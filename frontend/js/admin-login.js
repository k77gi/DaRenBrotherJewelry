const form = document.getElementById('login-form');
const alertBox = document.getElementById('login-alert');
const captchaImage = document.getElementById('captcha-image');

async function loadCaptcha() {
  const captcha = await api('/admin/captcha');
  form.captchaId.value = captcha.id;
  form.captchaCode.value = '';
  captchaImage.src = captcha.image;
}

document.getElementById('captcha-refresh').addEventListener('click', () => {
  loadCaptcha().catch((error) => {
    alertBox.hidden = false;
    alertBox.textContent = readableError(error);
  });
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  alertBox.hidden = true;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await api('/admin/login', {
      method: 'POST',
      body: {
        username: form.username.value,
        password: form.password.value,
        captchaId: form.captchaId.value,
        captchaCode: form.captchaCode.value
      }
    });
    localStorage.setItem('daren-admin-token', result.token);
    location.href = siteUrl('/admin/index.html');
  } catch (error) {
    alertBox.hidden = false;
    alertBox.textContent = readableError(error);
    button.disabled = false;
    loadCaptcha().catch(() => {});
  }
});

loadCaptcha().catch((error) => {
  alertBox.hidden = false;
  alertBox.textContent = readableError(error);
});
