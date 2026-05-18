import { create } from 'zustand';
import type { User } from '../types/auth';

const REFRESH_STORAGE_KEY = 'campus_refresh_token';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setSession: (params: {
    accessToken: string;
    refreshToken: string;
    user: User;
  }) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  getRefreshToken: () => string | null;
  setRefreshToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
    set({ accessToken, user });
  },
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => {
    localStorage.removeItem(REFRESH_STORAGE_KEY);
    set({ accessToken: null, user: null });
  },
  getRefreshToken: () => localStorage.getItem(REFRESH_STORAGE_KEY),
  setRefreshToken: (token) => localStorage.setItem(REFRESH_STORAGE_KEY, token),
}));
