import fiscalService from '../services/fiscalService';

// Проверка за нов Z отчет всеки ден в 00:05
const checkNewZReport = async () => {
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
};

// Проверка на статуса на синхронизация всеки час
const checkSyncStatus = async () => {
  console.log('Проверка на статуса на синхронизация...');
  try {
    const response = await fetch('/api/bills/unsynchronized-reports');
    const unsynchronizedReports = await response.json();

    for (const report of unsynchronizedReports) {
      try {
        await fiscalService.synchronizeZReport(report._id);
        console.log('Отчет синхронизиран успешно:', report._id);
      } catch (error) {
        console.error('Грешка при синхронизация на отчет:', report._id, error);
      }
    }
  } catch (error) {
    console.error('Грешка при проверка на статуса на синхронизация:', error);
  }
};

// Инициализация на cron jobs
export const initCronJobs = () => {
  // Проверка за нов Z отчет всеки ден в 00:05
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 5) {
      checkNewZReport();
    }
  }, 60000); // Проверка на всяка минута

  // Проверка на статуса на синхронизация всеки час
  setInterval(checkSyncStatus, 60 * 60 * 1000);
}; 