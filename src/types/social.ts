import type { UserOnMap } from './locations';

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

export interface SocialSharingRequest {
  type: 'sharing_request';
  id: number;
  title: string;
  creator: UserOnMap;
  status: string;
  created_at: string;
  floor_id: number | null;
}

export type FeedItem = SocialEvent | SocialSharingRequest;

export interface FeedResponse {
  page: number;
  page_size: number;
  has_next: boolean;
  results: FeedItem[];
}

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

export type SocialEventUpdatePayload = Partial<SocialEventPayload>;

export interface SharingRequestPayload {
  title: string;
}

export type SharingRequestUpdatePayload = Partial<SharingRequestPayload>;
