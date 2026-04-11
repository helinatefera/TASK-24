import apiClient from './client';

export const authApi = {
  register: (data: { username: string; email: string; password: string; role?: string }) =>
    apiClient.post('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    apiClient.post('/auth/login', data),
  logout: () => apiClient.post('/auth/logout'),
};
