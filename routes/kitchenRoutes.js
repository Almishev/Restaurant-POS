const express = require("express");
const router = express.Router();
const KitchenOrder = require("../models/kitchenOrderModel");
const Item = require("../models/itemModel");
const Table = require("../models/tableModel");

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
    const newOrder = new KitchenOrder({
      tableName,
      items: itemsWithDepartment,
      waiterName,
    });
    await newOrder.save();
    res.status(201).json({ message: "Поръчката е изпратена към кухнята!" });
  } catch (error) {
    console.log("[KITCHEN] Грешка при изпращане:", error);
    res.status(400).json({ message: "Грешка при изпращане на поръчка!" });
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
