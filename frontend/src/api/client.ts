import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach the access token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor to handle responses and global errors
apiClient.interceptors.response.use((response) => {
  const contentType = response.headers['content-type'];
  if (contentType && contentType.includes('text/html') && typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
    return Promise.reject({
      message: 'Unexpected HTML response from API. Likely a Vercel cache issue.',
      response: { status: 500, data: { detail: 'Vercel Cache Error' } }
    });
  }
  return response;
}, (error) => {
  const isLoginRequest = error.config?.url?.includes('/auth/login');
  if (error.response?.status === 401 && !isLoginRequest) {
    // If unauthorized and not a login request, token is likely expired or invalid
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

export default apiClient;
