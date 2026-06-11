export interface User {
  id: string;
  email: string;
  role: string | null;
  full_name: string | null;
  room_id: string | null;
  floor_id: string | null;
  dormitory_id: string | null;
  photo: string | null;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RefreshResponse {
  access: string;
  refresh?: string;
}
