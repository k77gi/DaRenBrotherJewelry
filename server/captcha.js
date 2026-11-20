const crypto = require('crypto');

const captchas = new Map();
const TTL_MS = 5 * 60 * 1000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function prune() {
  const now = Date.now();
  for (const [id, row] of captchas) {
    if (row.expires <= now) captchas.delete(id);
  }
}

function createCaptcha() {
  prune();
  let code = '';
  for (let index = 0; index < 4; index += 1) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  const id = crypto.randomUUID();
  captchas.set(id, { code, expires: Date.now() + TTL_MS });
  const letters = [...code].map((char, index) => {
    const x = 16 + index * 32;
    const y = 32 + crypto.randomInt(-3, 4);
    const rotate = crypto.randomInt(-16, 17);
    return `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})" font-size="26" font-family="Georgia, serif" fill="#1f1b17">${char}</text>`;
  }).join('');
  const noise = Array.from({ length: 6 }, () => {
    const x1 = crypto.randomInt(0, 140);
    const y1 = crypto.randomInt(0, 48);
    const x2 = crypto.randomInt(0, 140);
    const y2 = crypto.randomInt(0, 48);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#b7a898" stroke-width="1"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="48" viewBox="0 0 140 48"><rect width="140" height="48" fill="#f6f1e8"/>${noise}${letters}</svg>`;
  return {
    id,
    image: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  };
}

function consumeCaptcha(id, answer) {
  const row = captchas.get(String(id || ''));
  if (row) captchas.delete(String(id));
  if (!row || row.expires <= Date.now()) return false;
  return String(answer || '').trim().toUpperCase() === row.code;
}

module.exports = { createCaptcha, consumeCaptcha };
