const billsModel = require("../models/billsModel");
const Report = require("../models/reportModel");
const fiscalService = require('../services/fiscalService');
const Recipe = require('../models/recipeModel');
const Inventory = require('../models/inventoryModel');

//add items
const addBillsController = async (req, res) => {
  try {
    console.log("Данни за нова сметка:", {
      totalAmount: req.body.totalAmount,
      userId: req.body.userId
    });
    
    const newBill = new billsModel(req.body);
    await newBill.save();
    console.log("Сметката е създадена успешно с ID:", newBill._id);

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
    // Check if user role is provided in query params
    const { role, userId } = req.query;
    
    console.log(`GET /api/bills/get-bills с параметри: role=${role}, userId=${userId}`);
    
    let query = {};
    
    // If role is not admin and userId is provided, filter by userId
    if (role !== 'admin' && userId) {
      query = { userId };
      console.log(`Филтриране на сметки за потребител ${userId} с роля ${role}`);
    } else {
      console.log(`Показване на всички сметки (admin)`);
    }
    
    // Изведи всички сметки, които са в базата и техните полета userId
    const allBills = await billsModel.find({});
    console.log(`Общ брой сметки в базата данни: ${allBills.length}`);
    if (allBills.length > 0) {
      console.log('Всички userIds в базата данни:');
      allBills.forEach((bill, index) => {
        console.log(`Сметка ${index + 1}: userId = ${bill.userId}`);
      });
    }
    
    // Търсене по специфичен филтър
    const bills = await billsModel.find(query);
    console.log(`Намерени сметки по филтър: ${bills.length}`);
    
    // Отпечатай първите няколко сметки за дебъгване
    if (bills.length > 0) {
      console.log('Примерна намерена сметка:', {
        id: bills[0]._id,
        userId: bills[0].userId
      });
    }
    
    res.send(bills);
  } catch (error) {
    console.log(error);
    res.status(500).send('Error fetching bills');
  }
};

// X/Z отчет
const getReportController = async (req, res) => {
  try {
    const { from, to, userId } = req.query;
    console.log(`[GET REPORT] Получени параметри: from=${from}, to=${to}, userId=${userId}`);
    
    const filter = {};
    if (from && to) {
      filter.date = { $gte: new Date(from), $lte: new Date(to) };
      console.log(`[GET REPORT] Филтриране по период: ${new Date(from).toLocaleString()} - ${new Date(to).toLocaleString()}`);
    }
    
    // Check if we received ObjectId or userId (string identifier)
    if (userId) {
      // First try to find user by _id (ObjectId)
      const User = require("../models/userModel");
      let user = null;
      
      try {
        if (/^[0-9a-fA-F]{24}$/.test(userId)) {
          console.log(`[GET REPORT] Търсене на потребител по _id: ${userId}`);
          user = await User.findById(userId);
        }
        
        // If user found by _id
        if (user) {
          console.log(`[GET REPORT] Намерен потребител по _id: ${user.name} (${user.userId})`);
          filter.userId = user.userId; // We filter by userId, not by _id
        } else {
          // If not found by _id, use the userId directly
          console.log(`[GET REPORT] Директно филтриране по userId: ${userId}`);
          filter.userId = userId;
        }
      } catch (error) {
        console.log(`[GET REPORT] Грешка при търсене на потребител: ${error.message}`);
        filter.userId = userId; // Fallback to using the userId as-is
      }
    }
    
    console.log(`[GET REPORT] Финален филтър за търсене: ${JSON.stringify(filter)}`);
    
    const bills = await billsModel.find(filter);
    console.log(`[GET REPORT] Намерени ${bills.length} сметки по зададения филтър`);
    
    // Log the first few bills to debug
    if (bills.length > 0) {
      console.log(`[GET REPORT] Първи ${Math.min(3, bills.length)} намерени сметки:`);
      bills.slice(0, 3).forEach((bill, i) => {
        console.log(`Сметка ${i+1}: id=${bill._id}, потребител=${bill.userId}, сума=${bill.totalAmount}, артикули=${(bill.cartItems || []).length}`);
      });
    } else {
      console.log(`[GET REPORT] Не бяха намерени сметки за зададения период и потребител`);
    }
    
    // Сумиране
    const totalAmount = bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const totalBills = bills.length;
    const byPayment = bills.reduce((acc, b) => {
      let key = b.paymentMode;
      if (key === "Брой") key = "cash";
      if (key === "Карта") key = "card";
      acc[key] = (acc[key] || 0) + (b.totalAmount || 0);
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
    
    console.log(`[GET REPORT] Обобщение: общо=${totalAmount}, брой сметки=${totalBills}, артикули=${Object.keys(items).length}`);
    
    res.json({
      totalAmount,
      totalBills,
      byPayment,
      items,
      bills, // по желание: махни ако не искаш целите сметки
    });
  } catch (error) {
    console.log(`[GET REPORT] Грешка при генериране на отчет: ${error.message}`);
    res.status(500).json({ message: "Грешка при генериране на отчет!", error: error.message });
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

// Вземане на конкретен бон по ID
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
    res.status(500).json({ error: "Възникна грешка при вземане на данни за бона" });
  }
};

module.exports = {
  addBillsController,
  getBillsController,
  getReportController,
  createZReportController,
  getZReportsController,
  syncZReportController,
  getBillByIdController,
};
