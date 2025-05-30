const express = require("express");
const router = express.Router();
const Table = require("../models/tableModel");

// GET всички маси
router.get("/get-tables", async (req, res) => {
  try {
    const tables = await Table.find();
    res.status(200).json(tables);
  } catch (error) {
    res.status(500).json({ message: "Грешка при зареждане на масите." });
  }
});

// POST нова маса
router.post("/add-table", async (req, res) => {
  try {
    const { name } = req.body;
    const newTable = new Table({ name });
    await newTable.save();
    res.status(201).json({ message: "Масата е добавена успешно!" });
  } catch (error) {
    res.status(400).json({ message: "Грешка при добавяне на маса." });
  }
});

// PUT обнови количката и сумата на маса
router.put("/update-table-cart", async (req, res) => {
  try {
    const { tableId, cartItems, totalAmount } = req.body;
    const updated = await Table.findByIdAndUpdate(
      tableId,
      { cartItems, totalAmount },
      { new: true }
    );
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: "Грешка при обновяване на масата." });
  }
});

module.exports = router; 