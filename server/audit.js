function writeAudit(db, entry) {
  db.prepare(`
    INSERT INTO audit_logs (admin_id, action, target_type, target_id, detail, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    entry.adminId ?? null,
    entry.action,
    entry.targetType ?? null,
    entry.targetId != null ? String(entry.targetId) : null,
    entry.detail ? JSON.stringify(entry.detail) : null,
    entry.ip ?? null
  );
}

module.exports = { writeAudit };
