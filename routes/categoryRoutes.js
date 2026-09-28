const express = require("express");
const router = express.Router();
const Category = require("../models/categoryModel");
const Item = require("../models/itemModel");

// GET всички категории
router.get("/get-categories", async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: "Грешка при зареждане на категориите." });
  }
});

// POST нова категория
router.post("/add-category", async (req, res) => {
  try {
    const { name } = req.body;
    const newCategory = new Category({ name });
    await newCategory.save();
    res.status(201).json({ message: "Категорията е добавена успешно!" });
  } catch (error) {
    res.status(400).json({ message: "Грешка при добавяне на категория." });
  }
});

// PUT редакция на категория
router.put("/edit-category/:id", async (req, res) => {
  try {
    const { name } = req.body;
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) {
      return res.status(400).json({ message: "Името на категорията е задължително." });
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Категорията не е намерена." });
    }

    const oldName = category.name;
    category.name = trimmed;
    await category.save();

    // Ако името е сменено — обнови артикулите, които ползват старото име
    if (oldName !== trimmed) {
      await Item.updateMany({ category: oldName }, { $set: { category: trimmed } });
    }

    res.status(200).json({ message: "Категорията е обновена успешно!", category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Вече съществува категория с това име." });
    }
    console.error("Грешка при редакция на категория:", error);
    res.status(400).json({ message: "Грешка при редакция на категория." });
  }
});

// DELETE изтриване на категория
router.delete("/delete-category/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Категорията не е намерена." });
    }

    const itemsCount = await Item.countDocuments({ category: category.name });
    if (itemsCount > 0) {
      return res.status(400).json({
        message: `Категорията не може да се изтрие — има ${itemsCount} закачени артикул(а).`,
      });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Категорията е изтрита успешно!" });
  } catch (error) {
    console.error("Грешка при изтриване на категория:", error);
    res.status(400).json({ message: "Грешка при изтриване на категория." });
  }
});

module.exports = router;
