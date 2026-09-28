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
} = require("./../controllers/billsController");

const router = express.Router();

//routes

//MEthod - POST
router.post("/add-bills", addBillsController);

//MEthod - GET
router.get("/get-bills", getBillsController);

// Вземане на конкретен бон по ID
router.get("/get-bill/:id", getBillByIdController);

// X/Z отчет
router.get("/get-report", getReportController);

// Създаване на Z отчет
router.post("/create-z-report", createZReportController);

router.get("/z-reports", getZReportsController);
router.get("/z-reports/:id", getZReportByIdController);

router.get("/unsynchronized-reports", getUnsynchronizedReportsController);
router.get("/check-z-report", checkZReportController);

// Синхронизация на Z отчет
router.post("/sync-z-report/:reportId", syncZReportController);

module.exports = router;
