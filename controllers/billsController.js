const billsModel = require("../models/billsModel");
const Report = require("../models/reportModel");
const fiscalService = require("../services/fiscalService");
const Recipe = require("../models/recipeModel");
const Inventory = require("../models/inventoryModel");
const { buildSalesReport, buildByHour } = require("../utils/buildSalesReport");
const Item = require("../models/itemModel");
const Storno = require("../models/stornoModel");

async function resolveReportUserFilter(userId) {
  if (!userId) return null;
  const User = require("../models/userModel");
  try {
    if (/^[0-9a-fA-F]{24}$/.test(userId)) {
      const user = await User.findById(userId);
      if (user) return user.userId;
    }
  } catch (_) {
    /* use as-is */
  }
  return userId;
}

async function buildCategoryBreakdown(bills) {
  const byCategory = {};
  const itemIds = new Set();
  bills.forEach((bill) => {
    (bill.cartItems || []).forEach((item) => {
      if (item._id) itemIds.add(String(item._id));
    });
  });
  const items = await Item.find({ _id: { $in: Array.from(itemIds) } }).lean();
  const idToCategory = {};
  items.forEach((it) => {
    idToCategory[String(it._id)] = it.category || "Без категория";
  });

  bills.forEach((bill) => {
    (bill.cartItems || []).forEach((item) => {
      const cat =
        idToCategory[String(item._id)] || item.category || "Без категория";
      if (!byCategory[cat]) byCategory[cat] = { quantity: 0, total: 0 };
      byCategory[cat].quantity += Number(item.quantity) || 0;
      byCategory[cat].total +=
        (Number(item.price) || 0) * (Number(item.quantity) || 0);
    });
  });
  return byCategory;
}

async function sumStornoForPeriod(from, to, userId) {
  const query = {};
  if (from && to) {
    query.createdAt = { $gte: new Date(from), $lte: new Date(to) };
  }
  if (userId) query.userId = userId;
  const stornos = await Storno.find(query).lean();
  return stornos.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
}

const addBillsController = async (req, res) => {
  try {
    const newBill = new billsModel({
      ...req.body,
      fiscalStatus: "pending",
    });
    await newBill.save();

    for (const cartItem of req.body.cartItems || []) {
      const recipe = await Recipe.findOne({ item: cartItem._id });
      if (recipe) {
        for (const ing of recipe.ingredients) {
          const inventory = await Inventory.findById(ing.inventory);
          if (inventory) {
            const amountToDeduct = ing.quantity * cartItem.quantity;
            inventory.quantity =
              Math.round((inventory.quantity - amountToDeduct) * 100) / 100;
            inventory.history.push({
              type: "out",
              amount: amountToDeduct,
              user: req.body.userId || "sale",
              note: `Продажба на ${cartItem.name}`,
            });
            await inventory.save();
          }
        }
      }
    }

    try {
      const fiscalResult = await fiscalService.printReceipt(newBill);
      newBill.fiscalReceiptId = fiscalResult.fiscalReceiptId;
      newBill.fiscalReceiptDateTime = fiscalResult.receiptDateTime;
      newBill.fiscalMemorySerialNumber = fiscalResult.fiscalMemorySerialNumber;
      newBill.fiscalDeviceSerialNumber = fiscalResult.fiscalDeviceSerialNumber;
      newBill.uniqueSaleNumber = fiscalResult.uniqueSaleNumber;
      newBill.fiscalStatus = "completed";
      newBill.fiscalErrorMessage = undefined;
      await newBill.save();
    } catch (fiscalError) {
      console.log("[BILL] Fiscal error:", fiscalError);
      newBill.fiscalStatus = "error";
      newBill.fiscalErrorMessage =
        fiscalError.message || "Грешка при фискализация";
      await newBill.save();
    }

    res.send("Bill Created Successfully!");
  } catch (error) {
    res.send("something went wrong");
    console.log(error);
  }
};

const getBillsController = async (req, res) => {
  try {
    const {
      role,
      userId,
      from,
      to,
      paymentMode,
      tableName,
      includeStornoed,
    } = req.query;

    let query = {};

    if (role !== "admin" && userId) {
      query = { userId };
    }

    if (from && to) {
      query.date = { $gte: new Date(from), $lte: new Date(to) };
    }
    if (paymentMode) {
      if (paymentMode === "cash" || paymentMode === "Брой") {
        query.paymentMode = { $in: ["cash", "Брой"] };
      } else if (paymentMode === "card" || paymentMode === "Карта") {
        query.paymentMode = { $in: ["card", "Карта"] };
      } else {
        query.paymentMode = paymentMode;
      }
    }
    if (tableName) {
      query.tableName = tableName;
    }

    if (includeStornoed !== "true" && includeStornoed !== "1") {
      query.isStornoed = { $ne: true };
    }

    const bills = await billsModel.find(query).sort({ date: -1 });
    res.send(bills);
  } catch (error) {
    console.log(error);
    res.status(500).send("Error fetching bills");
  }
};

const getReportController = async (req, res) => {
  try {
    const { from, to, userId } = req.query;

    const filter = {};
    if (from && to) {
      filter.date = { $gte: new Date(from), $lte: new Date(to) };
    }

    const resolvedUserId = await resolveReportUserFilter(userId);
    if (resolvedUserId) {
      filter.userId = resolvedUserId;
    }

    filter.isStornoed = { $ne: true };
    const bills = await billsModel.find(filter);

    const base = buildSalesReport(bills);
    let byCategory = {};
    try {
      byCategory = await buildCategoryBreakdown(bills);
    } catch (e) {
      console.log("[GET REPORT] Category breakdown skipped:", e.message);
    }
    const byHour = buildByHour(bills);
    const stornoAmount = await sumStornoForPeriod(
      from,
      to,
      resolvedUserId || undefined
    );

    const stornoQuery = {};
    if (from && to) {
      stornoQuery.createdAt = { $gte: new Date(from), $lte: new Date(to) };
    }
    if (resolvedUserId) stornoQuery.userId = resolvedUserId;
    const stornoDocs = await Storno.find(stornoQuery).sort({ createdAt: -1 }).lean();
    const preBillStornos = stornoDocs.filter((s) => s.type === "pre_bill");
    const billStornos = stornoDocs.filter((s) => s.type !== "pre_bill");

    res.json({
      ...base,
      byCategory,
      byHour,
      stornoAmount,
      netAmount: base.totalAmount - stornoAmount,
      preBillStornos,
      billStornos,
      stornos: stornoDocs,
      bills,
    });
  } catch (error) {
    console.log(`[GET REPORT] Грешка: ${error.message}`);
    res
      .status(500)
      .json({ message: "Грешка при генериране на отчет!", error: error.message });
  }
};

const createZReportController = async (req, res) => {
  try {
    const { from, to, userId } = req.body;
    const existing = await Report.findOne({
      type: "Z",
      from: new Date(from),
      to: new Date(to),
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Вече има Z отчет за този период!" });
    }
    const filter = {
      isStornoed: { $ne: true },
      includedInZReport: { $ne: true },
    };
    if (from && to) {
      filter.date = { $gte: new Date(from), $lte: new Date(to) };
    }
    if (userId) {
      filter.userId = userId;
    }

    const bills = await billsModel.find(filter);
    const { totalAmount, totalBills, byPayment, items } = buildSalesReport(bills);

    const report = new Report({
      type: "Z",
      from: new Date(from),
      to: new Date(to),
      userId,
      totalAmount,
      totalBills,
      byPayment,
      items,
      bills,
    });
    await report.save();

    const billIds = bills.map((b) => b._id);
    if (billIds.length) {
      await billsModel.updateMany(
        { _id: { $in: billIds } },
        { $set: { includedInZReport: true, zReportId: report._id } }
      );
    }

    // Optional: print Z on fiscal device when not in test mode
    try {
      if (!fiscalService.isTestMode) {
        const deviceZ = await fiscalService.printZReport();
        report.isSynchronized = true;
        report.synchronizedAt = new Date();
        report.isTestMode = false;
        report.fiscalReportId =
          deviceZ.fiscalReportId || deviceZ.receiptNumber || `FP-Z-${Date.now()}`;
        await report.save();
      } else {
        report.isSynchronized = true;
        report.synchronizedAt = new Date();
        report.isTestMode = true;
        report.fiscalReportId = report.fiscalReportId || `TEST-Z-${Date.now()}`;
        await report.save();
      }
    } catch (fiscalZErr) {
      console.log("[Z] Device Z print error:", fiscalZErr.message);
      report.isSynchronized = false;
      await report.save();
    }

    res.json(report);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Грешка при създаване на Z отчет!", error });
  }
};

const getZReportsController = async (req, res) => {
  try {
    const reports = await Report.find({ type: "Z" }).sort({ from: -1 });
    res.json(reports);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Грешка при зареждане на Z отчетите!", error });
  }
};

const getZReportByIdController = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Z отчетът не е намерен!" });
    }
    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: "Грешка при зареждане на Z отчета!",
      error: error.message,
    });
  }
};

const getUnsynchronizedReportsController = async (req, res) => {
  try {
    const reports = await Report.find({
      type: "Z",
      isSynchronized: false,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({
      message: "Грешка при зареждане на несинхронизирани отчети!",
      error: error.message,
    });
  }
};

/** Disabled auto-create of empty test Z — manual Z only */
const checkZReportController = async (req, res) => {
  try {
    res.json(null);
  } catch (error) {
    res.status(500).json({
      message: "Грешка при проверка за нов Z отчет!",
      error: error.message,
    });
  }
};

const syncZReportController = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await fiscalService.synchronizeZReport(reportId);
    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: "Грешка при синхронизация на Z отчет!",
      error: error.message,
    });
  }
};

const getBillByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await billsModel.findById(id);

    if (!bill) {
      return res.status(404).json({ error: "Бонът не е намерен" });
    }

    res.status(200).json(bill);
  } catch (error) {
    console.log("Грешка при вземане на бон по ID:", error);
    res
      .status(500)
      .json({ error: "Възникна грешка при вземане на данни за бона" });
  }
};

const getDashboardController = async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const bills = await billsModel.find({
      date: { $gte: start, $lte: end },
      isStornoed: { $ne: true },
    });
    const sales = buildSalesReport(bills);
    const stornoAmount = await sumStornoForPeriod(start, end);
    const stornoCount = await Storno.countDocuments({
      createdAt: { $gte: start, $lte: end },
    });

    const Table = require("../models/tableModel");
    const openTables = await Table.countDocuments({
      $or: [
        { "cartItems.0": { $exists: true } },
        { "pendingItems.0": { $exists: true } },
      ],
    });

    const topItems = Object.entries(sales.items)
      .map(([name, v]) => ({ name, quantity: v.quantity, total: v.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    res.json({
      date: start.toISOString().slice(0, 10),
      totalAmount: sales.totalAmount,
      netAmount: sales.totalAmount - stornoAmount,
      totalBills: sales.totalBills,
      byPayment: sales.byPayment,
      stornoAmount,
      stornoCount,
      openTables,
      topItems,
    });
  } catch (error) {
    console.log("[DASHBOARD]", error);
    res.status(500).json({
      message: "Грешка при зареждане на dashboard!",
      error: error.message,
    });
  }
};

const getFiscalStatusController = async (req, res) => {
  try {
    const status = await fiscalService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Грешка при проверка на фискалния статус",
      error: error.message,
    });
  }
};

const getInventoryReportController = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 864e5);
    const toDate = to ? new Date(to) : new Date();

    const inventories = await Inventory.find({}).lean();
    const movements = [];

    inventories.forEach((inv) => {
      (inv.history || []).forEach((h) => {
        const d = new Date(h.date || h.createdAt || Date.now());
        if (d >= fromDate && d <= toDate) {
          movements.push({
            inventoryId: inv._id,
            name: inv.name,
            unit: inv.unit,
            type: h.type,
            amount: h.amount,
            note: h.note,
            user: h.user,
            date: d,
          });
        }
      });
    });

    const consumption = {};
    const restores = {};
    movements.forEach((m) => {
      const key = m.name;
      if (m.type === "out") {
        consumption[key] =
          Math.round(((consumption[key] || 0) + Number(m.amount || 0)) * 100) / 100;
      } else if (m.type === "in") {
        restores[key] =
          Math.round(((restores[key] || 0) + Number(m.amount || 0)) * 100) / 100;
      }
    });

    res.json({
      from: fromDate,
      to: toDate,
      movements: movements.sort((a, b) => new Date(b.date) - new Date(a.date)),
      consumption,
      restores,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Грешка при складов отчет!", error: error.message });
  }
};

module.exports = {
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
};
