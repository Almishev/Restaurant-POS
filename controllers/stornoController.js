const Storno = require("../models/stornoModel");
const Bills = require("../models/billsModel");
const fiscalService = require("../services/fiscalService");

// Създаване на сторно бон
const createStornoController = async (req, res) => {
  try {
    const { originalBillId, reason, reasonText, cartItems, userId, userName } = req.body;
    
    // Валидиране на входните данни
    if (!originalBillId || !reason || !cartItems || !cartItems.length || !userId || !userName) {
      return res.status(400).json({ 
        error: "Непълни данни за сторно операцията. Моля, проверете задължителните полета." 
      });
    }
    
    // Проверка за валидна причина
    const validReasons = ["operatorError", "returnedItems", "defectiveGoods", "other"];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ 
        error: "Невалидна причина за сторниране" 
      });
    }
    
    // Валидиране на оригиналния бон
    const originalBill = await Bills.findById(originalBillId);
    if (!originalBill) {
      return res.status(404).json({ error: "Оригиналният бон не е намерен" });
    }
      // Проверка за същата работна смяна (24 часа)
    const currentDate = new Date();
    // Използваме date или createdAt, което от двете е налично
    const billDate = new Date(originalBill.createdAt || originalBill.date);
    const timeDiff = Math.abs(currentDate - billDate) / 36e5; // hours
    
    console.log("[STORNO CONTROLLER] Оригинален бон:", originalBill._id, "Дата:", billDate, "Разлика в часове:", timeDiff);
    
    if (timeDiff > 24) {
      return res.status(400).json({ 
        error: "Сторниране е възможно само в рамките на същата работна смяна (24 часа)" 
      });
    }
    
    // Изчисляване на стойности за избраните артикули
    const subTotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const tax = subTotal * 0.2; // 20% ДДС
    const totalAmount = subTotal + tax;
    
    // Създаване на сторно документ
    const stornoBill = new Storno({
      originalBillId,
      userId,
      userName,
      cartItems,
      subTotal,
      tax,
      totalAmount,
      paymentMode: originalBill.paymentMode,
      reason,
      reasonText: reasonText || "",
      originalBillFiscalId: originalBill.fiscalReceiptId || ""
    });
    
    // Запис в базата данни
    const newStorno = await stornoBill.save();
    
    // Интеграция с фискално устройство
    try {
      const fiscalResult = await fiscalService.printStornoBon(
        originalBill, 
        newStorno._id,
        reason, 
        cartItems
      );
      
      // Обновяване на сторно документа с фискална информация
      newStorno.fiscalReceiptId = fiscalResult.fiscalReceiptId;
      newStorno.fiscalReceiptTimestamp = fiscalResult.timestamp;
      newStorno.fiscalStatus = "completed";
      await newStorno.save();
      
    } catch (fiscalError) {
      console.log("[STORNO] Fiscal error:", fiscalError);
      
      // Запазване на информация за грешката
      newStorno.fiscalStatus = "error";
      newStorno.fiscalErrorMessage = fiscalError.message || "Грешка при фискализация";
      await newStorno.save();
      
      // Връщане на отговор за успешно създаден запис, но с проблем при фискализацията
      return res.status(207).json({
        success: true,
        stornoId: newStorno._id,
        fiscalError: fiscalError.message || "Неизвестна грешка при фискализация",
        message: "Сторно операцията е записана, но има проблем с фискализацията"
      });
    }
    
    res.status(201).json({
      success: true,
      stornoId: newStorno._id,
      message: "Сторно операцията е успешна"
    });
    
  } catch (error) {
    console.log("[STORNO] Error creating storno:", error);
    res.status(500).json({
      error: error.message || "Грешка при сторниране"
    });
  }
};

// Вземане на всички сторно бонове
const getStornosController = async (req, res) => {
  try {
    const { role, userId, startDate, endDate, customerName, reason } = req.query;
    let query = {};
    
    // Филтриране по потребител, ако не е админ
    if (role !== 'admin' && userId) {
      query = { userId };
    }
    
    // Добавяне на филтри за дата, ако са предоставени
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Допълнителни филтри
    if (customerName) {
      query.customerName = { $regex: customerName, $options: 'i' }; // Case-insensitive търсене
    }
    
    if (reason) {
      query.reason = reason;
    }
    
    const stornos = await Storno.find(query).sort({ createdAt: -1 });
    res.status(200).json(stornos);
    
  } catch (error) {
    console.log("[STORNO] Error fetching stornos:", error);
    res.status(500).json({
      error: error.message || "Грешка при извличане на сторно данни"
    });
  }
};

// Генериране на отчет за сторно операциите
const getStornoReportController = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    
    let query = {};
    
    // Филтриране по потребител, ако е предоставен
    if (userId) {
      query.userId = userId;
    }
    
    // Филтриране по дата
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const stornos = await Storno.find(query);
    
    // Обобщена информация за отчета
    const totalAmount = stornos.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalCount = stornos.length;
    
    // Групиране по причина
    const byReason = stornos.reduce((acc, s) => {
      acc[s.reason] = acc[s.reason] || { count: 0, amount: 0 };
      acc[s.reason].count++;
      acc[s.reason].amount += s.totalAmount;
      return acc;
    }, {});
    
    // Групиране по потребител
    const byUser = stornos.reduce((acc, s) => {
      acc[s.userName] = acc[s.userName] || { count: 0, amount: 0 };
      acc[s.userName].count++;
      acc[s.userName].amount += s.totalAmount;
      return acc;
    }, {});
    
    // Групиране по дата
    const byDate = stornos.reduce((acc, s) => {
      const date = new Date(s.createdAt).toISOString().split('T')[0];
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
      stornos: stornos.map(s => ({
        id: s._id,
        date: s.createdAt,
        originalBillId: s.originalBillId,
        reason: s.reason,
        amount: s.totalAmount,
        userName: s.userName,
        fiscalStatus: s.fiscalStatus
      }))
    });
    
  } catch (error) {
    console.log("[STORNO] Error generating storno report:", error);
    res.status(500).json({
      error: error.message || "Грешка при генериране на отчет за сторно операциите"
    });
  }
};

// Вземане на детайли за конкретно сторно
const getStornoDetailsController = async (req, res) => {
  try {
    const { id } = req.params;
    const storno = await Storno.findById(id);
    
    if (!storno) {
      return res.status(404).json({ error: "Сторно бонът не е намерен" });
    }
    
    // Извличане на данни за оригиналния бон
    const originalBill = await Bills.findById(storno.originalBillId);
    
    res.status(200).json({
      storno,
      originalBill: originalBill || { message: "Оригиналният бон не е намерен" }
    });
    
  } catch (error) {
    console.log("[STORNO] Error fetching storno details:", error);
    res.status(500).json({
      error: error.message || "Грешка при извличане на данни за сторно бона"
    });
  }
};

module.exports = {
  createStornoController,
  getStornosController,
  getStornoDetailsController,
  getStornoReportController
};
