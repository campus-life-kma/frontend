import api from './axios-instance';

// Admin-only room blocking. Mirrors the resource block/unblock contract:
//   PATCH /rooms/<id>/block/   -> marks the room is_blocked = true
//   PATCH /rooms/<id>/unblock/ -> marks the room is_blocked = false
export async function blockRoom(roomId: number): Promise<void> {
  await api.patch(`/rooms/${roomId}/block/`);
}

export async function unblockRoom(roomId: number): Promise<void> {
  await api.patch(`/rooms/${roomId}/unblock/`);
}
