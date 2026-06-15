import api from './axios-instance';
import type {
  FeedResponse,
  SharingRequestPayload,
  SharingRequestUpdatePayload,
  SocialEvent,
  SocialEventPayload,
  SocialEventUpdatePayload,
  SocialSharingRequest,
} from '../types/social';

/** Фільтри для отримання соціальної стрічки (події та запити речей). */
export interface FeedFilters {
  /** Тип: 'all' (усі), 'event' (події), 'sharing_request' (запити). */
  item_type?: 'all' | 'event' | 'sharing_request';
  /** Початкова дата для вибірки. */
  start_date?: string;
  /** Кінцева дата для вибірки. */
  end_date?: string;
  /** Показувати тільки активні події/запити. */
  is_active?: boolean;
  /** Ідентифікатор поверху для фільтрації за локацією. */
  floor_id?: string;
  /** Порядок сортування результатів. */
  ordering?: 'created_at' | 'start_time';
}

/**
 * Отримує сторінку стрічки соціальної активності з фільтрами.
 *
 * @param page - Номер сторінки.
 * @param filters - Об'єкт параметрів фільтрації.
 * @returns Сторінка стрічки (список елементів та інформація про пагінацію).
 */
export async function getFeed(
  page: number,
  filters: FeedFilters = {}
): Promise<FeedResponse> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });

  const query = params.toString();
  const { data } = await api.get<FeedResponse>(
    `/feed/${page}/${query ? `?${query}` : ''}`
  );
  return data;
}

/**
 * Отримує детальну інформацію про конкретну соціальну подію.
 *
 * @param eventId - Унікальний ідентифікатор події.
 * @returns Деталі події.
 */
export async function getEvent(eventId: number): Promise<SocialEvent> {
  const { data } = await api.get<SocialEvent>(`/events/${eventId}/`);
  return data;
}

/**
 * Отримує деталі запиту на обмін речами (sharing request).
 *
 * @param requestId - Унікальний ідентифікатор запиту.
 * @returns Деталі запиту.
 */
export async function getSharingRequest(
  requestId: number
): Promise<SocialSharingRequest> {
  const { data } = await api.get<SocialSharingRequest>(
    `/sharing-requests/${requestId}/`
  );
  return data;
}

/**
 * Створює нову соціальну подію в системі.
 *
 * @param payload - Дані для створення події.
 * @returns Створена подія.
 */
export async function createEvent(
  payload: SocialEventPayload
): Promise<SocialEvent> {
  const { data } = await api.post<SocialEvent>('/events/', payload);
  return data;
}

/**
 * Редагує існуючу соціальну подію.
 *
 * @param eventId - Унікальний ідентифікатор події.
 * @param payload - Оновлені поля події.
 * @returns Оновлена подія.
 */
export async function updateEvent(
  eventId: number,
  payload: SocialEventUpdatePayload
): Promise<SocialEvent> {
  const { data } = await api.patch<SocialEvent>(`/events/${eventId}/`, payload);
  return data;
}

/**
 * Додає поточного користувача до списку учасників події.
 *
 * @param eventId - Унікальний ідентифікатор події.
 * @returns Оновлений об'єкт події з новим учасником.
 */
export async function joinEvent(eventId: number): Promise<SocialEvent> {
  const { data } = await api.post<SocialEvent>(`/events/${eventId}/join/`);
  return data;
}

/**
 * Видаляє поточного користувача зі списку учасників події.
 *
 * @param eventId - Унікальний ідентифікатор події.
 * @returns Оновлений об'єкт події.
 */
export async function leaveEvent(eventId: number): Promise<SocialEvent> {
  const { data } = await api.post<SocialEvent>(`/events/${eventId}/leave/`);
  return data;
}

/**
 * Видаляє подію (доступно для творця події або модератора).
 *
 * @param eventId - Унікальний ідентифікатор події.
 */
export async function deleteEvent(eventId: number): Promise<void> {
  await api.delete(`/events/${eventId}/`);
}

/**
 * Створює запит на позичання або обмін якоюсь річчю.
 *
 * @param payload - Дані для створення запиту.
 * @returns Створений запит.
 */
export async function createSharingRequest(
  payload: SharingRequestPayload
): Promise<SocialSharingRequest> {
  const { data } = await api.post<SocialSharingRequest>(
    '/sharing-requests/',
    payload
  );
  return data;
}

/**
 * Редагує деталі запиту на обмін речами.
 *
 * @param requestId - Унікальний ідентифікатор запиту.
 * @param payload - Оновлені поля запиту.
 * @returns Оновлений запит.
 */
export async function updateSharingRequest(
  requestId: number,
  payload: SharingRequestUpdatePayload
): Promise<SocialSharingRequest> {
  const { data } = await api.patch<SocialSharingRequest>(
    `/sharing-requests/${requestId}/`,
    payload
  );
  return data;
}

/**
 * Позначає запит на обмін речами як виконаний (успішно завершений).
 *
 * @param requestId - Унікальний ідентифікатор запиту.
 * @returns Оновлений об'єкт запиту з новим статусом.
 */
export async function completeSharingRequest(
  requestId: number
): Promise<SocialSharingRequest> {
  const { data } = await api.patch<SocialSharingRequest>(
    `/sharing-requests/${requestId}/done/`
  );
  return data;
}

/**
 * Видаляє запит на обмін речами.
 *
 * @param requestId - Унікальний ідентифікатор запиту.
 * @returns Видалений об'єкт запиту.
 */
export async function deleteSharingRequest(
  requestId: number
): Promise<SocialSharingRequest> {
  const { data } = await api.delete<SocialSharingRequest>(
    `/sharing-requests/${requestId}/`
  );
  return data;
}
