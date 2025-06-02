const Inventory = require('../models/inventoryModel');

// Връща всички наличности
exports.getInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find();
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: 'Грешка при зареждане на склада', error });
  }
};

// Вход на стока (добавяне към quantity)
exports.addStock = async (req, res) => {
  try {
    console.log('addStock: body:', req.body);
    const { name, category, unit, amount, user, note } = req.body;
    let inventory = await Inventory.findOne({ name, unit });
    if (!inventory) {
      inventory = new Inventory({ name, category, unit, quantity: 0 });
    }
    inventory.quantity += amount;
    inventory.quantity = Math.round(inventory.quantity * 100) / 100;
    inventory.history.push({ type: 'in', amount, user, note });
    await inventory.save();
    console.log('addStock: успешно добавено:', inventory);
    res.json(inventory);
  } catch (error) {
    console.error('Грешка при addStock:', error);
    res.status(500).json({ message: 'Грешка при вход на стока', error });
  }
};

// Изход на стока (намаляване на quantity)
exports.removeStock = async (req, res) => {
  try {
    const { name, unit, amount, user, note } = req.body;
    const inventory = await Inventory.findOne({ name, unit });
    if (!inventory) {
      return res.status(404).json({ message: 'Суровината не е намерена!' });
    }
    inventory.quantity -= amount;
    inventory.quantity = Math.round(inventory.quantity * 100) / 100;
    inventory.history.push({ type: 'out', amount, user, note });
    await inventory.save();
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: 'Грешка при изход на стока', error });
  }
}; 