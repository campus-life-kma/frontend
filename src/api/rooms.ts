import api from './axios-instance';

/**
 * Блокує кімнату (робить її недоступною для заселення, бронювань чи чек-інів).
 *
 * @param roomId - Унікальний ідентифікатор кімнати.
 */
export async function blockRoom(roomId: number): Promise<void> {
  await api.patch(`/rooms/${roomId}/block/`);
}

/**
 * Розблоковує раніше заблоковану кімнату.
 *
 * @param roomId - Унікальний ідентифікатор кімнати.
 */
export async function unblockRoom(roomId: number): Promise<void> {
  await api.patch(`/rooms/${roomId}/unblock/`);
}
