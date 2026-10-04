const express = require("express");
const router = express.Router();
const KitchenOrder = require("../models/kitchenOrderModel");
const KioskCounter = require("../models/kioskCounterModel");
const Item = require("../models/itemModel");
const Table = require("../models/tableModel");

function sofiaDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function sofiaDayStart(date = new Date()) {
  const day = sofiaDayKey(date);
  const utcMidnight = new Date(`${day}T00:00:00Z`);
  const sofiaHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Sofia",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(utcMidnight)
  );
  return new Date(utcMidnight.getTime() - sofiaHour * 60 * 60 * 1000);
}

async function nextKioskNumber() {
  const key = `kiosk-${sofiaDayKey()}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const doc = await KioskCounter.findOneAndUpdate(
        { key },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
      );
      return doc.seq;
    } catch (error) {
      if (attempt === 2 || error.code !== 11000) throw error;
    }
  }
  throw new Error("Неуспешен номер за киоск");
}

router.post("/send-order", async (req, res) => {
  try {
    const { tableName, items, waiterName } = req.body;
    const itemsWithDepartment = await Promise.all(
      items.map(async (item) => {
        if (item.department) return item;
        const dbItem = await Item.findById(item._id);
        return { ...item, department: dbItem ? dbItem.department : undefined };
      })
    );
    const isKiosk = waiterName === "Киоск";
    const orderNumber = isKiosk ? await nextKioskNumber() : undefined;
    const newOrder = new KitchenOrder({
      tableName: isKiosk ? `КИОСК ${orderNumber}` : tableName,
      items: itemsWithDepartment,
      waiterName,
      orderNumber,
    });
    await newOrder.save();
    res.status(201).json({
      message: "Поръчката е изпратена към кухнята!",
      orderNumber: newOrder.orderNumber,
      createdAt: newOrder.createdAt,
    });
  } catch (error) {
    console.log("[KITCHEN] Грешка при изпращане:", error);
    res.status(400).json({ message: "Грешка при изпращане на поръчка!" });
  }
});

router.post("/mark-cashier", async (req, res) => {
  try {
    const orderNumber = Number(String(req.body.orderNumber || "").trim());
    if (!orderNumber) {
      return res.status(400).json({ message: "Въведи номер." });
    }
    const start = sofiaDayStart();
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const order = await KitchenOrder.findOne({
      orderNumber,
      createdAt: { $gte: start, $lt: end },
    });
    if (!order) {
      return res.status(404).json({ message: "Няма поръчка с този номер за днес." });
    }
    let pricesChanged = false;
    const itemsWithPrice = [];
    for (const item of order.items) {
      const plain = typeof item.toObject === "function" ? item.toObject() : { ...item };
      if (plain.price == null) {
        const dbItem = await Item.findOne({ name: plain.name });
        plain.price = dbItem ? dbItem.price : 0;
        pricesChanged = true;
      }
      itemsWithPrice.push(plain);
    }
    if (pricesChanged) {
      order.items = itemsWithPrice;
      order.markModified("items");
    }
    if (order.billed) {
      await order.save();
      return res.status(200).json({
        already: true,
        billed: true,
        message: "Поръчката вече е платена.",
        order,
      });
    }
    if (order.atCashier) {
      if (pricesChanged) await order.save();
      return res.status(200).json({
        already: true,
        billed: false,
        message: "Поръчката вече е маркирана.",
        order,
      });
    }
    order.atCashier = true;
    await order.save();
    res.status(200).json({
      already: false,
      billed: false,
      message: "Поръчката е маркирана.",
      order,
    });
  } catch (error) {
    console.log("[KITCHEN] Грешка при маркиране:", error);
    res.status(400).json({ message: "Грешка при маркиране на поръчката!" });
  }
});

router.post("/mark-billed", async (req, res) => {
  try {
    const orderNumber = Number(String(req.body.orderNumber || "").trim());
    const start = sofiaDayStart();
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const order = await KitchenOrder.findOne({
      orderNumber,
      createdAt: { $gte: start, $lt: end },
    });
    if (!order) {
      return res.status(404).json({ message: "Няма поръчка с този номер за днес." });
    }
    order.billed = true;
    await order.save();
    res.status(200).json({ message: "Поръчката е платена.", order });
  } catch (error) {
    res.status(400).json({ message: "Грешка при отбелязване на плащането!" });
  }
});

router.get("/orders", async (req, res) => {
  try {
    // Keep recent orders (active + issued) for return UI
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const orders = await KitchenOrder.find({
      createdAt: { $gte: since },
    }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(400).json({ message: "Грешка при зареждане на поръчките!" });
  }
});

router.delete("/orders/:id", async (req, res) => {
  try {
    await KitchenOrder.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Поръчката е изтрита успешно!" });
  } catch (error) {
    res.status(400).json({ message: "Грешка при изтриване на поръчката!" });
  }
});

async function setTableItemStatus(tableName, itemName, status) {
  const table = await Table.findOne({ name: tableName });
  if (!table || !table.cartItems) return;
  const search = (itemName || "").toLowerCase().trim();
  table.cartItems = table.cartItems.map((item) => {
    const plain = typeof item.toObject === "function" ? item.toObject() : { ...item };
    if ((plain.name || "").toLowerCase().trim() === search) {
      return { ...plain, status };
    }
    return plain;
  });
  table.markModified("cartItems");
  await table.save();
}

router.put("/orders/:id/done", async (req, res) => {
  try {
    const { itemName } = req.body;
    const order = await KitchenOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Поръчката не е намерена!" });

    order.items = order.items.map((item) => {
      const plain = typeof item.toObject === "function" ? item.toObject() : { ...item };
      return plain.name === itemName ? { ...plain, done: true } : plain;
    });
    await order.save();

    try {
      await setTableItemStatus(order.tableName, itemName, "Готово");
    } catch (tableError) {
      console.error("Грешка при обновяване на статуса в масата:", tableError);
    }

    // Do NOT delete — keep for "Издадени" + Върни
    res.status(200).json({ message: "Артикулът е отбелязан като готов!" });
  } catch (error) {
    console.error("Грешка при отбелязване като готов:", error);
    res.status(400).json({ message: "Грешка при отбелязване на артикул като готов!" });
  }
});

router.put("/orders/:id/undone", async (req, res) => {
  try {
    const { itemName } = req.body;
    const order = await KitchenOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Поръчката не е намерена!" });

    order.items = order.items.map((item) => {
      const plain = typeof item.toObject === "function" ? item.toObject() : { ...item };
      return plain.name === itemName ? { ...plain, done: false } : plain;
    });
    await order.save();

    try {
      await setTableItemStatus(order.tableName, itemName, "Изпратено");
    } catch (tableError) {
      console.error("Грешка при Върни в масата:", tableError);
    }

    res.status(200).json({ message: "Артикулът е върнат като неиздаден!" });
  } catch (error) {
    console.error("Грешка при Върни:", error);
    res.status(400).json({ message: "Грешка при връщане на артикул!" });
  }
});

module.exports = router;
