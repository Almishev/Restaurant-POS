const express = require("express");
const router = express.Router();
const KitchenOrder = require("../models/kitchenOrderModel");

// POST: изпращане на поръчка към кухнята
router.post("/send-order", async (req, res) => {
  try {
    const { tableName, items, waiterName } = req.body;
    const newOrder = new KitchenOrder({ tableName, items, waiterName });
    await newOrder.save();
    res.status(201).json({ message: "Поръчката е изпратена към кухнята!" });
  } catch (error) {
    res.status(400).json({ message: "Грешка при изпращане на поръчка!" });
  }
});

// GET: всички кухненски поръчки
router.get("/orders", async (req, res) => {
  try {
    const orders = await KitchenOrder.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(400).json({ message: "Грешка при зареждане на поръчките!" });
  }
});

// DELETE: изтриване на кухненска поръчка по id
router.delete("/orders/:id", async (req, res) => {
  try {
    await KitchenOrder.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Поръчката е изтрита успешно!" });
  } catch (error) {
    res.status(400).json({ message: "Грешка при изтриване на поръчката!" });
  }
});

// PUT: отбелязване на артикул като готов (done)
router.put("/orders/:id/done", async (req, res) => {
  try {
    const { itemName } = req.body;
    const order = await KitchenOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Поръчката не е намерена!" });
    order.items = order.items.map(item =>
      item.name === itemName ? { ...item.toObject(), done: true } : item
    );
    await order.save();
    // Ако всички артикули са done, изтрий поръчката
    if (order.items.every(i => i.done)) {
      await KitchenOrder.findByIdAndDelete(req.params.id);
    }
    res.status(200).json({ message: "Артикулът е отбелязан като готов!" });
  } catch (error) {
    res.status(400).json({ message: "Грешка при отбелязване на артикул като готов!" });
  }
});

module.exports = router; 