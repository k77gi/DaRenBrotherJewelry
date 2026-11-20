const { HttpError } = require('./httpError');

function route(handler) {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
}

function timestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function requestIp(req) {
  return req.ip || req.socket?.remoteAddress || '';
}

function requiredText(value, max, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new HttpError(400, `請填寫${label}`);
  if (text.length > max) throw new HttpError(400, `${label}請少於 ${max} 個字`);
  return text;
}

function optionalText(value, max, label) {
  const text = String(value ?? '').trim();
  if (text.length > max) throw new HttpError(400, `${label}請少於 ${max} 個字`);
  return text;
}

function requiredEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    throw new HttpError(400, '請輸入有效的電子郵件');
  }
  return email;
}

function optionalPhone(value) {
  const phone = String(value ?? '').trim();
  if (!phone) return '';
  if (!/^[0-9+\-()\s]{6,20}$/.test(phone)) throw new HttpError(400, '電話格式不正確');
  return phone;
}

function requiredPhone(value) {
  const phone = optionalPhone(value);
  if (!phone) throw new HttpError(400, '請填寫電話');
  return phone;
}

function requiredInt(value, label, { min = 0, max = 10000000 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpError(400, `${label}格式不正確`);
  }
  return number;
}

function optionalNumber(value, label) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 10000) {
    throw new HttpError(400, `${label}格式不正確`);
  }
  return Math.round(number * 100) / 100;
}

function idParam(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, '編號不正確');
  return id;
}

module.exports = {
  route,
  timestamp,
  requestIp,
  requiredText,
  optionalText,
  requiredEmail,
  optionalPhone,
  requiredPhone,
  requiredInt,
  optionalNumber,
  idParam
};
