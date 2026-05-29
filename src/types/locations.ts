export interface FloorListItem {
  id: number;
  number: number;
}

export interface UserOnMap {
  id: string;
  display_name: string;
  photo: string | null;
}

export interface EventOnMap {
  id: number;
  title: string;
  creator: UserOnMap;
  participants_count: number;
}

export interface ResourceOnMap {
  id: number;
  name: string;
  max_person: number;
  is_blocked: boolean;
  resource_type?: string;
  resource_icon?: string | null;
}

export type RoomType =
  | 'LIVING'
  | 'COMMON_AREA'
  | 'KITCHEN'
  | 'LAUNDRY'
  | 'BATHROOM'
  | 'STORAGE';

export interface RoomOnMap {
  id: number;
  name: string;
  room_type: RoomType | string;
  max_person: number;
  is_blocked: boolean;
  svg_element_id: string;
  resources: ResourceOnMap[];
  current_users: UserOnMap[];
  active_events: EventOnMap[];
}

export interface FloorMapData {
  id: number;
  number: number;
  map_file: string | null;
  dormitory_name: string;
  rooms: RoomOnMap[];
  active_floor_events: EventOnMap[];
}
