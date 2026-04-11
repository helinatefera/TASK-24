import apiClient from './client';

export const reportsApi = {
  create: (data: FormData) => apiClient.post('/reports', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getMyReports: () => apiClient.get('/reports/my'),
};
