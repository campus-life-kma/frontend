import api from './axios-instance';
import type { Announcement } from '../types/announcements';

export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const { data } = await api.get<Announcement[]>('/announcements/active/');
  return data;
}

export async function markAnnouncementRead(
  announcementId: number
): Promise<void> {
  await api.post(`/announcements/${announcementId}/read/`);
}
