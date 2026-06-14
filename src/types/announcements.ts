import type { UserOnMap } from './locations';

/** Опис моделі оголошення. */
export interface Announcement {
  id: number;
  title: string;
  message: string;
  creator: UserOnMap;
  target_type: string;
  target_floor_id: number | null;
  target_room_id: number | null;
  target_user_ids: string[];
  created_at: string;
  expires_at: string | null;
  is_pinned: boolean;
}

/** Типи цільової аудиторії для показу оголошення. */
export type AnnouncementTargetType =
  | 'GLOBAL'
  | 'FLOOR'
  | 'ROOM'
  | 'SPECIFIC_USERS';

/** Дані для створення або оновлення оголошення. */
export interface AnnouncementPayload {
  title: string;
  message: string;
  target_type: AnnouncementTargetType;
  target_floor?: number | null;
  target_room?: number | null;
  target_users?: string[];
  expires_at?: string | null;
  is_pinned?: boolean;
}

/** Опис одержувача оголошення. */
export interface AnnouncementRecipient {
  id: string;
  display_name: string;
  email: string;
  photo: string | null;
  role_name: string | null;
  floor_id: number | null;
  floor_number: number | null;
  room_id: number | null;
  room_name: string | null;
  faculty_name: string | null;
  major_name: string | null;
  year: number | null;
  is_activated: boolean;
  position: string | null;
}

/** Фільтри для вибору одержувачів оголошення. */
export interface AnnouncementRecipientFilters {
  q?: string;
  ordering?: string;
  floor_id?: string | number;
  room_id?: string | number;
  faculty_id?: string | number;
  major_id?: string | number;
  role?: string;
  year?: string | number;
  position?: string;
  is_active?: boolean | string;
}
