import api from './axios-instance';

/** Опис стану поточної присутності користувача в якійсь кімнаті. */
export interface PresenceResponse {
  /** Унікальний ID запису присутності. */
  id: number;
  /** ID кімнати, де перебуває користувач. */
  room_id: number;
  /** Назва кімнати. */
  room_name: string;
  /** ID поверху, на якому знаходиться кімната. */
  floor_id: number;
  /** Час приєднання до кімнати (ISO строка). */
  joined_at: string;
  /** Час автоматичного закінчення присутності (ISO строка). */
  expires_at: string;
}

/**
 * Реєструє присутність користувача в кімнаті (check-in).
 * Якщо користувач був відмічений в іншій кімнаті,
 * стара присутність закривається.
 *
 * @param roomId - Унікальний ідентифікатор кімнати.
 * @returns Стан нової присутності.
 */
export async function checkIn(roomId: number): Promise<PresenceResponse> {
  const { data } = await api.post<PresenceResponse>('/presence/check-in/', {
    room_id: roomId,
  });
  return data;
}

/**
 * Завершує присутність користувача у гуртожитку (go-home).
 */
export async function goHome(): Promise<void> {
  await api.post('/presence/go-home/');
}

/**
 * Отримує поточну активну присутність поточного користувача.
 *
 * @returns Стан присутності або null, якщо користувач ніде не відмічений.
 */
export async function getMyPresence(): Promise<PresenceResponse | null> {
  const { data } = await api.get<PresenceResponse | null>('/presence/me/');
  return data ?? null;
}
