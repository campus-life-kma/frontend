/** Елемент списку поверхів. */
export interface FloorListItem {
  id: number;
  number: number;
}

/** Елемент списку кімнат. */
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

/** Модель користувача на карті (для відображення аватарок). */
export interface UserOnMap {
  id: string;
  display_name: string;
  photo: string | null;
}

/** Модель соціальної події для відображення на карті. */
export interface EventOnMap {
  id: number;
  title: string;
  creator: UserOnMap;
  participants_count: number;
}

/** Модель спільного ресурсу для відображення на карті. */
export interface ResourceOnMap {
  id: number;
  name: string;
  max_person: number;
  is_blocked: boolean;
  resource_type?: string;
  resource_icon?: string | null;
}

/** Підтримувані системою типи кімнат. */
export type RoomType =
  | 'LIVING'
  | 'COMMON_AREA'
  | 'KITCHEN'
  | 'LAUNDRY'
  | 'BATHROOM'
  | 'TOILET'
  | 'STORAGE';

/** Повна модель кімнати для відображення на карті поверху. */
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

/** Опис неактивної (ще не доданої) кімнати на карті. */
export interface InactiveRoomOnMap {
  svg_element_id: string;
}

/** Повні дані карти поверху з кімнатами та активними подіями. */
export interface FloorMapData {
  id: number;
  number: number;
  map_file: string | null;
  dormitory_name: string;
  notice: string;
  rooms: RoomOnMap[];
  active_floor_events: EventOnMap[];
}

/** Дані для оновлення параметрів кімнати. */
export interface RoomUpdatePayload {
  name?: string;
  room_type?: number;
  max_person?: number;
  is_blocked?: boolean;
}

/** Дані для створення нової кімнати. */
export interface RoomCreatePayload {
  name: string;
  room_type: number;
  max_person: number;
  is_blocked: boolean;
  svg_element_id: string;
}

/** Дані для створення або оновлення ресурсу. */
export interface ResourcePayload {
  name: string;
  max_person: number;
  is_blocked: boolean;
  resource_type: number;
}
