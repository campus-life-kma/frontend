import api from './axios-instance';
import type {
  Booking,
  ResourceBlockResult,
  ResourceScheduleBooking,
} from '../types/bookings';

/** Параметри для запиту розкладу ресурсу. */
interface ResourceScheduleParams {
  /** Початкова дата для вибірки бронювань (у форматі YYYY-MM-DD). */
  start_date?: string;
  /** Кінцева дата для вибірки бронювань (у форматі YYYY-MM-DD). */
  end_date?: string;
}

/**
 * Отримує розклад бронювання для конкретного ресурсу.
 *
 * @param resourceId - Унікальний ідентифікатор ресурсу.
 * @param params - Фільтри дати початку та завершення.
 * @returns Список заброньованих слотів для ресурсу.
 */
export async function getResourceSchedule(
  resourceId: string | number,
  params?: ResourceScheduleParams
): Promise<ResourceScheduleBooking[]> {
  const { data } = await api.get<ResourceScheduleBooking[]>(
    `/resources/${resourceId}/schedule/`,
    { params }
  );
  return data;
}

/**
 * Отримує список бронювань поточного користувача.
 *
 * @returns Список бронювань користувача.
 */
export async function getMyBookings(): Promise<Booking[]> {
  const { data } = await api.get<Booking[]>('/bookings/me/');
  return data;
}

/**
 * Створює нове бронювання ресурсу на вказаний час.
 *
 * @param params - Дані бронювання (ID ресурсу, початковий та кінцевий час).
 * @returns Об'єкт створеного бронювання.
 */
export async function createBooking(params: {
  resource: number;
  start_time: string;
  end_time: string;
}): Promise<Booking> {
  const { data } = await api.post<Booking>('/bookings/', params);
  return data;
}

/**
 * Скасовує існуюче бронювання.
 *
 * @param bookingId - Унікальний ідентифікатор бронювання.
 * @returns Оновлений об'єкт бронювання зі статусом скасованого.
 */
export async function cancelBooking(bookingId: number): Promise<Booking> {
  const { data } = await api.patch<Booking>(`/bookings/${bookingId}/cancel/`);
  return data;
}

/**
 * Блокує ресурс адміністратором чи модератором.
 * Автоматично скасовує всі наявні майбутні бронювання для цього ресурсу.
 *
 * @param resourceId - Унікальний ідентифікатор ресурсу.
 * @returns Дані блокування та кількість скасованих бронювань.
 */
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

/**
 * Розблоковує раніше заблокований ресурс.
 *
 * @param resourceId - Унікальний ідентифікатор ресурсу.
 * @returns Об'єкт розблокованого ресурсу з новим статусом.
 */
export async function unblockResource(
  resourceId: number
): Promise<ResourceBlockResult> {
  const { data } = await api.patch<ResourceBlockResult>(
    `/resources/${resourceId}/unblock/`
  );
  return data;
}
