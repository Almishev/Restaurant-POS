const billsModel = require("../models/billsModel");
const Report = require("../models/reportModel");
const fiscalService = require("../services/fiscalService");
const hotelPmsService = require("../services/hotelPmsService");
const Recipe = require("../models/recipeModel");
const Inventory = require("../models/inventoryModel");
const { buildSalesReport, buildByHour, isRoomCharge } = require("../utils/buildSalesReport");
const Item = require("../models/itemModel");
const Storno = require("../models/stornoModel");
const mongoose = require("mongoose");

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

async function nextReportNumber(type) {
  const last = await Report.findOne({
    type,
    reportNumber: { $type: "number" },
  })
    .sort({ reportNumber: -1 })
    .select("reportNumber")
    .lean();
  return (last?.reportNumber || 0) + 1;
}

async function saveReportWithNumber(fields) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reportNumber = await nextReportNumber(fields.type);
    try {
      const report = new Report({ ...fields, reportNumber });
      await report.save();
      return report;
    } catch (error) {
      lastError = error;
      if (error && error.code === 11000) continue;
      throw error;
    }
  }
  throw lastError;
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

async function deductInventory(cartItems, userId) {
  for (const cartItem of cartItems || []) {
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
            user: userId || "sale",
            note: `Продажба на ${cartItem.name}`,
          });
          await inventory.save();
        }
      }
    }
  }
}

async function addRoomBill(req, res) {
  const bookingId = req.body.hotelBookingId;
  const amount = Number(req.body.totalAmount);
  if (!bookingId) {
    return res.status(400).json({ message: "Изберете стая" });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: "Сумата трябва да е по-голяма от нула" });
  }

  const billId = new mongoose.Types.ObjectId();
  try {
    await hotelPmsService.postRoomCharge({
      bookingId,
      billId: String(billId),
      tableName: req.body.tableName || req.body.customerName || "",
      amount,
    });
  } catch (error) {
    return res.status(error.status || 502).json({
      message: error.message || "Хотелът не е свързан",
    });
  }

  try {
    const newBill = new billsModel({
      ...req.body,
      _id: billId,
      paymentMode: "На стая",
      fiscalStatus: "n/a",
      hotelBookingId: String(bookingId),
      hotelRoomNumber: req.body.hotelRoomNumber || "",
      hotelGuestName: req.body.hotelGuestName || "",
    });
    await newBill.save();
    try {
      await deductInventory(req.body.cartItems, req.body.userId);
    } catch (inventoryError) {
      console.log("[BILL] Inventory error:", inventoryError);
    }
    return res.send("Bill Created Successfully!");
  } catch (error) {
    console.log("[BILL] Room charge save failed:", error);
    try {
      await hotelPmsService.stornoRoomCharge(String(billId), amount, `rollback-${billId}`);
    } catch (rollbackError) {
      console.log("[BILL] Hotel rollback failed:", rollbackError.message);
    }
    return res.status(500).json({
      message: "Сметката не беше записана и качването към стаята е отменено",
    });
  }
}

const addBillsController = async (req, res) => {
  try {
    if (isRoomCharge(req.body.paymentMode)) {
      return await addRoomBill(req, res);
    }

    const newBill = new billsModel({
      ...req.body,
      fiscalStatus: "pending",
    });
    await newBill.save();
    await deductInventory(req.body.cartItems, req.body.userId);

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
      } else if (paymentMode === "room" || paymentMode === "На стая") {
        query.paymentMode = { $in: ["room", "На стая"] };
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
    filter.includedInShiftReport = { $ne: true };
    const bills = await billsModel.find(filter);

    const base = buildSalesReport(bills);
    let byCategory = {};
    try {
      byCategory = await buildCategoryBreakdown(bills);
    } catch (e) {
      console.log("[GET REPORT] Category breakdown skipped:", e.message);
    }
    const byHour = buildByHour(bills);

    const stornoQuery = {};
    if (from && to) {
      stornoQuery.createdAt = { $gte: new Date(from), $lte: new Date(to) };
    }
    if (resolvedUserId) stornoQuery.userId = resolvedUserId;
    stornoQuery.includedInShiftReport = { $ne: true };
    const stornoDocs = await Storno.find(stornoQuery).sort({ createdAt: -1 }).lean();
    const preBillStornos = stornoDocs.filter((s) => s.type === "pre_bill");
    const billStornos = stornoDocs.filter((s) => s.type !== "pre_bill");
    const stornoAmount = stornoDocs.reduce(
      (sum, item) => sum + (Number(item.totalAmount) || 0),
      0
    );

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
    const roomBills = bills.filter((bill) => isRoomCharge(bill.paymentMode));
    const fiscalBills = bills.filter((bill) => !isRoomCharge(bill.paymentMode));
    const roomAmount = roomBills.reduce((sum, bill) => sum + (Number(bill.totalAmount) || 0), 0);
    const { totalAmount, totalBills, byPayment, items } = buildSalesReport(fiscalBills);

    const report = await saveReportWithNumber({
      type: "Z",
      from: new Date(from),
      to: new Date(to),
      userId,
      totalAmount,
      totalBills,
      netAmount: totalAmount,
      byPayment,
      items,
      bills: fiscalBills,
      roomAmount,
      roomBillCount: roomBills.length,
    });

    const billIds = fiscalBills.map((b) => b._id);
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

const closeShiftController = async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ message: "Избери период!" });
    }
    const isAdmin = req.authUser?.role === "admin";
    const userId = isAdmin ? req.body.userId : req.authUser?.userId;
    if (!isAdmin && !userId) {
      return res.status(401).json({ message: "Неоторизиран достъп — липсва userId" });
    }

    const filter = {
      isStornoed: { $ne: true },
      includedInShiftReport: { $ne: true },
      date: { $gte: new Date(from), $lte: new Date(to) },
    };
    if (userId) filter.userId = userId;

    const stornoQuery = {
      includedInShiftReport: { $ne: true },
      createdAt: { $gte: new Date(from), $lte: new Date(to) },
    };
    if (userId) stornoQuery.userId = userId;

    const bills = await billsModel.find(filter);
    const stornoDocs = await Storno.find(stornoQuery).sort({ createdAt: -1 }).lean();
    if (!bills.length && !stornoDocs.length) {
      return res.status(400).json({ message: "Няма неприключени сметки за този период." });
    }

    const roomBills = bills.filter((bill) => isRoomCharge(bill.paymentMode));
    bills.forEach((bill) => {
      bill.includedInShiftReport = true;
    });
    stornoDocs.forEach((item) => {
      item.includedInShiftReport = true;
    });
    const { totalAmount, totalBills, byPayment, items } = buildSalesReport(bills);
    const stornoAmount = stornoDocs.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
    const preBillStornos = stornoDocs.filter((item) => item.type === "pre_bill");
    const billStornos = stornoDocs.filter((item) => item.type !== "pre_bill");
    let byCategory = {};
    try {
      byCategory = await buildCategoryBreakdown(bills);
    } catch (categoryError) {
      console.log("[CLOSE SHIFT] Category breakdown skipped:", categoryError.message);
    }

    const report = await saveReportWithNumber({
      type: "shift",
      from: new Date(from),
      to: new Date(to),
      userId: userId || undefined,
      totalAmount,
      totalBills,
      stornoAmount,
      netAmount: totalAmount - stornoAmount,
      byPayment,
      items,
      bills,
      stornos: stornoDocs,
      roomAmount: roomBills.reduce((sum, bill) => sum + (Number(bill.totalAmount) || 0), 0),
      roomBillCount: roomBills.length,
    });

    const billIds = bills.map((bill) => bill._id);
    if (billIds.length) {
      await billsModel.updateMany(
        { _id: { $in: billIds } },
        { $set: { includedInShiftReport: true, shiftReportId: report._id } }
      );
    }
    const stornoIds = stornoDocs.map((item) => item._id);
    if (stornoIds.length) {
      await Storno.updateMany(
        { _id: { $in: stornoIds } },
        { $set: { includedInShiftReport: true, shiftReportId: report._id } }
      );
    }

    res.json({
      ...report.toObject(),
      preBillStornos,
      billStornos,
      byCategory,
      byHour: buildByHour(bills),
      stornoAmount,
      netAmount: totalAmount - stornoAmount,
    });
  } catch (error) {
    console.log(`[CLOSE SHIFT] ${error.message}`);
    res.status(500).json({ message: "Грешка при приключване на смяната!", error: error.message });
  }
};

const getZReportsController = async (req, res) => {
  try {
    const reports = await Report.find({ type: { $in: ["Z", "shift"] } }).sort({ createdAt: -1 });
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
    const existing = await Report.findById(reportId);
    if (existing && existing.type === "shift") {
      return res.status(400).json({ message: "Смяната не се синхронизира с фискалния принтер" });
    }
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

const getOpenRoomsController = async (req, res) => {
  try {
    const rooms = await hotelPmsService.getOpenRooms();
    res.json(rooms);
  } catch (error) {
    res.status(error.status || 503).json({
      message: error.message || "Хотелът не е свързан",
    });
  }
};

module.exports = {
  addBillsController,
  getBillsController,
  getOpenRoomsController,
  getReportController,
  createZReportController,
  closeShiftController,
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
