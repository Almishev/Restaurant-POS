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
}

module.exports = new FiscalService(); 