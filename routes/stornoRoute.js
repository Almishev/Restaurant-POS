const express = require("express");
const {
  createStornoController,
  createPreBillStornoController,
  getStornosController,
  getStornoDetailsController,
  getStornoReportController,
} = require("../controllers/stornoController");
const { requireAdmin, requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/create-storno", requireAdmin, createStornoController);
/** Waiters can cancel sent (not-ready) items before bill */
router.post("/create-pre-bill-storno", requireAuth, createPreBillStornoController);
router.get("/get-stornos", requireAdmin, getStornosController);
router.get("/get-storno/:id", requireAdmin, getStornoDetailsController);
router.get("/report", requireAdmin, getStornoReportController);

module.exports = router;
