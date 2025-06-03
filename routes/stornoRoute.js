const express = require("express");
const {
  createStornoController,
  getStornosController,
  getStornoDetailsController,
  getStornoReportController
} = require("../controllers/stornoController");

const router = express.Router();

// Създаване на сторно бон
router.post("/create-storno", createStornoController);

// Вземане на всички сторно бонове
router.get("/get-stornos", getStornosController);

// Вземане на детайли за конкретно сторно
router.get("/get-storno/:id", getStornoDetailsController);

// Генериране на отчет за сторно операциите
router.get("/report", getStornoReportController);

module.exports = router;
