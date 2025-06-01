import axios from 'axios';

const API_URL = 'http://localhost:8081/api';

export const reportService = {
  async getReports() {
    const response = await axios.get(`${API_URL}/bills/z-reports`);
    return response.data;
  },
  async getReportById(id) {
    const response = await axios.get(`${API_URL}/reports/${id}`);
    return response.data;
  },
  async synchronizeReport(id) {
    const response = await axios.post(`${API_URL}/reports/${id}/synchronize`);
    return response.data;
  }
}; 