import apiClient from './client';

export const settlementsApi = {
  generate: (jobId: string) => apiClient.post(`/jobs/${jobId}/settlement`),
  getById: (id: string) => apiClient.get(`/settlements/${id}`),
  approve: (id: string) => apiClient.patch(`/settlements/${id}/approve`),
  addAdjustment: (id: string, data: any) => apiClient.post(`/settlements/${id}/adjustment`, data),
  exportPdf: (id: string) => apiClient.get(`/settlements/${id}/export/pdf`, { responseType: 'blob' }),
  exportCsv: (id: string) => apiClient.get(`/settlements/${id}/export/csv`, { responseType: 'blob' }),
  recordPayment: (id: string, data: any) => apiClient.post(`/settlements/${id}/payments`, data),
  getPayments: (id: string) => apiClient.get(`/settlements/${id}/payments`),
};
