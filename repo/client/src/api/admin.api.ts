import apiClient from './client';

export const adminApi = {
  getUsers: (params?: any) => apiClient.get('/admin/users', { params }),
  updateUserRole: (id: string, role: string) => apiClient.patch(`/admin/users/${id}/role`, { role }),
  updateUserStatus: (id: string, accountStatus: string) => apiClient.patch(`/admin/users/${id}/status`, { accountStatus }),
  addBlacklist: (data: any) => apiClient.post('/admin/blacklist', data),
  removeBlacklist: (id: string) => apiClient.delete(`/admin/blacklist/${id}`),
  getContentReviews: (params?: any) => apiClient.get('/admin/content-reviews', { params }),
  reviewContent: (id: string, data: any) => apiClient.patch(`/admin/content-reviews/${id}`, data),
  getReports: (params?: any) => apiClient.get('/admin/reports', { params }),
  reviewReport: (id: string, data: any) => apiClient.patch(`/admin/reports/${id}`, data),
  getSensitiveWords: () => apiClient.get('/admin/sensitive-words'),
  addSensitiveWord: (data: any) => apiClient.post('/admin/sensitive-words', data),
  removeSensitiveWord: (id: string) => apiClient.delete(`/admin/sensitive-words/${id}`),
  getAuditLogs: (params?: any) => apiClient.get('/admin/audit', { params }),
  createPrivacyPolicy: (data: any) => apiClient.post('/admin/privacy-policies', data),
  getPrivacyPolicies: () => apiClient.get('/admin/privacy-policies'),
  getVerificationRequests: (params?: any) => apiClient.get('/verification/requests', { params }),
  reviewVerification: (id: string, data: any) => apiClient.patch(`/verification/${id}/review`, data),
};
