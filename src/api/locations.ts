import api from './axios-instance';
import type {
  FloorListItem,
  FloorMapData,
  RoomCreatePayload,
  RoomListItem,
  RoomOnMap,
  RoomUpdatePayload,
  ResourcePayload,
  ResourceOnMap,
} from '../types/locations';

export async function getFloors(
  dormitoryId: string | number
): Promise<FloorListItem[]> {
  const { data } = await api.get<FloorListItem[]>(`/floors/${dormitoryId}/`);
  return data;
}

export async function getFloorMapData(
  floorId: string | number
): Promise<FloorMapData> {
  const { data } = await api.get<FloorMapData>(`/floors/${floorId}/map-data/`);
  return data;
}

export async function getRooms(): Promise<RoomListItem[]> {
  const { data } = await api.get<RoomListItem[]>('/rooms/');
  return data;
}

export async function updateRoom(
  roomId: string | number,
  payload: RoomUpdatePayload
): Promise<void> {
  await api.patch(`/rooms/${roomId}/`, payload);
}

export async function deleteRoom(roomId: string | number): Promise<void> {
  await api.delete(`/rooms/${roomId}/`);
}

export async function createRoom(
  floorId: string | number,
  payload: RoomCreatePayload
): Promise<RoomOnMap> {
  const { data } = await api.post<RoomOnMap>(
    `/floors/${floorId}/rooms/`,
    payload
  );
  return data;
}

export async function createResource(
  roomId: string | number,
  payload: ResourcePayload
): Promise<ResourceOnMap> {
  const { data } = await api.post<ResourceOnMap>(
    `/rooms/${roomId}/resources/`,
    payload
  );
  return data;
}

export async function updateResource(
  resourceId: string | number,
  payload: Partial<ResourcePayload>
): Promise<ResourceOnMap> {
  const { data } = await api.patch<ResourceOnMap>(
    `/resources/${resourceId}/`,
    payload
  );
  return data;
}

export async function deleteResource(
  resourceId: string | number
): Promise<void> {
  await api.delete(`/resources/${resourceId}/`);
}
