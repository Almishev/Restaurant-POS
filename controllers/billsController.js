const billsModel = require("../models/billsModel");
const Report = require("../models/reportModel");
const fiscalService = require('../services/fiscalService');
const Recipe = require('../models/recipeModel');
const Inventory = require('../models/inventoryModel');

//add items
const addBillsController = async (req, res) => {
  try {
    const newBill = new billsModel(req.body);
    await newBill.save();

    // --- Автоматично изписване на суровини по рецепта ---
    for (const cartItem of req.body.cartItems) {
      // cartItem._id е id на ястието (item)
      const recipe = await Recipe.findOne({ item: cartItem._id });
      if (recipe) {
        for (const ing of recipe.ingredients) {
          // Намаляваме quantity в склада с ing.quantity * cartItem.quantity
          const inventory = await Inventory.findById(ing.inventory);
          if (inventory) {
            const amountToDeduct = ing.quantity * cartItem.quantity;
            inventory.quantity = Math.round((inventory.quantity - amountToDeduct) * 100) / 100;
            inventory.history.push({
              type: 'out',
              amount: amountToDeduct,
              user: req.body.userId || 'sale',
              note: `Продажба на ${cartItem.name}`
            });
            await inventory.save();
          }
        }
      }
    }
    // --- Край на автоматичното изписване ---

    res.send("Bill Created Successfully!");
  } catch (error) {
    res.send("something went wrong");
    console.log(error);
  }
};

//get blls data
const getBillsController = async (req, res) => {
  try {
    const bills = await billsModel.find();
    res.send(bills);
  } catch (error) {
    console.log(error);
  }
};

// X/Z отчет
const getReportController = async (req, res) => {
  try {
    const { from, to, userId } = req.query;
    const filter = {};
    if (from && to) {
      filter.date = { $gte: new Date(from), $lte: new Date(to) };
    }
    if (userId) {
      filter.userId = userId;
    }
    const bills = await billsModel.find(filter);
    // Сумиране
    const totalAmount = bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const totalBills = bills.length;
    const byPayment = bills.reduce((acc, b) => {
      acc[b.paymentMode] = (acc[b.paymentMode] || 0) + (b.totalAmount || 0);
      return acc;
    }, {});
    // Разбивка по артикули
    const items = {};
    bills.forEach(bill => {
      (bill.cartItems || []).forEach(item => {
        if (!items[item.name]) items[item.name] = { quantity: 0, total: 0 };
        items[item.name].quantity += item.quantity;
        items[item.name].total += item.price * item.quantity;
      });
    });
    res.json({
      totalAmount,
      totalBills,
      byPayment,
      items,
      bills, // по желание: махни ако не искаш целите сметки
    });
  } catch (error) {
    res.status(500).json({ message: "Грешка при генериране на отчет!", error });
  }
};

// Създаване и архивиране на Z отчет
const createZReportController = async (req, res) => {
  try {
    const { from, to, userId } = req.body;
    // Проверка за вече съществуващ Z отчет за този ден/период
    const existing = await Report.findOne({
      type: "Z",
      from: new Date(from),
      to: new Date(to),
    });
    if (existing) {
      return res.status(400).json({ message: "Вече има Z отчет за този период!" });
    }
    const filter = {};
    if (from && to) {
      filter.date = { $gte: new Date(from), $lte: new Date(to) };
    }
    if (userId) {
      filter.userId = userId;
    }
    const bills = await billsModel.find(filter);
    const totalAmount = bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const totalBills = bills.length;
    const byPayment = bills.reduce((acc, b) => {
      acc[b.paymentMode] = (acc[b.paymentMode] || 0) + (b.totalAmount || 0);
      return acc;
    }, {});
    const items = {};
    bills.forEach(bill => {
      (bill.cartItems || []).forEach(item => {
        if (!items[item.name]) items[item.name] = { quantity: 0, total: 0 };
        items[item.name].quantity += item.quantity;
        items[item.name].total += item.price * item.quantity;
      });
    });
    const report = new Report({
      type: "Z",
      from: new Date(from),
      to: new Date(to),
      userId,
      totalAmount,
      totalBills,
      byPayment,
      items,
      bills,
    });
    await report.save();
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: "Грешка при създаване на Z отчет!", error });
  }
};

// Връща всички Z отчети
const getZReportsController = async (req, res) => {
  try {
    const reports = await Report.find({ type: "Z" }).sort({ from: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: "Грешка при зареждане на Z отчетите!", error });
  }
};

// Ръчна синхронизация на Z отчет
const syncZReportController = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await fiscalService.synchronizeZReport(reportId);
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: "Грешка при синхронизация на Z отчет!", error: error.message });
  }
};

module.exports = {
  addBillsController,
  getBillsController,
  getReportController,
  createZReportController,
  getZReportsController,
  syncZReportController,
};
