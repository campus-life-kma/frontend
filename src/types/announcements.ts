import type { UserOnMap } from './locations';

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
