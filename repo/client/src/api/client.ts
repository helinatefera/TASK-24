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

const PUBLIC_PATHS = ['/login', '/register'];

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user');
      // Only redirect if the user is on a protected page. Otherwise the initial
      // `/auth/me` probe on public pages (login, register) would kick the user
      // off of the page they're trying to reach.
      const currentPath = window.location.pathname;
      const onPublicPage = PUBLIC_PATHS.some(p => currentPath.startsWith(p));
      if (!onPublicPage) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
