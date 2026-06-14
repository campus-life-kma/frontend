import type { UserOnMap } from './locations';

/** Опис заброньованого слота в розкладі ресурсу. */
export interface ResourceScheduleBooking {
  booking_id: number;
  start_time: string;
  end_time: string;
  status: string;
  user?: UserOnMap | null;
}

/** Повна модель бронювання ресурсу користувачем. */
export interface Booking {
  id: number;
  user: UserOnMap;
  cancelled_by: UserOnMap | null;
  resource_id: number;
  resource_name: string;
  room_id: number;
  room_name: string;
  floor_id: number;
  start_time: string;
  end_time: string;
  status: string;
}

/** Результат операцій блокування або розблокування ресурсу. */
export interface ResourceBlockResult {
  id: number;
  name: string;
  room_id: number;
  room_name: string;
  max_person: number;
  is_blocked: boolean;
}
