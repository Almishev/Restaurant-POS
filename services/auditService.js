const AuditLog = require("../models/auditLogModel");

async function writeAudit(entry) {
  try {
    await AuditLog.create({
      action: entry.action,
      userId: entry.userId || "",
      userName: entry.userName || "",
      entity: entry.entity || "",
      entityId: entry.entityId ? String(entry.entityId) : "",
      detail: entry.detail || "",
    });
  } catch (error) {
    console.log("[AUDIT]", error.message);
  }
}

module.exports = { writeAudit };
