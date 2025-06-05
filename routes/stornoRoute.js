const express = require("express");
const {
  createStornoController,
  getStornosController,
  getStornoDetailsController,
  getStornoReportController
} = require("../controllers/stornoController");
const Users = require("../models/userModel");

const router = express.Router();

// Middleware за проверка на админ
const checkAdmin = async (req, res, next) => {
  try {
    let userId = req.body.userId || req.query.userId;
    if (!userId && req.method === 'GET' && req.params.id) {
      // за get-storno/:id
      const storno = await require("../models/stornoModel").findById(req.params.id);
      userId = storno?.userId;
    }
    if (!userId) return res.status(403).json({ message: "Липсва userId!" });
    const user = await Users.findOne({ userId });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "Само администратор може да достъпва сторно!" });
    }
    next();
  } catch (e) {
    res.status(500).json({ message: "Грешка при проверка на права!" });
  }
};

// Създаване на сторно бон
router.post("/create-storno", checkAdmin, createStornoController);

// Вземане на всички сторно бонове
router.get("/get-stornos", checkAdmin, getStornosController);

// Вземане на детайли за конкретно сторно
router.get("/get-storno/:id", checkAdmin, getStornoDetailsController);

// Генериране на отчет за сторно операциите
router.get("/report", checkAdmin, getStornoReportController);

module.exports = router;
