import api from './axios-instance';
import type {
  Booking,
  ResourceBlockResult,
  ResourceScheduleBooking,
} from '../types/bookings';

export async function getResourceSchedule(
  resourceId: string | number
): Promise<ResourceScheduleBooking[]> {
  const { data } = await api.get<ResourceScheduleBooking[]>(
    `/resources/${resourceId}/schedule/`
  );
  return data;
}

export async function getMyBookings(): Promise<Booking[]> {
  const { data } = await api.get<Booking[]>('/bookings/me/');
  return data;
}

export async function createBooking(params: {
  resource: number;
  start_time: string;
  end_time: string;
}): Promise<Booking> {
  const { data } = await api.post<Booking>('/bookings/', params);
  return data;
}

export async function cancelBooking(bookingId: number): Promise<Booking> {
  const { data } = await api.patch<Booking>(`/bookings/${bookingId}/cancel/`);
  return data;
}

export async function blockResource(resourceId: number): Promise<{
  resource: ResourceBlockResult;
  cancelled_bookings_count: number;
}> {
  const { data } = await api.patch<{
    resource: ResourceBlockResult;
    cancelled_bookings_count: number;
  }>(`/resources/${resourceId}/block/`);
  return data;
}

export async function unblockResource(
  resourceId: number
): Promise<ResourceBlockResult> {
  const { data } = await api.patch<ResourceBlockResult>(
    `/resources/${resourceId}/unblock/`
  );
  return data;
}
