const mongoose = require("mongoose");

const auditLogSchema = mongoose.Schema(
  {
    action: { type: String, required: true },
    userId: { type: String, default: "" },
    userName: { type: String, default: "" },
    entity: { type: String, default: "" },
    entityId: { type: String, default: "" },
    detail: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("auditLogs", auditLogSchema);
