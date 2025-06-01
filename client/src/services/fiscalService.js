import axios from 'axios';

class FiscalService {
  constructor() {
    this.isTestMode = true; // Тестов режим
  }

  // Проверка за нов Z отчет (тестов режим)
  async checkForNewZReport() {
    try {
      if (this.isTestMode) {
        const response = await axios.get('/api/bills/check-z-report');
        return response.data;
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
      if (this.isTestMode) {
        const response = await axios.post(`/api/bills/sync-z-report/${reportId}`);
        return response.data;
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

export default new FiscalService(); 