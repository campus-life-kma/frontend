import api from './axios-instance';
import type { LoginResponse } from '../types/auth';

export async function loginWithMicrosoft(
  microsoftAccessToken: string
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login/', {
    microsoft_access_token: microsoftAccessToken,
  });
  return data;
}

export async function devLogin(email: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/dev-login/', { email });
  return data;
}
