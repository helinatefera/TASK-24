import axios from 'axios';
import { generateNonce, getTimestamp } from '../utils/nonce';

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  // Nonce + timestamp for replay protection — no token in headers (httpOnly cookie handles auth)
  config.headers['X-Nonce'] = generateNonce();
  config.headers['X-Timestamp'] = getTimestamp();
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Session cookie expired or invalid — redirect to login
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
