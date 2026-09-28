const Users = require("../models/userModel");

/**
 * Auth via headers from localStorage:
 *   x-user-id — login userId string
 * Fallback: body/query userId for older callers.
 */
async function requireAuth(req, res, next) {
  try {
    const headerUserId = req.headers["x-user-id"];
    const bodyUserId = req.body?.userId || req.query?.userId;
    const userId = headerUserId || bodyUserId;
    if (!userId) {
      return res.status(401).json({ message: "Неоторизиран достъп — липсва userId" });
    }
    const user = await Users.findOne({ userId: String(userId) });
    if (!user) {
      return res.status(401).json({ message: "Неоторизиран достъп — потребителят не е намерен" });
    }
    req.authUser = {
      userId: user.userId,
      name: user.name,
      role: user.role,
      _id: user._id,
    };
    next();
  } catch (e) {
    res.status(500).json({ message: "Грешка при автентикация" });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const headerUserId = req.headers["x-user-id"];
    const bodyUserId = req.body?.userId || req.query?.userId;
    const userId = headerUserId || bodyUserId;
    if (!userId) {
      return res.status(401).json({ message: "Неоторизиран достъп — липсва userId" });
    }
    const user = await Users.findOne({ userId: String(userId) });
    if (!user) {
      return res.status(401).json({ message: "Неоторизиран достъп — потребителят не е намерен" });
    }
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Само администратор има достъп!" });
    }
    req.authUser = {
      userId: user.userId,
      name: user.name,
      role: user.role,
      _id: user._id,
    };
    next();
  } catch (e) {
    res.status(500).json({ message: "Грешка при автентикация" });
  }
}

module.exports = { requireAuth, requireAdmin };
