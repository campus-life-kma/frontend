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

export async function getAllFloors(): Promise<FloorListItem[]> {
  const { data } = await api.get<FloorListItem[]>('/floors/');
  return data;
}

export async function getFloors(
  dormitoryId: string | number
): Promise<FloorListItem[]> {
  const { data } = await api.get<FloorListItem[]>(`/floors/${dormitoryId}/`);
  return data;
}

/**
 * Отримує повні дані карти поверху, включаючи SVG-файл та перелік кімнат.
 *
 * @param floorId - Унікальний ідентифікатор поверху.
 * @returns Дані карти поверху.
 */
export async function getFloorMapData(
  floorId: string | number
): Promise<FloorMapData> {
  const { data } = await api.get<FloorMapData>(`/floors/${floorId}/map-data/`);
  return data;
}

/**
 * Створює новий поверх для гуртожитку.
 *
 * @param dormitoryId - Ідентифікатор гуртожитку.
 * @param number - Номер поверху.
 * @param mapFile - Файл мапи в форматі SVG.
 */
export async function createFloor(
  dormitoryId: string | number,
  number: number,
  mapFile: File
): Promise<FloorListItem> {
  const formData = new FormData();
  formData.append('number', number.toString());
  formData.append('map_file', mapFile);

  const { data } = await api.post<FloorListItem>(
    `/floors/${dormitoryId}/`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return data;
}

/**
 * Видаляє поверх за ідентифікатором.
 *
 * @param floorId - Ідентифікатор поверху.
 */
export async function deleteFloor(floorId: string | number): Promise<void> {
  await api.delete(`/floors/detail/${floorId}/`);
}

/**
 * Отримує загальний список усіх кімнат.
 *
 * @returns Список кімнат.
 */
export async function getRooms(): Promise<RoomListItem[]> {
  const { data } = await api.get<RoomListItem[]>('/rooms/');
  return data;
}

/**
 * Оновлює властивості кімнати.
 *
 * @param roomId - Унікальний ідентифікатор кімнати.
 * @param payload - Дані для оновлення кімнати.
 */
export async function updateRoom(
  roomId: string | number,
  payload: RoomUpdatePayload
): Promise<void> {
  await api.patch(`/rooms/${roomId}/`, payload);
}

/**
 * Видаляє кімнату із системи.
 *
 * @param roomId - Унікальний ідентифікатор кімнати.
 */
export async function deleteRoom(roomId: string | number): Promise<void> {
  await api.delete(`/rooms/${roomId}/`);
}

/**
 * Створює нову кімнату на певному поверсі.
 *
 * @param floorId - Унікальний ідентифікатор поверху.
 * @param payload - Дані для створення кімнати.
 * @returns Створена кімната з координатами на карті.
 */
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

/**
 * Додає новий ресурс (інвентар) у кімнату.
 *
 * @param roomId - Унікальний ідентифікатор кімнати.
 * @param payload - Дані для створення ресурсу.
 * @returns Створений ресурс.
 */
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

/**
 * Оновлює параметри існуючого ресурсу.
 *
 * @param resourceId - Унікальний ідентифікатор ресурсу.
 * @param payload - Часткові дані для оновлення.
 * @returns Оновлений ресурс.
 */
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

/**
 * Видаляє ресурс із системи.
 *
 * @param resourceId - Унікальний ідентифікатор ресурсу.
 */
export async function deleteResource(
  resourceId: string | number
): Promise<void> {
  await api.delete(`/resources/${resourceId}/`);
}
