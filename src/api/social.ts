import api from './axios-instance';
import type {
  FeedResponse,
  SharingRequestPayload,
  SocialEvent,
  SocialEventPayload,
  SocialSharingRequest,
} from '../types/social';

export interface FeedFilters {
  item_type?: 'all' | 'event' | 'sharing_request';
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  floor_id?: string;
  ordering?: 'created_at' | 'start_time';
}

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

export async function getEvent(eventId: number): Promise<SocialEvent> {
  const { data } = await api.get<SocialEvent>(`/events/${eventId}/`);
  return data;
}

export async function getSharingRequest(
  requestId: number
): Promise<SocialSharingRequest> {
  const { data } = await api.get<SocialSharingRequest>(
    `/sharing-requests/${requestId}/`
  );
  return data;
}

export async function createEvent(
  payload: SocialEventPayload
): Promise<SocialEvent> {
  const { data } = await api.post<SocialEvent>('/events/', payload);
  return data;
}

export async function joinEvent(eventId: number): Promise<SocialEvent> {
  const { data } = await api.post<SocialEvent>(`/events/${eventId}/join/`);
  return data;
}

export async function leaveEvent(eventId: number): Promise<SocialEvent> {
  const { data } = await api.post<SocialEvent>(`/events/${eventId}/leave/`);
  return data;
}

export async function deleteEvent(eventId: number): Promise<void> {
  await api.delete(`/events/${eventId}/`);
}

export async function createSharingRequest(
  payload: SharingRequestPayload
): Promise<SocialSharingRequest> {
  const { data } = await api.post<SocialSharingRequest>(
    '/sharing-requests/',
    payload
  );
  return data;
}

export async function completeSharingRequest(
  requestId: number
): Promise<SocialSharingRequest> {
  const { data } = await api.patch<SocialSharingRequest>(
    `/sharing-requests/${requestId}/done/`
  );
  return data;
}

export async function deleteSharingRequest(
  requestId: number
): Promise<SocialSharingRequest> {
  const { data } = await api.delete<SocialSharingRequest>(
    `/sharing-requests/${requestId}/`
  );
  return data;
}
