const cron = require('node-cron');
const fiscalService = require('../services/fiscalService');

// Проверка за нов Z отчет всеки ден в 00:05
cron.schedule('5 0 * * *', async () => {
  console.log('Проверка за нов Z отчет от фискално устройство...');
  try {
    const newReport = await fiscalService.checkForNewZReport();
    if (newReport) {
      console.log('Нов Z отчет синхронизиран успешно:', newReport._id);
    } else {
      console.log('Няма нов Z отчет за синхронизация');
    }
  } catch (error) {
    console.error('Грешка при автоматична синхронизация на Z отчет:', error);
  }
});

// Проверка на статуса на синхронизация всеки час
cron.schedule('0 * * * *', async () => {
  console.log('Проверка на статуса на синхронизация...');
  try {
    const unsynchronizedReports = await Report.find({
      type: 'Z',
      isSynchronized: false,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // последните 24 часа
    });

    for (const report of unsynchronizedReports) {
      try {
        await fiscalService.synchronizeZReport(report._id);
        console.log('Отчет синхронизиран успешно:', report._id);
      } catch (error) {
        console.error('Грешка при синхронизация на отчет:', report._id, error);
        report.syncError = error.message;
        await report.save();
      }
    }
  } catch (error) {
    console.error('Грешка при проверка на статуса на синхронизация:', error);
  }
}); 