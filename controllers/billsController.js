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
const { writeAudit } = require("../services/auditService");
const { resolveOperator } = require("../services/operatorService");

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

async function withTaxGroups(cartItems) {
  const ids = (cartItems || []).map((item) => item._id).filter(Boolean);
  const stored = ids.length ? await Item.find({ _id: { $in: ids } }).lean() : [];
  const taxById = {};
  stored.forEach((item) => {
    taxById[String(item._id)] = item.taxGroup;
  });
  return (cartItems || []).map((item) => ({
    ...item,
    taxGroup: Number(item.taxGroup) || taxById[String(item._id)] || undefined,
  }));
}

async function pushRoomCharge(bill) {
  await hotelPmsService.postRoomCharge({
    bookingId: bill.hotelBookingId,
    billId: String(bill._id),
    tableName: bill.tableName || bill.customerName || "",
    amount: bill.totalAmount,
    uniqueSaleNumber: bill.uniqueSaleNumber,
    fiscalReceiptId: bill.fiscalReceiptId,
    fiscalReceiptDateTime: bill.fiscalReceiptDateTime,
    fiscalMemorySerialNumber: bill.fiscalMemorySerialNumber,
    fiscalDeviceSerialNumber: bill.fiscalDeviceSerialNumber,
  });
}

const addBillsController = async (req, res) => {
  try {
    const roomCharge = isRoomCharge(req.body.paymentMode);
    const amount = Number(req.body.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Сумата трябва да е по-голяма от нула" });
    }
    if (roomCharge) {
      if (!hotelPmsService.isConfigured()) {
        return res.status(400).json({ message: "Плащане «На стая» не е включено" });
      }
      if (!req.body.hotelBookingId) {
        return res.status(400).json({ message: "Изберете стая" });
      }
    }

    const paymentType = fiscalService.mapPaymentType(roomCharge ? "На стая" : req.body.paymentMode);
    let cashReceived;
    let cashChange;
    if (paymentType === "cash") {
      const raw = req.body.cashReceived;
      if (raw === undefined || raw === null || raw === "") {
        cashReceived = amount;
        cashChange = 0;
      } else {
        cashReceived = Math.round(Number(raw) * 100) / 100;
        if (!Number.isFinite(cashReceived) || cashReceived + 0.001 < amount) {
          return res.status(400).json({ message: "Получените пари са по-малко от сметката" });
        }
        cashChange = Math.round((cashReceived - amount) * 100) / 100;
      }
    }

    const fiscalStatus = await fiscalService.getStatus();
    if (!fiscalStatus.ok) {
      return res.status(503).json({
        message: fiscalStatus.error || "Фискалното устройство не отговаря",
      });
    }

    const cartItems = await withTaxGroups(req.body.cartItems);
    const billId = new mongoose.Types.ObjectId();
    const operator = await resolveOperator(req.body.userId);
    const draft = {
      ...req.body,
      _id: billId,
      cartItems,
      paymentMode: roomCharge ? "На стая" : req.body.paymentMode,
      fiscalStatus: "pending",
      hotelBookingId: roomCharge ? String(req.body.hotelBookingId) : undefined,
      hotelRoomNumber: roomCharge ? req.body.hotelRoomNumber || "" : undefined,
      hotelGuestName: roomCharge ? req.body.hotelGuestName || "" : undefined,
      cashReceived,
      cashChange,
    };

    let fiscalResult;
    try {
      fiscalResult = await fiscalService.printReceipt(draft, operator);
    } catch (fiscalError) {
      console.log("[BILL] Fiscal error:", fiscalError);
      return res.status(502).json({
        message: fiscalError.message || "Фискалното устройство отказа бона",
      });
    }

    const newBill = new billsModel({
      ...draft,
      fiscalReceiptId: fiscalResult.fiscalReceiptId,
      fiscalReceiptDateTime: fiscalResult.receiptDateTime,
      fiscalMemorySerialNumber: fiscalResult.fiscalMemorySerialNumber,
      fiscalDeviceSerialNumber: fiscalResult.fiscalDeviceSerialNumber,
      uniqueSaleNumber: fiscalResult.uniqueSaleNumber,
      fiscalStatus: "completed",
      hotelPostStatus: roomCharge ? "pending" : "",
    });

    try {
      await newBill.save();
    } catch (error) {
      console.log("[BILL] Save failed after fiscal receipt:", error);
      try {
        await fiscalService.printStornoBon(
          newBill,
          `rollback-${billId}`,
          "operatorError",
          cartItems,
          operator
        );
      } catch (rollbackError) {
        console.log("[BILL] Fiscal rollback failed:", rollbackError.message);
      }
      return res.status(500).json({
        message: "Сметката не беше записана и фискалният бон е сторниран",
      });
    }

    try {
      await deductInventory(cartItems, req.body.userId);
    } catch (inventoryError) {
      console.log("[BILL] Inventory error:", inventoryError);
    }

    await writeAudit({
      action: "sale",
      userId: operator.userId,
      userName: operator.name,
      entity: "bill",
      entityId: newBill._id,
      detail: `${newBill.paymentMode} ${newBill.uniqueSaleNumber} €${amount.toFixed(2)}`,
    });

    if (!roomCharge) {
      return res.send("Bill Created Successfully!");
    }

    try {
      await pushRoomCharge(newBill);
      newBill.hotelPostStatus = "posted";
      newBill.hotelPostError = undefined;
      await newBill.save();
      return res.send("Bill Created Successfully!");
    } catch (error) {
      newBill.hotelPostStatus = "pending";
      newBill.hotelPostError = error.message || "Хотелът не прие сметката";
      await newBill.save();
      return res.status(201).json({
        message: "Бонът е издаден. Качването към стаята не мина и може да се повтори.",
        billId: String(newBill._id),
        hotelPostStatus: "pending",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "something went wrong" });
  }
};

const retryHotelPostController = async (req, res) => {
  try {
    const bill = await billsModel.findById(req.params.id);
    if (!bill || !isRoomCharge(bill.paymentMode)) {
      return res.status(404).json({ message: "Сметката към стая не е намерена" });
    }
    if (bill.hotelPostStatus === "posted") {
      return res.json({ message: "Сметката вече е качена", hotelPostStatus: "posted" });
    }
    if (!hotelPmsService.isConfigured()) {
      return res.status(400).json({ message: "Плащане «На стая» не е включено" });
    }
    await pushRoomCharge(bill);
    bill.hotelPostStatus = "posted";
    bill.hotelPostError = undefined;
    await bill.save();
    return res.json({ message: "Сметката е качена към стаята", hotelPostStatus: "posted" });
  } catch (error) {
    return res.status(error.status || 502).json({
      message: error.message || "Хотелът не прие сметката",
    });
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
    filter.includedInXReport = { $ne: true };
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
    stornoQuery.includedInXReport = { $ne: true };
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
    const roomAmount = roomBills.reduce((sum, bill) => sum + (Number(bill.totalAmount) || 0), 0);
    const { totalAmount, totalBills, byPayment, items } = buildSalesReport(bills);

    let deviceZ;
    try {
      deviceZ = await fiscalService.printZReport();
    } catch (fiscalZErr) {
      return res.status(502).json({
        message: fiscalZErr.message || "Фискалното устройство отказа Z отчета",
      });
    }
    const fiscalReportId = deviceZ.fiscalReportId || deviceZ.receiptNumber;
    if (!fiscalReportId) {
      return res.status(502).json({
        message: "Фискалното устройство не върна номер на Z отчета",
      });
    }

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
      bills,
      roomAmount,
      roomBillCount: roomBills.length,
      isSynchronized: true,
      synchronizedAt: new Date(),
      isTestMode: false,
      fiscalReportId,
    });

    const billIds = bills.map((b) => b._id);
    if (billIds.length) {
      await billsModel.updateMany(
        { _id: { $in: billIds } },
        { $set: { includedInZReport: true, zReportId: report._id } }
      );
    }

    await writeAudit({
      action: "z-report",
      userId: req.authUser?.userId || userId || "",
      userName: req.authUser?.name || "",
      entity: "report",
      entityId: report._id,
      detail: report.fiscalReportId || "",
    });

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

function formatXReportCode(date, sequence) {
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
  return `${stamp}-${sequence}`;
}

async function allocateXReportCode(userId, moment) {
  const dayStart = new Date(moment.getFullYear(), moment.getMonth(), moment.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  let sequence = (await Report.countDocuments({
    type: "X",
    userId,
    createdAt: { $gte: dayStart, $lt: dayEnd },
  })) + 1;
  let reportCode = formatXReportCode(moment, sequence);
  while (await Report.exists({ reportCode })) {
    sequence += 1;
    reportCode = formatXReportCode(moment, sequence);
  }
  return reportCode;
}

const submitXReportController = async (req, res) => {
  try {
    const isAdmin = req.authUser?.role === "admin";
    const userId = isAdmin ? req.body.userId : req.authUser?.userId;
    if (!userId) {
      return res.status(400).json({ message: "Избери сервитьор!" });
    }

    const User = require("../models/userModel");
    const waiter = await User.findOne({ userId: String(userId) });
    if (!waiter) {
      return res.status(404).json({ message: "Сервитьорът не е намерен" });
    }

    const filter = {
      isStornoed: { $ne: true },
      includedInXReport: { $ne: true },
      userId: waiter.userId,
    };
    const stornoQuery = {
      includedInXReport: { $ne: true },
      userId: waiter.userId,
    };
    const bills = await billsModel.find(filter);
    const stornoDocs = await Storno.find(stornoQuery).sort({ createdAt: -1 }).lean();
    if (!bills.length && !stornoDocs.length) {
      return res.status(400).json({ message: "Няма непредадени сметки." });
    }

    const now = new Date();
    const times = [
      ...bills.map((bill) => new Date(bill.date).getTime()),
      ...stornoDocs.map((item) => new Date(item.createdAt).getTime()),
    ].filter((time) => !Number.isNaN(time));
    const from = new Date(Math.min(...times));
    const roomBills = bills.filter((bill) => isRoomCharge(bill.paymentMode));
    const { totalAmount, totalBills, byPayment, items } = buildSalesReport(bills);
    const stornoAmount = stornoDocs.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
    const preBillStornos = stornoDocs.filter((item) => item.type === "pre_bill");
    const billStornos = stornoDocs.filter((item) => item.type !== "pre_bill");
    let byCategory = {};
    try {
      byCategory = await buildCategoryBreakdown(bills);
    } catch (categoryError) {
      console.log("[SUBMIT X] Category breakdown skipped:", categoryError.message);
    }

    const reportCode = await allocateXReportCode(waiter.userId, now);
    const report = new Report({
      type: "X",
      reportCode,
      from,
      to: now,
      userId: waiter.userId,
      userName: waiter.name || waiter.userId,
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
    try {
      await report.save();
    } catch (error) {
      if (error && error.code === 11000) {
        return res.status(409).json({ message: "Номерът се застъпи. Предай отчета отново." });
      }
      throw error;
    }

    const billIds = bills.map((bill) => bill._id);
    if (billIds.length) {
      await billsModel.updateMany(
        { _id: { $in: billIds } },
        { $set: { includedInXReport: true, xReportId: report._id } }
      );
    }
    const stornoIds = stornoDocs.map((item) => item._id);
    if (stornoIds.length) {
      await Storno.updateMany(
        { _id: { $in: stornoIds } },
        { $set: { includedInXReport: true, xReportId: report._id } }
      );
    }

    await writeAudit({
      action: "x-handover",
      userId: req.authUser?.userId || "",
      userName: req.authUser?.name || "",
      entity: "report",
      entityId: report._id,
      detail: report.reportCode,
    });

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
    console.log(`[SUBMIT X] ${error.message}`);
    res.status(500).json({ message: "Грешка при предаване на X отчета!", error: error.message });
  }
};

const getZReportsController = async (req, res) => {
  try {
    const reports = await Report.find({ type: { $in: ["Z", "shift", "X"] } }).sort({ createdAt: -1 });
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
  res.status(410).json({
    message: "Отчетът не се изпраща към НАП от програмата. Z се печата на фискалното устройство при архивиране.",
  });
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
    const pkg = require("../package.json");
    res.json({
      ...status,
      softwareName: "PirinPixel restaurant",
      softwareVersion: pkg.version,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Грешка при проверка на фискалния статус",
      error: error.message,
    });
  }
};

const printXReportController = async (req, res) => {
  try {
    const result = await fiscalService.printXReport();
    await writeAudit({
      action: "x-report",
      userId: req.authUser?.userId || "",
      userName: req.authUser?.name || "",
      entity: "report",
      detail: result.receiptNumber || result.message || "X",
    });
    res.json(result);
  } catch (error) {
    res.status(502).json({ message: error.message || "Фискалното устройство отказа X отчета" });
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
    if (!hotelPmsService.isConfigured()) {
      return res.status(404).json({ message: "Плащане «На стая» не е включено" });
    }
    const rooms = await hotelPmsService.getOpenRooms();
    res.json(rooms);
  } catch (error) {
    res.status(error.status || 503).json({
      message: error.message || "Хотелът не е свързан",
    });
  }
};

const getHotelLinkController = async (req, res) => {
  res.json({ enabled: hotelPmsService.isConfigured() });
};

function csvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const getNapExportController = async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 864e5);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const bills = await billsModel
      .find({
        fiscalStatus: "completed",
        createdAt: { $gte: from, $lte: to },
      })
      .lean();
    const stornos = await Storno.find({
      type: "bill",
      fiscalStatus: "completed",
      createdAt: { $gte: from, $lte: to },
    }).lean();
    const billById = {};
    bills.forEach((bill) => {
      billById[String(bill._id)] = bill;
    });
    const rows = bills.map((bill) => ({
      kind: "sale",
      datetime: bill.createdAt,
      uniqueSaleNumber: bill.uniqueSaleNumber || "",
      fiscalReceiptId: bill.fiscalReceiptId || "",
      fiscalMemorySerialNumber: bill.fiscalMemorySerialNumber || "",
      fiscalDeviceSerialNumber: bill.fiscalDeviceSerialNumber || "",
      operator: bill.userId || "",
      paymentMode: bill.paymentMode || "",
      totalAmount: bill.totalAmount,
      items: (bill.cartItems || []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        taxGroup: item.taxGroup,
      })),
      storno: false,
      originalUniqueSaleNumber: "",
    }));
    stornos.forEach((storno) => {
      const original = billById[String(storno.originalBillId)];
      rows.push({
        kind: "storno",
        datetime: storno.createdAt,
        uniqueSaleNumber: storno.uniqueSaleNumber || "",
        fiscalReceiptId: storno.fiscalReceiptId || "",
        fiscalMemorySerialNumber: storno.fiscalMemorySerialNumber || "",
        fiscalDeviceSerialNumber: storno.fiscalDeviceSerialNumber || "",
        operator: storno.userId || "",
        paymentMode: storno.paymentMode || "",
        totalAmount: storno.totalAmount,
        items: (storno.cartItems || []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          taxGroup: item.taxGroup,
        })),
        storno: true,
        originalUniqueSaleNumber: original?.uniqueSaleNumber || "",
      });
    });

    await writeAudit({
      action: "nap-export",
      userId: req.authUser?.userId || "",
      userName: req.authUser?.name || "",
      entity: "export",
      detail: `${from.toISOString()} ${to.toISOString()}`,
    });

    if (String(req.query.format || "").toLowerCase() === "csv") {
      const header = [
        "kind",
        "datetime",
        "uniqueSaleNumber",
        "fiscalReceiptId",
        "fiscalMemorySerialNumber",
        "fiscalDeviceSerialNumber",
        "operator",
        "paymentMode",
        "totalAmount",
        "items",
        "storno",
        "originalUniqueSaleNumber",
      ];
      const lines = [header.join(",")];
      rows.forEach((row) => {
        lines.push(
          header
            .map((key) => csvCell(key === "items" ? JSON.stringify(row.items) : row[key]))
            .join(",")
        );
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      return res.send(`\uFEFF${lines.join("\n")}`);
    }
    return res.json({ from, to, rows });
  } catch (error) {
    return res.status(500).json({ message: "Грешка при експорт", error: error.message });
  }
};

module.exports = {
  addBillsController,
  getBillsController,
  getOpenRoomsController,
  retryHotelPostController,
  getHotelLinkController,
  getNapExportController,
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
};
