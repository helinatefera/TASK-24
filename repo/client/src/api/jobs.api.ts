import apiClient from './client';

export const jobsApi = {
  create: (data: any) => apiClient.post('/jobs', data),
  getAll: (params?: any) => apiClient.get('/jobs', { params }),
  getById: (id: string) => apiClient.get(`/jobs/${id}`),
  update: (id: string, data: any) => apiClient.put(`/jobs/${id}`, data),
  assign: (id: string, photographerId: string) => apiClient.patch(`/jobs/${id}/assign`, { photographerId }),
  confirmAgreement: (id: string, password: string) => apiClient.post(`/jobs/${id}/agreement/confirm`, { password }),
  getMessages: (jobId: string) => apiClient.get(`/jobs/${jobId}/messages`),
  sendMessage: (jobId: string, messageText: string) => apiClient.post(`/jobs/${jobId}/messages`, { messageText }),
  getWorkEntries: (jobId: string) => apiClient.get(`/jobs/${jobId}/work-entries`),
  createWorkEntry: (jobId: string, data: any) => apiClient.post(`/jobs/${jobId}/work-entries`, data),
  getDeliverables: (jobId: string) => apiClient.get(`/jobs/${jobId}/deliverables`),
  uploadDeliverable: (jobId: string, data: FormData) => apiClient.post(`/jobs/${jobId}/deliverables`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getEscrow: (jobId: string) => apiClient.get(`/jobs/${jobId}/escrow`),
  addEscrow: (jobId: string, data: any) => apiClient.post(`/jobs/${jobId}/escrow`, data),
};
