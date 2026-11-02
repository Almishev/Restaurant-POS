const express = require("express");
const {
  createStornoController,
  createPreBillStornoController,
  getStornosController,
  getStornoDetailsController,
  getStornoReportController,
  retryHotelStornoController,
} = require("../controllers/stornoController");
const { requireAdmin, requireAuth, requireReviewer } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/create-storno", requireAdmin, createStornoController);
/** Waiters can cancel sent (not-ready) items before bill */
router.post("/create-pre-bill-storno", requireAuth, createPreBillStornoController);
router.post("/retry-hotel/:id", requireAdmin, retryHotelStornoController);
router.get("/get-stornos", requireReviewer, getStornosController);
router.get("/get-storno/:id", requireReviewer, getStornoDetailsController);
router.get("/report", requireReviewer, getStornoReportController);

module.exports = router;
