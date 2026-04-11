import apiClient from './client';

export const verificationApi = {
  submit: (data: FormData) => apiClient.post('/verification/submit', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getStatus: () => apiClient.get('/verification/status'),
};
