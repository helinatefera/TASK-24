import apiClient from './client';

export const consentApi = {
  recordConsent: (data: any) => apiClient.post('/consent', data),
  getHistory: () => apiClient.get('/consent/history'),
  getCurrentPolicy: () => apiClient.get('/consent/current-policy'),
  getPolicyHistory: () => apiClient.get('/consent/policy-history'),
  recordCategoryConsent: (data: any) => apiClient.post('/consent/data-category', data),
  revokeCategoryConsent: (category: string) => apiClient.delete(`/consent/data-category/${category}`),
  getCategoryConsents: () => apiClient.get('/consent/data-category'),
  getDataCategories: () => apiClient.get('/consent/data-categories'),
};
