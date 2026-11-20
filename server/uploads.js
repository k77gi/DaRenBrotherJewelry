const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { HttpError } = require('./httpError');

const uploadDir = path.join(__dirname, '..', 'data', 'uploads');
const MAX_BYTES = 2 * 1024 * 1024;

const TYPES = [
  { mime: 'image/jpeg', ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', ext: 'gif', bytes: [0x47, 0x49, 0x46] },
  { mime: 'image/webp', ext: 'webp', bytes: [0x52, 0x49, 0x46, 0x46] }
];

function readRequest(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES + 64 * 1024) {
        reject(new HttpError(400, '圖片請小於 2MB'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseFile(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!match) throw new HttpError(400, '請選擇圖片檔案');
  const boundary = `--${(match[1] || match[2]).trim()}`;
  const text = buffer.toString('latin1');
  const parts = text.split(boundary).slice(1, -1);
  const part = parts.find((item) => /name="file"/.test(item.slice(0, 500)));
  if (!part) throw new HttpError(400, '請選擇圖片檔案');
  const splitAt = part.indexOf('\r\n\r\n');
  if (splitAt < 0) throw new HttpError(400, '圖片格式不正確');
  const header = part.slice(0, splitAt);
  let body = part.slice(splitAt + 4);
  if (body.endsWith('\r\n')) body = body.slice(0, -2);
  const file = Buffer.from(body, 'latin1');
  const mime = (header.match(/Content-Type:\s*([^\r\n]+)/i) || [])[1] || '';
  return { file, mime: mime.trim().toLowerCase() };
}

function detect(file, mime) {
  const found = TYPES.find((item) => file.length >= item.bytes.length
    && item.bytes.every((byte, index) => file[index] === byte));
  if (!found) throw new HttpError(400, '只接受 JPG、PNG、GIF 或 WEBP');
  if (mime && mime !== found.mime && mime !== 'application/octet-stream') {
    throw new HttpError(400, '只接受 JPG、PNG、GIF 或 WEBP');
  }
  if (found.ext === 'webp' && file.slice(8, 12).toString() !== 'WEBP') {
    throw new HttpError(400, '只接受 JPG、PNG、GIF 或 WEBP');
  }
  return found.ext;
}

async function saveUpload(req) {
  const buffer = await readRequest(req);
  const { file, mime } = parseFile(buffer, req.headers['content-type']);
  if (!file.length || file.length > MAX_BYTES) throw new HttpError(400, '圖片請小於 2MB');
  const ext = detect(file, mime);
  fs.mkdirSync(uploadDir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(uploadDir, name), file);
  return `/uploads/${name}`;
}

function cleanImagePath(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/^\/uploads\/[a-z0-9.-]+$/i.test(text)) throw new HttpError(400, '圖片路徑不正確');
  return text;
}

module.exports = { uploadDir, saveUpload, cleanImagePath };
