import apiClient from './client';

export const paymentsApi = {
  record: (settlementId: string, data: any) => apiClient.post(`/settlements/${settlementId}/payments`, data),
  getBySettlement: (settlementId: string) => apiClient.get(`/settlements/${settlementId}/payments`),
};
