import apiClient from './client';

export const workEntriesApi = {
  update: (id: string, data: any) => apiClient.put(`/work-entries/${id}`, data),
  confirm: (id: string) => apiClient.patch(`/work-entries/${id}/confirm`),
};
