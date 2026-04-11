import apiClient from './client';

export const profilesApi = {
  getProfile: (id: string) => apiClient.get(`/profiles/${id}`),
  getMyProfile: () => apiClient.get('/profiles/me'),
  updateProfile: (data: any) => apiClient.put('/profiles/me', data),
  getProfiles: (params?: any) => apiClient.get('/profiles', { params }),
};
