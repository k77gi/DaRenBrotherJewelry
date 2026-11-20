const bcrypt = require('bcryptjs');
const { HttpError } = require('./httpError');

const BCRYPT_ROUNDS = 10;
const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const CARD_KEYS = new Set([
  'cardnumber', 'cardno', 'pan', 'cvv', 'cvc', 'cvv2', 'securitycode',
  'expiry', 'expire', 'expmonth', 'expyear', 'creditcard'
]);

function hashPassword(password) {
  return bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
}

function isBcryptHash(hash) {
  return BCRYPT_PATTERN.test(String(hash || ''));
}

function verifyPassword(password, hash) {
  if (!isBcryptHash(hash)) return false;
  return bcrypt.compareSync(String(password), hash);
}

function sanitizePlain(value, max, label, { required = false } = {}) {
  let text = String(value ?? '').replace(/\0/g, '');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/javascript\s*:/gi, '');
  text = text.replace(/\son\w+\s*=/gi, '');
  text = text.trim();
  if (required && !text) throw new HttpError(400, `請填寫${label}`);
  if (text.length > max) throw new HttpError(400, `${label}請少於 ${max} 個字`);
  return text;
}

function luhnOk(digits) {
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function assertNoCardData(body) {
  const entries = Object.entries(body || {});
  for (const [key, value] of entries) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (CARD_KEYS.has(normalized)) {
      throw new HttpError(400, '本店不收集信用卡號或 CVV');
    }
    const text = typeof value === 'string' ? value : '';
    const groups = text.match(/(?:\d[ -]?){13,19}/g) || [];
    for (const group of groups) {
      const digits = group.replace(/\D/g, '');
      if (digits.length >= 13 && digits.length <= 19 && luhnOk(digits)) {
        throw new HttpError(400, '請勿在表單留下信用卡號');
      }
    }
  }
}

module.exports = {
  hashPassword,
  isBcryptHash,
  verifyPassword,
  sanitizePlain,
  assertNoCardData
};
