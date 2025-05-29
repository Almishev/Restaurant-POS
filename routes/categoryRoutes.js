const express = require("express");
const router = express.Router();
const Category = require("../models/categoryModel");

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

module.exports = router; 