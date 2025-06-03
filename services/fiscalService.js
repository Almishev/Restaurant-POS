const Report = require('../models/reportModel');

class FiscalService {
  constructor() {
    this.isTestMode = true; // Тестов режим
  }

  // Проверка за нов Z отчет (тестов режим)
  async checkForNewZReport() {
    try {
      if (this.isTestMode) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // Проверка дали вече има отчет за днес
        const existingReport = await Report.findOne({
          type: 'Z',
          from: startOfDay,
          to: { $gte: startOfDay, $lte: now },
          isTestMode: true
        });
        if (!existingReport) {
          // Създаване на тестов Z отчет
          const newReport = new Report({
            type: 'Z',
            from: startOfDay,
            to: now,
            totalAmount: 0,
            totalBills: 0,
            byPayment: {},
            items: {},
            bills: [],
            isSynchronized: true,
            synchronizedAt: new Date(),
            isTestMode: true,
            fiscalReportId: `TEST-${Date.now()}`
          });
          await newReport.save();
          console.log('Създаден тестов Z отчет:', newReport._id);
          return newReport;
        }
      }
      return null;
    } catch (error) {
      console.error('Грешка при проверка за нов Z отчет:', error);
      throw error;
    }
  }

  // Ръчна синхронизация на Z отчет (тестов режим)
  async synchronizeZReport(reportId) {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error('Отчетът не е намерен');
      }
      if (this.isTestMode) {
        // В тестов режим просто маркираме като синхронизиран
        report.isSynchronized = true;
        report.synchronizedAt = new Date();
        report.isTestMode = true;
        await report.save();
        return report;
      }
    } catch (error) {
      console.error('Грешка при синхронизация на Z отчет:', error);
      throw error;
    }
  }
  // Метод за включване/изключване на тестов режим
  setTestMode(enabled) {
    this.isTestMode = enabled;
  }

  // Метод за отпечатване на сторно бон (тестов режим)
  async printStornoBon(originalBill, stornoId, reason, cartItems) {
    try {
      if (this.isTestMode) {
        // В тестов режим симулираме фискалния процес
        console.log('[FISCAL SERVICE] Printing storno receipt for bill:', originalBill._id);
        console.log('[FISCAL SERVICE] Storno reason:', reason);
        console.log('[FISCAL SERVICE] Items:', cartItems);
        
        // Забавяне за симулация на процеса
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Връщане на тестови данни
        return {
          success: true,
          fiscalReceiptId: `STORNO-TEST-${Date.now()}`,
          timestamp: new Date(),
          message: "Сторно бонът е генериран успешно (тестов режим)"
        };
      } else {
        // Реална интеграция с фискално устройство
        // Тук бихме имали код за връзка с фискалния принтер
        
        // Пример за структура на данни, която бихме изпратили към фискалното устройство
        const fiscalData = {
          type: 'storno',
          operator: 1, // ID на оператора
          originalReceiptId: originalBill.fiscalReceiptId,
          items: cartItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            vatGroup: 'B', // ДДС група (зависи от изискванията)
            department: 1 // Отдел (зависи от изискванията)
          })),
          reason: this.mapStornoReasonToFiscalCode(reason),
          payment: originalBill.paymentMode === 'cash' ? 'cash' : 'card',
          stornoReferenceId: stornoId
        };
        
        console.log('[FISCAL SERVICE] Preparing fiscal data for real device:', fiscalData);
        
        // Симулация на заявка към фискално устройство
        // В реалния случай тук бихме имали HTTP заявка или друг метод за комуникация
        // await axios.post('http://localhost:8080/fiscal-printer', fiscalData);
        
        throw new Error("Реалният режим на фискализация все още не е имплементиран");
      }
    } catch (error) {
      console.error('[FISCAL SERVICE] Error printing storno receipt:', error);
      throw error;
    }
  }

  // Помощен метод за маппинг на основанията за сторниране към фискални кодове
  mapStornoReasonToFiscalCode(reason) {
    const reasonMap = {
      operatorError: 1, // Операторска грешка
      returnedItems: 2, // Върната стока
      defectiveGoods: 3, // Дефектна стока
      other: 0          // Друго
    };
    
    return reasonMap[reason] || 0;
  }
}

module.exports = new FiscalService();