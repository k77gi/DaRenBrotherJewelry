const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../db');
const { HttpError } = require('../httpError');

function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

function readToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return jwt.verify(match[1], config.jwtSecret);
  } catch (error) {
    throw new HttpError(401, '登入已過期，請重新登入');
  }
}

function requireMember(req, res, next) {
  try {
    const payload = readToken(req);
    if (!payload || payload.typ !== 'member') throw new HttpError(401, '請先登入會員');
    req.auth = payload;
    next();
  } catch (error) {
    next(error);
  }
}

function optionalMember(req, res, next) {
  if (!req.headers.authorization) return next();
  try {
    const payload = readToken(req);
    if (payload && payload.typ === 'member') req.auth = payload;
    next();
  } catch (error) {
    next(error);
  }
}

async function requireAdmin(req, res, next) {
  try {
    const payload = readToken(req);
    if (!payload || payload.typ !== 'admin') throw new HttpError(401, '請先登入管理後台');
    const admin = await getDb().prepare(`
      SELECT a.id, a.name, a.username, a.is_active,
             r.code AS role_code, r.name AS role_name, r.role_level
      FROM admins a
      JOIN roles r ON r.id = a.role_id
      WHERE a.id = ?
    `).get(payload.id);
    if (!admin || !admin.is_active) throw new HttpError(401, '請先登入管理後台');
    const permissions = (await getDb().prepare(`
      SELECT p.code
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN admins a ON a.role_id = rp.role_id
      WHERE a.id = ?
    `).all(admin.id)).map((row) => row.code);
    req.admin = {
      id: admin.id,
      name: admin.name,
      username: admin.username,
      roleCode: admin.role_code,
      roleName: admin.role_name,
      roleLevel: admin.role_level,
      permissions
    };
    next();
  } catch (error) {
    next(error);
  }
}

function allows(req, ...codes) {
  return codes.some((code) => req.admin.permissions.includes(code));
}

function requireAny(...codes) {
  return (req, res, next) => {
    if (allows(req, ...codes)) return next();
    next(new HttpError(403, '你的權限不足，無法檢視這項資料'));
  };
}

function requirePermission(...codes) {
  return (req, res, next) => {
    const missing = codes.filter((code) => !req.admin.permissions.includes(code));
    if (missing.length === 0) return next();
    next(new HttpError(403, '你的權限不足，無法執行這項操作'));
  };
}

module.exports = {
  signToken,
  requireMember,
  optionalMember,
  requireAdmin,
  allows,
  requireAny,
  requirePermission
};
