import api from './axios-instance';

export interface PresenceResponse {
  id: number;
  room_id: number;
  room_name: string;
  floor_id: number;
  joined_at: string;
  expires_at: string;
}

export async function checkIn(roomId: number): Promise<PresenceResponse> {
  const { data } = await api.post<PresenceResponse>('/presence/check-in/', {
    room_id: roomId,
  });
  return data;
}

export async function goHome(): Promise<void> {
  await api.post('/presence/go-home/');
}

export async function getMyPresence(): Promise<PresenceResponse | null> {
  const { data } = await api.get<PresenceResponse | null>('/presence/me/');
  return data ?? null;
}
