export interface FloorListItem {
  id: number;
  number: number;
}

export interface RoomListItem {
  id: number;
  name: string;
  floor: number;
  floor_number?: number;
  room_type?: string;
  max_person?: number;
  is_blocked?: boolean;
  current_residents_count?: number;
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
  | 'TOILET'
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

export interface InactiveRoomOnMap {
  svg_element_id: string;
}

export interface FloorMapData {
  id: number;
  number: number;
  map_file: string | null;
  dormitory_name: string;
  notice: string;
  rooms: RoomOnMap[];
  active_floor_events: EventOnMap[];
}

export interface RoomUpdatePayload {
  name?: string;
  room_type?: number;
  max_person?: number;
  is_blocked?: boolean;
}

export interface RoomCreatePayload {
  name: string;
  room_type: number;
  max_person: number;
  is_blocked: boolean;
  svg_element_id: string;
}

export interface ResourcePayload {
  name: string;
  max_person: number;
  is_blocked: boolean;
  resource_type: number;
}
