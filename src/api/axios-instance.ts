import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '../store/authStore';
import type { RefreshResponse } from '../types/auth';

const baseURL = import.meta.env.VITE_API_URL;

/** Основний екземпляр Axios для виконання авторизованих запитів. */
const api = axios.create({ baseURL });

/** Додатковий екземпляр Axios суто для виконання запитів оновлення токена. */
const refreshClient = axios.create({ baseURL });

interface RetriableRequest extends InternalAxiosRequestConfig {
  /** Прапорець для запобігання нескінченного циклу повторення запиту. */
  _retry?: boolean;
}

// Перехоплювач запитів: автоматично додає JWT access токен у заголовки
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

/**
 * Проміс активного процесу оновлення токена для
 * уникнення дублювання запитів на оновлення.
 */
let refreshPromise: Promise<string> | null = null;

/**
 * Виконує запит до API для оновлення access токена за допомогою refresh токена.
 * Зберігає нові токени в сховище authStore.
 *
 * @returns Новий згенерований access токен.
 */
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

// Перехоплювач відповідей: обробляє помилки 401 Unauthorized
// та намагається оновити токен та повторити оригінальний запит.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequest | undefined;
    const status = error.response?.status;

    // Якщо це не 401 помилка або запит вже повторювався, відхиляємо проміс
    if (status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      // Якщо оновлення токена ще не розпочалося, створюємо нову обіцянку
      if (!refreshPromise) {
        refreshPromise = performRefresh().finally(() => {
          refreshPromise = null;
        });
      }

      // Чекаємо завершення оновлення
      // всі паралельні 401 запити чекають один проміс
      const newAccessToken = await refreshPromise;
      originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);

      // Повторюємо оригінальний запит з новим токеном
      return api.request(originalRequest as AxiosRequestConfig);
    } catch (refreshError) {
      // Якщо оновлення токена завершилось помилкою, розлогінюємо користувача
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
