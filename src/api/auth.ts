import api from './axios-instance';
import type { LoginResponse } from '../types/auth';

/**
 * Виконує вхід до системи за допомогою Microsoft access токена.
 *
 * @param microsoftAccessToken - Токен доступу, отриманий від MSAL.
 * @returns Проміс з даними авторизації (користувач та токени).
 */
export async function loginWithMicrosoft(
  microsoftAccessToken: string
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login/', {
    microsoft_access_token: microsoftAccessToken,
  });
  return data;
}

/**
 * Виконує вхід до системи за допомогою email для
 * локального тестування (dev режим).
 *
 * @param email - Тестовий email користувача.
 * @returns Проміс з даними авторизації.
 */
export async function devLogin(email: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/dev-login/', { email });
  return data;
}
