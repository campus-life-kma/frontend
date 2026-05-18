import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '../store/authStore';
import type { RefreshResponse } from '../types/auth';

const baseURL = import.meta.env.VITE_API_URL;

const api = axios.create({ baseURL });

const refreshClient = axios.create({ baseURL });

interface RetriableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const store = useAuthStore.getState();
  const refreshToken = store.getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  const { data } = await refreshClient.post<RefreshResponse>('/auth/refresh/', {
    refresh: refreshToken,
  });

  store.setAccessToken(data.access);
  if (data.refresh) {
    store.setRefreshToken(data.refresh);
  }
  return data.access;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequest | undefined;
    const status = error.response?.status;

    if (status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = performRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      const newAccessToken = await refreshPromise;
      originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
      return api.request(originalRequest as AxiosRequestConfig);
    } catch (refreshError) {
      useAuthStore.getState().clearSession();
      if (
        typeof window !== 'undefined' &&
        window.location.pathname !== '/login'
      ) {
        window.location.assign('/login');
      }
      return Promise.reject(refreshError);
    }
  }
);

export default api;
