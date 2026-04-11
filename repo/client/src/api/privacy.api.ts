import apiClient from './client';

export const privacyApi = {
  getSettings: () => apiClient.get('/privacy/settings'),
  updateSettings: (data: any) => apiClient.put('/privacy/settings', data),
};
