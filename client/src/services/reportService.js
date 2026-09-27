import axios from 'axios';

// Relative URL so tablets/desktop hit the same host as the SPA (Docker / LAN)
const API_URL = '/api';

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