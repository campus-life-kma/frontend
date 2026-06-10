import type { UserOnMap } from './locations';

export type EducationLevel = 'BACHELOR' | 'MASTER' | 'PHD';

export interface UserProfile {
  id: string;
  role_id: number | null;
  role_name: string | null;
  display_name: string;
  email: string;
  photo: string | null;
  room_id: number | null;
  floor_id: number | null;
  major_id: number | null;
  dormitory_name: string | null;
  floor_number: string | null;
  room_name: string | null;
  faculty_name: string | null;
  major_name: string | null;
  education_level: EducationLevel;
  year: number | string | null;
  status: string | null;
  bio: string | null;
}

export interface UserProfileEvent {
  type: 'event';
  id: number;
  title: string;
  status: string;
  start_time: string;
  creator: UserOnMap;
  is_faculty_only: boolean;
  is_major_only: boolean;
}

export interface UserProfileSharingRequest {
  type: 'sharing_request';
  id: number;
  title: string;
  creator: UserOnMap;
  status: string;
  created_at: string;
}

export interface UserSocialActivity {
  sharing_requests: UserProfileSharingRequest[];
  created_events: UserProfileEvent[];
  participating_events: UserProfileEvent[];
}

export interface UserProfileUpdatePayload {
  full_name?: string;
  email?: string;
  role?: number | null;
  room?: number | null;
  major?: number | null;
  education_level?: EducationLevel;
  year?: number | null;
  photo?: File;
  status?: string;
  bio?: string;
}
