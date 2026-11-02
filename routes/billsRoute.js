const express = require("express");
const {
  addBillsController,
  getBillsController,
  getReportController,
  createZReportController,
  closeShiftController,
  submitXReportController,
  getZReportsController,
  getZReportByIdController,
  getUnsynchronizedReportsController,
  checkZReportController,
  syncZReportController,
  getBillByIdController,
  getDashboardController,
  getInventoryReportController,
  getFiscalStatusController,
  printXReportController,
  getOpenRoomsController,
  retryHotelPostController,
  getHotelLinkController,
  getNapExportController,
} = require("./../controllers/billsController");
const { requireAuth, requireAdmin, requireReviewer } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/fiscal-status", requireAuth, getFiscalStatusController);
router.post("/print-x-report", requireAdmin, printXReportController);
router.get("/hotel-link", requireAuth, getHotelLinkController);
router.get("/nap-export", requireReviewer, getNapExportController);
router.post("/add-bills", requireAuth, addBillsController);
router.post("/retry-hotel/:id", requireAuth, retryHotelPostController);
router.get("/open-rooms", requireAuth, getOpenRoomsController);
router.get("/get-bills", requireAuth, getBillsController);
router.get("/get-bill/:id", requireAuth, getBillByIdController);

router.get("/get-report", requireAuth, getReportController);
router.post("/close-shift", requireAuth, closeShiftController);
router.post("/submit-x-report", requireAuth, submitXReportController);
router.post("/create-z-report", requireAdmin, createZReportController);

router.get("/z-reports", requireReviewer, getZReportsController);
router.get("/z-reports/:id", requireReviewer, getZReportByIdController);

router.get("/unsynchronized-reports", requireAdmin, getUnsynchronizedReportsController);
router.get("/check-z-report", requireAdmin, checkZReportController);
router.post("/sync-z-report/:reportId", requireAdmin, syncZReportController);

router.get("/dashboard", requireAdmin, getDashboardController);
router.get("/inventory-report", requireAdmin, getInventoryReportController);

module.exports = router;
