import api from './axios-instance';
import type {
  Announcement,
  AnnouncementPayload,
  AnnouncementRecipient,
  AnnouncementRecipientFilters,
} from '../types/announcements';

export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const { data } = await api.get<Announcement[]>('/announcements/active/');
  return data;
}

export async function markAnnouncementRead(
  announcementId: number
): Promise<void> {
  await api.post(`/announcements/${announcementId}/read/`);
}

export async function createAnnouncement(
  payload: AnnouncementPayload
): Promise<Announcement> {
  const { data } = await api.post<Announcement>('/announcements/', payload);
  return data;
}

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
