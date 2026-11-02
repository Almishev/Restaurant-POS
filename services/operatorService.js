const User = require("../models/userModel");

async function resolveOperator(userId) {
  let user = null;
  if (userId && /^[0-9a-fA-F]{24}$/.test(String(userId))) {
    user = await User.findById(userId).lean();
  }
  if (!user && userId) {
    user = await User.findOne({ userId: String(userId) }).lean();
  }
  const code = String(user?.fiscalOperatorCode || process.env.FISCAL_OPERATOR || "1")
    .replace(/\D/g, "")
    .padStart(4, "0")
    .slice(-4);
  const password = String(
    user?.fiscalOperatorPassword || process.env.FISCAL_OPERATOR_PASSWORD || "1"
  );
  return {
    code,
    password,
    name: user?.name || "",
    userId: user?.userId || String(userId || ""),
  };
}

module.exports = { resolveOperator };
