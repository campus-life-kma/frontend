import api from './axios-instance';
import type {
  FloorListItem,
  FloorMapData,
  RoomListItem,
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
