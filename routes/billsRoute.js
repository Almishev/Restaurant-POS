const express = require("express");
const {
  addBillsController,
  getBillsController,
  getReportController,
  createZReportController,
  getZReportsController,
  getZReportByIdController,
  getUnsynchronizedReportsController,
  checkZReportController,
  syncZReportController,
  getBillByIdController,
  getDashboardController,
  getInventoryReportController,
  getFiscalStatusController,
  getOpenRoomsController,
} = require("./../controllers/billsController");
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/fiscal-status", requireAdmin, getFiscalStatusController);
router.post("/add-bills", requireAuth, addBillsController);
router.get("/open-rooms", requireAuth, getOpenRoomsController);
router.get("/get-bills", requireAuth, getBillsController);
router.get("/get-bill/:id", requireAuth, getBillByIdController);

router.get("/get-report", requireAuth, getReportController);
router.post("/create-z-report", requireAdmin, createZReportController);

router.get("/z-reports", requireAdmin, getZReportsController);
router.get("/z-reports/:id", requireAdmin, getZReportByIdController);

router.get("/unsynchronized-reports", requireAdmin, getUnsynchronizedReportsController);
router.get("/check-z-report", requireAdmin, checkZReportController);
router.post("/sync-z-report/:reportId", requireAdmin, syncZReportController);

router.get("/dashboard", requireAdmin, getDashboardController);
router.get("/inventory-report", requireAdmin, getInventoryReportController);

module.exports = router;
