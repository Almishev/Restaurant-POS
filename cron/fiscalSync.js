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
