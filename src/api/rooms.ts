import api from './axios-instance';

export async function blockRoom(roomId: number): Promise<void> {
  await api.patch(`/rooms/${roomId}/block/`);
}

export async function unblockRoom(roomId: number): Promise<void> {
  await api.patch(`/rooms/${roomId}/unblock/`);
}
