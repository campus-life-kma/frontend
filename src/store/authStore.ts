import axios from 'axios';
import { create } from 'zustand';
import type { RefreshResponse, User } from '../types/auth';
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
  isBootstrapped: boolean;
  setSession: (params: {
    accessToken: string;
    refreshToken: string;
    user: User;
  }) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  getRefreshToken: () => string | null;
  setRefreshToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: loadPersistedUser(),
  isBootstrapped: false,
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
        await msalInstance.clearCache();
      } catch {
        // ignore — drop local state regardless
      }
    }
    localStorage.removeItem(REFRESH_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    set({ accessToken: null, user: null });
  },
  bootstrap: async () => {
    if (get().isBootstrapped) return;
    const refreshToken = localStorage.getItem(REFRESH_STORAGE_KEY);
    if (!refreshToken) {
      set({ isBootstrapped: true });
      return;
    }
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const { data } = await axios.post<RefreshResponse>(
        `${apiUrl}/auth/refresh/`,
        { refresh: refreshToken }
      );
      if (data.refresh) {
        localStorage.setItem(REFRESH_STORAGE_KEY, data.refresh);
      }
      set({ accessToken: data.access });

      // Refresh the persisted profile so newly added fields (e.g. room_id)
      // and admin-side changes (room, role) are picked up without re-login.
      try {
        const { data: me } = await axios.get<User>(`${apiUrl}/auth/me/`, {
          headers: { Authorization: `Bearer ${data.access}` },
        });
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me));
        set({ user: me });
      } catch {
        // Keep the persisted user if the profile refresh fails.
      }

      set({ isBootstrapped: true });
    } catch {
      localStorage.removeItem(REFRESH_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      set({ accessToken: null, user: null, isBootstrapped: true });
    }
  },
  getRefreshToken: () => localStorage.getItem(REFRESH_STORAGE_KEY),
  setRefreshToken: (token) => localStorage.setItem(REFRESH_STORAGE_KEY, token),
}));
