import { create } from 'zustand';
import type { User } from '../types/auth';
import { msalInstance } from '../api/msal-config';

const REFRESH_STORAGE_KEY = 'campus_refresh_token';
const USER_STORAGE_KEY = 'campus_user';

function loadPersistedUser(): User | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

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
  logout: () => Promise<void>;
  getRefreshToken: () => string | null;
  setRefreshToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: loadPersistedUser(),
  setSession: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    set({ accessToken, user });
  },
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => {
    localStorage.removeItem(REFRESH_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    set({ accessToken: null, user: null });
  },
  logout: async () => {
    if (msalInstance.getAllAccounts().length > 0) {
      try {
        await msalInstance.logoutPopup();
      } catch {
        // popup blocked or cancelled — clear local state anyway
      }
    }
    localStorage.removeItem(REFRESH_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    set({ accessToken: null, user: null });
  },
  getRefreshToken: () => localStorage.getItem(REFRESH_STORAGE_KEY),
  setRefreshToken: (token) => localStorage.setItem(REFRESH_STORAGE_KEY, token),
}));
