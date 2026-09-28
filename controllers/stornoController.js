const Storno = require("../models/stornoModel");
const Bills = require("../models/billsModel");
const fiscalService = require("../services/fiscalService");
const Report = require("../models/reportModel");
const Recipe = require("../models/recipeModel");
const Inventory = require("../models/inventoryModel");

function lineKey(item) {
  return String(item._id || item.itemId || item.name);
}

function getRemainingQty(bill, item) {
  const key = lineKey(item);
  const original = (bill.cartItems || []).find(
    (i) => lineKey(i) === key
  );
  if (!original) return 0;
  const stornoedMap = bill.stornoedQuantities
    ? bill.stornoedQuantities instanceof Map
      ? Object.fromEntries(bill.stornoedQuantities)
      : bill.stornoedQuantities
    : {};
  const already = Number(stornoedMap[key]) || 0;
  return Math.max(0, (Number(original.quantity) || 0) - already);
}

async function restoreInventoryForItems(cartItems, userId) {
  for (const cartItem of cartItems || []) {
    const recipe = await Recipe.findOne({ item: cartItem._id });
    if (!recipe) continue;
    for (const ing of recipe.ingredients) {
      const inventory = await Inventory.findById(ing.inventory);
      if (!inventory) continue;
      const amount = ing.quantity * cartItem.quantity;
      inventory.quantity = Math.round((inventory.quantity + amount) * 100) / 100;
      inventory.history.push({
        type: "in",
        amount,
        user: userId || "storno",
        note: `Сторно на ${cartItem.name}`,
      });
      await inventory.save();
    }
  }
}

const createStornoController = async (req, res) => {
  try {
    const { originalBillId, reason, reasonText, cartItems } = req.body;
    const userId = req.authUser?.userId || req.body.userId;
    const userName = req.authUser?.name || req.body.userName;

    if (!originalBillId || !reason || !cartItems || !cartItems.length || !userId || !userName) {
      return res.status(400).json({
        error:
          "Непълни данни за сторно операцията. Моля, проверете задължителните полета.",
      });
    }

    const validReasons = [
      "operatorError",
      "returnedItems",
      "defectiveGoods",
      "other",
    ];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: "Невалидна причина за сторниране" });
    }

    const originalBill = await Bills.findById(originalBillId);
    if (!originalBill) {
      return res.status(404).json({ error: "Оригиналният бон не е намерен" });
    }

    if (originalBill.isStornoed) {
      return res
        .status(400)
        .json({ error: "Сметката вече е напълно сторнирана!" });
    }

    if (originalBill.includedInZReport) {
      return res.status(400).json({
        error: "Сторниране е невъзможно — сметката е включена в Z отчет!",
      });
    }

    // Z report guard by nested bill _id
    const inZ = await Report.findOne({
      type: "Z",
      "bills._id": originalBill._id,
    });
    if (inZ) {
      return res.status(400).json({
        error:
          "Сторниране е възможно само на бонове, които не са включени в Z отчет!",
      });
    }

    const billDate = new Date(originalBill.createdAt || originalBill.date);
    const timeDiff = Math.abs(new Date() - billDate) / 36e5;
    if (timeDiff > 24) {
      return res.status(400).json({
        error:
          "Сторниране е възможно само в рамките на същата работна смяна (24 часа)",
      });
    }

    // Validate cartItems ⊆ original and qty ≤ remaining
    const validatedItems = [];
    for (const reqItem of cartItems) {
      const key = lineKey(reqItem);
      const originalLine = (originalBill.cartItems || []).find(
        (i) => lineKey(i) === key
      );
      if (!originalLine) {
        return res.status(400).json({
          error: `Артикул „${reqItem.name || key}“ не е в оригиналната сметка`,
        });
      }
      const remaining = getRemainingQty(originalBill, originalLine);
      const qty = Math.max(0, Number(reqItem.quantity) || 0);
      if (qty <= 0 || qty > remaining) {
        return res.status(400).json({
          error: `Невалидно количество за „${originalLine.name}“ (остава ${remaining})`,
        });
      }
      validatedItems.push({
        ...originalLine.toObject?.() || { ...originalLine },
        _id: originalLine._id,
        name: originalLine.name,
        price: originalLine.price,
        quantity: qty,
        note: reqItem.note || originalLine.note || "",
      });
    }

    const subTotal = validatedItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    );
    // Keep tax consistent with stored bill proportion if possible
    const taxRate =
      originalBill.subTotal > 0
        ? (originalBill.totalAmount - originalBill.subTotal) /
          originalBill.subTotal
        : 0.2;
    const tax = Math.round(subTotal * taxRate * 100) / 100;
    const totalAmount = Math.round((subTotal + tax) * 100) / 100;

    const stornoBill = new Storno({
      type: "bill",
      originalBillId,
      userId,
      userName,
      cartItems: validatedItems,
      subTotal,
      tax,
      totalAmount,
      paymentMode: originalBill.paymentMode,
      reason,
      reasonText: reasonText || "",
      originalBillFiscalId: originalBill.fiscalReceiptId || "",
      customerName: originalBill.customerName || originalBill.tableName || "",
      tableName: originalBill.tableName || "",
    });

    const newStorno = await stornoBill.save();

    // Update stornoed quantities on bill
    const stornoedMap = originalBill.stornoedQuantities
      ? originalBill.stornoedQuantities instanceof Map
        ? Object.fromEntries(originalBill.stornoedQuantities)
        : { ...originalBill.stornoedQuantities }
      : {};

    validatedItems.forEach((item) => {
      const key = lineKey(item);
      stornoedMap[key] = (Number(stornoedMap[key]) || 0) + item.quantity;
    });

    originalBill.stornoedQuantities = stornoedMap;

    // Full void if nothing remaining
    const fullyStornoed = (originalBill.cartItems || []).every((line) => {
      const rem = getRemainingQty(
        { ...originalBill.toObject(), stornoedQuantities: stornoedMap },
        line
      );
      return rem <= 0;
    });

    if (fullyStornoed) {
      originalBill.isStornoed = true;
    }
    await originalBill.save();

    // Restore inventory
    try {
      await restoreInventoryForItems(validatedItems, userId);
    } catch (invErr) {
      console.log("[STORNO] Inventory restore error:", invErr);
    }

    try {
      const fiscalResult = await fiscalService.printStornoBon(
        originalBill,
        newStorno._id,
        reason,
        validatedItems
      );

      newStorno.fiscalReceiptId = fiscalResult.fiscalReceiptId;
      newStorno.fiscalReceiptTimestamp = fiscalResult.timestamp;
      newStorno.fiscalStatus = "completed";
      await newStorno.save();
    } catch (fiscalError) {
      console.log("[STORNO] Fiscal error:", fiscalError);
      newStorno.fiscalStatus = "error";
      newStorno.fiscalErrorMessage =
        fiscalError.message || "Грешка при фискализация (тестов режим)";
      await newStorno.save();

      return res.status(207).json({
        success: true,
        stornoId: newStorno._id,
        fiscalError: fiscalError.message || "Неизвестна грешка при фискализация",
        message:
          "Сторно операцията е записана, но има проблем с фискализацията (тестов режим)",
        isFullStorno: fullyStornoed,
      });
    }

    res.status(201).json({
      success: true,
      stornoId: newStorno._id,
      message: "Сторно операцията е успешна",
      isFullStorno: fullyStornoed,
    });
  } catch (error) {
    console.log("[STORNO] Error creating storno:", error);
    res.status(500).json({
      error: error.message || "Грешка при сторниране",
    });
  }
};

const getStornosController = async (req, res) => {
  try {
    const { startDate, endDate, customerName, reason } = req.query;
    let query = {};

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (customerName) {
      query.customerName = { $regex: customerName, $options: "i" };
    }

    if (reason) {
      query.reason = reason;
    }

    const stornos = await Storno.find(query).sort({ createdAt: -1 });
    res.status(200).json(stornos);
  } catch (error) {
    console.log("[STORNO] Error fetching stornos:", error);
    res.status(500).json({
      error: error.message || "Грешка при извличане на сторно данни",
    });
  }
};

const getStornoReportController = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    let query = {};
    if (userId) query.userId = userId;
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const stornos = await Storno.find(query);

    const totalAmount = stornos.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalCount = stornos.length;

    const byReason = stornos.reduce((acc, s) => {
      acc[s.reason] = acc[s.reason] || { count: 0, amount: 0 };
      acc[s.reason].count++;
      acc[s.reason].amount += s.totalAmount;
      return acc;
    }, {});

    const byUser = stornos.reduce((acc, s) => {
      acc[s.userName] = acc[s.userName] || { count: 0, amount: 0 };
      acc[s.userName].count++;
      acc[s.userName].amount += s.totalAmount;
      return acc;
    }, {});

    const byDate = stornos.reduce((acc, s) => {
      const date = new Date(s.createdAt).toISOString().split("T")[0];
      acc[date] = acc[date] || { count: 0, amount: 0 };
      acc[date].count++;
      acc[date].amount += s.totalAmount;
      return acc;
    }, {});

    res.status(200).json({
      totalAmount,
      totalCount,
      byReason,
      byUser,
      byDate,
      stornos: stornos.map((s) => ({
        id: s._id,
        date: s.createdAt,
        type: s.type || "bill",
        originalBillId: s.originalBillId,
        reason: s.reason,
        amount: s.totalAmount,
        userName: s.userName,
        userId: s.userId,
        customerName: s.customerName,
        tableName: s.tableName,
        fiscalStatus: s.fiscalStatus,
        items: (s.cartItems || []).map((i) => `${i.name}×${i.quantity}`).join(", "),
      })),
    });
  } catch (error) {
    console.log("[STORNO] Error generating storno report:", error);
    res.status(500).json({
      error: error.message || "Грешка при генериране на отчет за сторно операциите",
    });
  }
};

const getStornoDetailsController = async (req, res) => {
  try {
    const { id } = req.params;
    const storno = await Storno.findById(id);

    if (!storno) {
      return res.status(404).json({ error: "Сторно бонът не е намерен" });
    }

    const originalBill = storno.originalBillId
      ? await Bills.findById(storno.originalBillId)
      : null;

    res.status(200).json({
      storno,
      originalBill: originalBill || { message: "Няма оригинална сметка (pre-bill сторно)" },
    });
  } catch (error) {
    console.log("[STORNO] Error fetching storno details:", error);
    res.status(500).json({
      error: error.message || "Грешка при извличане на данни за сторно бона",
    });
  }
};

/**
 * Cancel sent (cart) item(s) on an open table before bill.
 * Blocked if status is "Готово". Notifies kitchen by reducing/removing open tickets.
 */
const createPreBillStornoController = async (req, res) => {
  try {
    const { tableId, itemId, quantity, reason, reasonText } = req.body;
    const userId = req.authUser?.userId || req.body.userId;
    const userName = req.authUser?.name || req.body.userName;

    if (!tableId || !itemId || !reason || !userId || !userName) {
      return res.status(400).json({
        error: "Непълни данни (tableId, itemId, reason, user).",
      });
    }

    const qtyToCancel = Math.max(1, Number(quantity) || 1);
    const Table = require("../models/tableModel");
    const KitchenOrder = require("../models/kitchenOrderModel");

    const table = await Table.findById(tableId);
    if (!table) {
      return res.status(404).json({ error: "Масата не е намерена" });
    }

    const cart = table.cartItems || [];
    const idx = cart.findIndex(
      (i) => String(i._id) === String(itemId) || String(i.itemId) === String(itemId)
    );
    if (idx < 0) {
      return res.status(404).json({ error: "Артикулът не е в изпратените" });
    }

    const line = typeof cart[idx].toObject === "function" ? cart[idx].toObject() : { ...cart[idx] };

    if (line.status === "Готово") {
      return res.status(400).json({
        error:
          "Артикулът е издаден от кухнята/бара и не може да се сторнира. Помолете станцията да натисне „Върни“.",
      });
    }

    const available = Number(line.quantity) || 0;
    if (qtyToCancel > available) {
      return res.status(400).json({
        error: `Може да сторнирате най-много ${available} бр.`,
      });
    }

    // Update table cart
    if (qtyToCancel >= available) {
      table.cartItems = cart.filter((_, i) => i !== idx);
    } else {
      const next = [...cart];
      const updated =
        typeof next[idx].toObject === "function"
          ? { ...next[idx].toObject(), quantity: available - qtyToCancel }
          : { ...next[idx], quantity: available - qtyToCancel };
      next[idx] = updated;
      table.cartItems = next;
    }

    table.totalAmount = [
      ...(table.cartItems || []),
      ...(table.pendingItems || []),
    ].reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);

    table.markModified("cartItems");
    await table.save();

    // Notify kitchen/bar: reduce or remove matching not-done items
    let remainingCancel = qtyToCancel;
    const openOrders = await KitchenOrder.find({
      tableName: table.name,
      "items.done": false,
    }).sort({ createdAt: -1 });

    for (const order of openOrders) {
      if (remainingCancel <= 0) break;
      let changed = false;
      const newItems = [];
      for (const it of order.items || []) {
        const plain = typeof it.toObject === "function" ? it.toObject() : { ...it };
        if (
          remainingCancel > 0 &&
          !plain.done &&
          (plain.name || "").trim().toLowerCase() === (line.name || "").trim().toLowerCase()
        ) {
          const q = Number(plain.quantity) || 0;
          if (q <= remainingCancel) {
            remainingCancel -= q;
            changed = true;
            // drop item (fully cancelled)
            continue;
          }
          plain.quantity = q - remainingCancel;
          remainingCancel = 0;
          changed = true;
          newItems.push(plain);
        } else {
          newItems.push(plain);
        }
      }
      if (changed) {
        if (newItems.length === 0) {
          await KitchenOrder.findByIdAndDelete(order._id);
        } else {
          order.items = newItems;
          await order.save();
        }
      }
    }

    const subTotal = (Number(line.price) || 0) * qtyToCancel;
    const stornoDoc = new Storno({
      type: "pre_bill",
      tableId: String(table._id),
      tableName: table.name,
      customerName: table.name,
      userId,
      userName,
      cartItems: [
        {
          _id: line._id,
          name: line.name,
          price: line.price,
          quantity: qtyToCancel,
          note: line.note || "",
        },
      ],
      subTotal,
      tax: 0,
      totalAmount: subTotal,
      paymentMode: "",
      reason,
      reasonText: reasonText || "",
      fiscalStatus: "n/a",
    });
    await stornoDoc.save();

    res.status(201).json({
      success: true,
      stornoId: stornoDoc._id,
      message: "Артикулът е сторниран от изпратените",
      table,
    });
  } catch (error) {
    console.log("[STORNO] Pre-bill error:", error);
    res.status(500).json({ error: error.message || "Грешка при pre-bill сторно" });
  }
};

module.exports = {
  createStornoController,
  createPreBillStornoController,
  getStornosController,
  getStornoDetailsController,
  getStornoReportController,
};
