import axios from 'axios';
import { create } from 'zustand';
import type { RefreshResponse, User } from '../types/auth';
import { msalInstance } from '../api/msal-config';

/** Ключ для збереження refresh токена в localStorage. */
const REFRESH_STORAGE_KEY = 'campus_refresh_token';
/** Ключ для збереження даних користувача в localStorage. */
const USER_STORAGE_KEY = 'campus_user';

/**
 * Завантажує збережені дані користувача з localStorage.
 * Очищує запис у разі помилки десеріалізації JSON.
 *
 * @returns Об'єкт користувача або null, якщо дані відсутні чи некоректні.
 */
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

/**
 * Опис структури стану та методів сховища авторизації (authStore).
 */
interface AuthState {
  /** Поточний JWT access токен користувача (в пам'яті). */
  accessToken: string | null;
  /** Дані авторизованого користувача. */
  user: User | null;
  /** Вказує, чи завершилась спроба відновлення сесії (bootstrap). */
  isBootstrapped: boolean;
  /** Встановлює нову активну сесію та зберігає токени/користувача. */
  setSession: (params: {
    accessToken: string;
    refreshToken: string;
    user: User;
  }) => void;
  /** Встановлює новий access токен в пам'яті. */
  setAccessToken: (accessToken: string) => void;
  /** Оновлює дані поточного користувача. */
  updateUser: (updates: Partial<User>) => void;
  /** Очищає сесію (видаляє токени та дані користувача з пам'яті та сховища). */
  clearSession: () => void;
  /** Виконує вихід із системи (очищає сесію та скидає кеш MSAL, якщо є). */
  logout: () => Promise<void>;
  /** Відновлює сесію при завантаженні за допомогою refresh токена. */
  bootstrap: () => Promise<void>;
  /** Повертає збережений refresh токен з localStorage. */
  getRefreshToken: () => string | null;
  /** Зберігає новий або оновлений refresh токен в localStorage. */
  setRefreshToken: (token: string) => void;
}

/**
 * Сховище Zustand для керування станом авторизації користувача.
 * Зберігає access токен в пам'яті, а user та refresh токен — у localStorage.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: loadPersistedUser(),
  isBootstrapped: false,
  setSession: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    set({ accessToken, user, isBootstrapped: true });
  },
  setAccessToken: (accessToken) => set({ accessToken }),
  updateUser: (updates) => {
    const user = get().user;
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },
  clearSession: () => {
    localStorage.removeItem(REFRESH_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    set({ accessToken: null, user: null });
  },
  logout: async () => {
    // Якщо користувач увійшов через Microsoft, очищуємо також кеш MSAL
    if (msalInstance.getAllAccounts().length > 0) {
      try {
        await msalInstance.clearCache();
      } catch {
        // ігноруємо помилки MSAL, локальну сесію все одно очищаємо
      }
    }
    localStorage.removeItem(REFRESH_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    set({ accessToken: null, user: null });
  },
  bootstrap: async () => {
    // Запобігаємо повторному запуску відновлення сесії
    if (get().isBootstrapped) return;
    const refreshToken = localStorage.getItem(REFRESH_STORAGE_KEY);
    if (!refreshToken) {
      set({ isBootstrapped: true });
      return;
    }
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      // Запит на отримання нового access токена по існуючому refresh токену
      const { data } = await axios.post<RefreshResponse>(
        `${apiUrl}/auth/refresh/`,
        { refresh: refreshToken }
      );
      if (data.refresh) {
        localStorage.setItem(REFRESH_STORAGE_KEY, data.refresh);
      }
      set({ accessToken: data.access });

      try {
        // Оновлюємо дані користувача з сервера
        const { data: me } = await axios.get<User>(`${apiUrl}/auth/me/`, {
          headers: { Authorization: `Bearer ${data.access}` },
        });
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me));
        set({ user: me });
      } catch {
        // У разі помилки /me залишаємо локально збережені дані користувача
        set({ user: get().user });
      }

      set({ isBootstrapped: true });
    } catch {
      // Якщо токен недійсний, повністю очищуємо сесію
      localStorage.removeItem(REFRESH_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      set({ accessToken: null, user: null, isBootstrapped: true });
    }
  },
  getRefreshToken: () => localStorage.getItem(REFRESH_STORAGE_KEY),
  setRefreshToken: (token) => localStorage.setItem(REFRESH_STORAGE_KEY, token),
}));
