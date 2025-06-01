const express = require("express");
const {
  addBillsController,
  getBillsController,
  getReportController,
  createZReportController,
  getZReportsController,
  syncZReportController
} = require("./../controllers/billsController");

const router = express.Router();

//routes

//MEthod - POST
router.post("/add-bills", addBillsController);

//MEthod - GET
router.get("/get-bills", getBillsController);

// X/Z отчет
router.get("/get-report", getReportController);

// Създаване на Z отчет
router.post("/create-z-report", createZReportController);

router.get("/z-reports", getZReportsController);

// Синхронизация на Z отчет
router.post("/sync-z-report/:reportId", syncZReportController);

module.exports = router;
