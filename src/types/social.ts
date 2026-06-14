import type { UserOnMap } from './locations';

/** Модель соціальної події (Social Event). */
export interface SocialEvent {
  type: 'event';
  id: number;
  title: string;
  description: string;
  status: string;
  start_time: string;
  end_time: string;
  max_person: number;
  is_faculty_only: boolean;
  is_major_only: boolean;
  creator: UserOnMap;
  participants_count?: number;
  participants?: UserOnMap[];
  room_id: number | null;
  room_name: string | null;
  floor_id: number | null;
  custom_location: string | null;
}

/** Модель запиту на обмін речами (Sharing Request). */
export interface SocialSharingRequest {
  type: 'sharing_request';
  id: number;
  title: string;
  creator: UserOnMap;
  status: string;
  created_at: string;
  floor_id: number | null;
}

/** Об'єднаний тип для елементів соціальної стрічки. */
export type FeedItem = SocialEvent | SocialSharingRequest;

/** Відповідь сервера зі сторінкою стрічки активностей. */
export interface FeedResponse {
  page: number;
  page_size: number;
  has_next: boolean;
  results: FeedItem[];
}

/** Дані для створення нової соціальної події. */
export interface SocialEventPayload {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  max_person: number;
  is_faculty_only: boolean;
  is_major_only: boolean;
  room?: number | null;
  floor?: number | null;
  custom_location?: string | null;
}

/** Дані для оновлення соціальної події. */
export type SocialEventUpdatePayload = Partial<SocialEventPayload>;

/** Дані для створення запиту на обмін речами. */
export interface SharingRequestPayload {
  title: string;
}

/** Дані для оновлення запиту на обмін речами. */
export type SharingRequestUpdatePayload = Partial<SharingRequestPayload>;
