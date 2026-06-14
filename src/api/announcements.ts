import api from './axios-instance';
import type {
  Announcement,
  AnnouncementPayload,
  AnnouncementRecipient,
  AnnouncementRecipientFilters,
} from '../types/announcements';

/**
 * Отримує список активних оголошень, видимих для поточного користувача.
 *
 * @returns Список активних оголошень.
 */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const { data } = await api.get<Announcement[]>('/announcements/active/');
  return data;
}

/**
 * Відмічає оголошення як прочитане поточним користувачем.
 *
 * @param announcementId - Унікальний ідентифікатор оголошення.
 */
export async function markAnnouncementRead(
  announcementId: number
): Promise<void> {
  await api.post(`/announcements/${announcementId}/read/`);
}

/**
 * Створює нове оголошення (доступно для модераторів та адміністраторів).
 *
 * @param payload - Дані для створення оголошення.
 * @returns Створене оголошення.
 */
export async function createAnnouncement(
  payload: AnnouncementPayload
): Promise<Announcement> {
  const { data } = await api.post<Announcement>('/announcements/', payload);
  return data;
}

/**
 * Отримує список одержувачів оголошень з можливістю фільтрації.
 *
 * @param filters - Фільтри для вибірки одержувачів.
 * @returns Список одержувачів оголошень.
 */
export async function getAnnouncementRecipients(
  filters: AnnouncementRecipientFilters = {}
): Promise<AnnouncementRecipient[]> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });

  const query = params.toString();
  const { data } = await api.get<AnnouncementRecipient[]>(
    `/announcements/recipients/${query ? `?${query}` : ''}`
  );
  return data;
}
