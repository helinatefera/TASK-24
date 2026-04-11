import apiClient from './client';

export const deliverablesApi = {
  upload: (jobId: string, data: FormData) => apiClient.post(`/jobs/${jobId}/deliverables`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getByJob: (jobId: string) => apiClient.get(`/jobs/${jobId}/deliverables`),
};
