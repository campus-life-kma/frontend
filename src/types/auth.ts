/** Модель авторизованого користувача. */
export interface User {
  id: string;
  email: string;
  role: string | null;
  full_name: string | null;
  room_id: string | null;
  floor_id: string | null;
  dormitory_id: string | null;
  major_id: string | null;
  faculty_id: string | null;
  photo: string | null;
}

/** Відповідь сервера при успішному вході до системи. */
export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

/** Відповідь сервера при оновленні сесії (JWT access токена). */
export interface RefreshResponse {
  access: string;
  refresh?: string;
}
