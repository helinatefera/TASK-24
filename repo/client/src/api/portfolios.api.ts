import apiClient from './client';

export const portfoliosApi = {
  getAll: (params?: any) => apiClient.get('/portfolios', { params }),
  getById: (id: string) => apiClient.get(`/portfolios/${id}`),
  getImages: (id: string) => apiClient.get(`/portfolios/${id}/images`),
  create: (data: any) => apiClient.post('/portfolios', data),
  update: (id: string, data: any) => apiClient.put(`/portfolios/${id}`, data),
  addImage: (id: string, data: FormData) => apiClient.post(`/portfolios/${id}/images`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  removeImage: (portfolioId: string, imageId: string) => apiClient.delete(`/portfolios/${portfolioId}/images/${imageId}`),
};
